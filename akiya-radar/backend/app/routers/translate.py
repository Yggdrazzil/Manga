from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings
from app.services.providers import get_translation_provider

router = APIRouter(tags=["translate"])


class TranslateRequest(BaseModel):
    text: str


class TranslateResponse(BaseModel):
    translated: str
    provider: str


@router.post("/translate", response_model=TranslateResponse)
def translate(payload: TranslateRequest) -> TranslateResponse:
    """On-demand translation of a Japanese snippet to French.

    Uses the configured translation provider (mock by default — no paid API in
    the MVP). Real providers (DeepL, Claude/OpenAI) plug in behind the same
    interface via the TRANSLATION_PROVIDER env var.
    """
    text = payload.text.strip()
    if not text:
        return TranslateResponse(translated="", provider=get_settings().translation_provider)
    provider = get_translation_provider()
    return TranslateResponse(
        translated=provider.translate_to_french(text),
        provider=get_settings().translation_provider,
    )
