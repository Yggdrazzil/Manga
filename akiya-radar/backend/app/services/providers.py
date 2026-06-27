"""Pluggable provider abstractions (translation, summary, exchange rate).

All default implementations are *mock* so the MVP has zero paid dependencies.
Real providers (Claude, OpenAI, DeepL, live FX) can be wired later behind the
same interfaces, selected via environment variables.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Protocol

from app.config import get_settings


class TranslationProvider(Protocol):
    def translate_to_french(self, text: str) -> str: ...


class SummaryProvider(Protocol):
    def summarize_listing(self, listing: dict) -> str: ...


class ExchangeRateProvider(Protocol):
    def jpy_to_eur(self, amount_yen: Decimal) -> Decimal: ...


class MockTranslationProvider:
    """Returns a clearly-marked placeholder; the field stays editable in the UI."""

    def translate_to_french(self, text: str) -> str:
        if not text:
            return ""
        return f"[Traduction automatique indisponible — texte original conservé] {text}"


class ManualTranslationProvider:
    """No-op provider: the user pastes the translation manually."""

    def translate_to_french(self, text: str) -> str:
        return ""


class MockSummaryProvider:
    def summarize_listing(self, listing: dict) -> str:
        parts: list[str] = []
        if listing.get("property_type"):
            parts.append(str(listing["property_type"]))
        if listing.get("city") or listing.get("prefecture"):
            loc = ", ".join(
                p for p in (listing.get("city"), listing.get("prefecture")) if p
            )
            parts.append(f"à {loc}")
        if listing.get("price_yen"):
            parts.append(f"prix {int(float(listing['price_yen'])):,} ¥".replace(",", " "))
        if listing.get("land_area_m2"):
            parts.append(f"terrain {listing['land_area_m2']} m²")
        if listing.get("building_area_m2"):
            parts.append(f"bâti {listing['building_area_m2']} m²")
        if not parts:
            return "Résumé indisponible (données insuffisantes)."
        return "Bien : " + ", ".join(parts) + "."


class MockExchangeRateProvider:
    def __init__(self, rate: Decimal | None = None) -> None:
        self._rate = rate or Decimal(str(get_settings().jpy_to_eur_rate))

    def jpy_to_eur(self, amount_yen: Decimal) -> Decimal:
        return (Decimal(amount_yen) * self._rate).quantize(Decimal("0.01"))


def get_translation_provider() -> TranslationProvider:
    provider = get_settings().translation_provider
    if provider == "manual":
        return ManualTranslationProvider()
    return MockTranslationProvider()


def get_summary_provider() -> SummaryProvider:
    return MockSummaryProvider()


def get_exchange_rate_provider() -> ExchangeRateProvider:
    return MockExchangeRateProvider()
