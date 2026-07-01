"""Real transaction-price comparables via the MLIT 不動産情報ライブラリ API.

``GET https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001`` with a free API
key (request at https://www.reinfolib.mlit.go.jp/api/request/) sent as the
``Ocp-Apim-Subscription-Key`` header. Filters: ``year``, ``quarter`` and
``area`` (2-digit prefecture code) or ``city`` (5-digit municipality code).

Without a configured key the module reports itself unavailable and the API
returns an explanatory empty result — the MVP never *requires* a paid or
gated dependency (règle du cahier des charges).
"""

from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

import httpx

from app.config import get_settings

logger = logging.getLogger("akiya.mlit")

MLIT_ENDPOINT = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001"

# JIS X 0401 prefecture codes for the 47 prefectures.
PREFECTURE_CODES: dict[str, str] = {
    "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04", "秋田県": "05",
    "山形県": "06", "福島県": "07", "茨城県": "08", "栃木県": "09", "群馬県": "10",
    "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14", "新潟県": "15",
    "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
    "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24", "滋賀県": "25",
    "京都府": "26", "大阪府": "27", "兵庫県": "28", "奈良県": "29", "和歌山県": "30",
    "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34", "山口県": "35",
    "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
    "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "沖縄県": "47",
    "宮崎県": "45", "鹿児島県": "46",
}


@dataclass
class Comp:
    trade_price_yen: Decimal | None
    area_m2: Decimal | None
    unit_price_yen_m2: Decimal | None
    build_year: str | None
    municipality: str | None
    district: str | None
    property_type: str | None


@dataclass
class CompsResult:
    available: bool
    reason: str
    comps: list[Comp] = field(default_factory=list)
    median_unit_price: Decimal | None = None
    sample_size: int = 0


def is_configured() -> bool:
    return bool(get_settings().mlit_api_key)


def _to_decimal(value) -> Decimal | None:
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return None


def fetch_comps(
    prefecture: str | None, city_name: str | None = None, max_results: int = 12
) -> CompsResult:
    """Fetch recent transaction comparables for a prefecture (last full quarter)."""
    settings = get_settings()
    if not settings.mlit_api_key:
        return CompsResult(
            available=False,
            reason=(
                "Clé API MLIT non configurée (MLIT_API_KEY). Demande gratuite : "
                "https://www.reinfolib.mlit.go.jp/api/request/"
            ),
        )
    area = PREFECTURE_CODES.get((prefecture or "").strip())
    if not area:
        return CompsResult(available=False, reason="Préfecture inconnue ou absente.")

    # Latest fully published quarter: go back one quarter from today.
    today = date.today()
    quarter = (today.month - 1) // 3  # previous quarter (1-4), 0 → wrap
    year = today.year
    if quarter == 0:
        quarter, year = 4, year - 1

    try:
        resp = httpx.get(
            MLIT_ENDPOINT,
            params={"year": str(year), "quarter": str(quarter), "area": area},
            headers={
                "Ocp-Apim-Subscription-Key": settings.mlit_api_key,
                "User-Agent": settings.user_agent,
            },
            timeout=20.0,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.info("MLIT lookup failed for area=%s (%s)", area, exc)
        return CompsResult(available=False, reason=f"API MLIT injoignable ({exc}).")

    rows = payload.get("data", []) if isinstance(payload, dict) else []
    comps: list[Comp] = []
    for row in rows:
        if city_name and city_name not in str(row.get("Municipality", "")):
            continue
        comps.append(
            Comp(
                trade_price_yen=_to_decimal(row.get("TradePrice")),
                area_m2=_to_decimal(row.get("Area")),
                unit_price_yen_m2=_to_decimal(row.get("UnitPrice")),
                build_year=row.get("BuildingYear"),
                municipality=row.get("Municipality"),
                district=row.get("DistrictName"),
                property_type=row.get("Type"),
            )
        )
        if len(comps) >= max_results:
            break

    unit_prices = [float(c.unit_price_yen_m2) for c in comps if c.unit_price_yen_m2]
    median = Decimal(str(statistics.median(unit_prices))) if unit_prices else None
    return CompsResult(
        available=True,
        reason=f"MLIT XIT001 — {year}Q{quarter}, préfecture {prefecture}",
        comps=comps,
        median_unit_price=median,
        sample_size=len(comps),
    )
