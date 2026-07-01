"""Seismic hazard lookup via the J-SHIS (防災科研) public API.

``https://www.j-shis.bosai.go.jp/map/api/pshm/{year}/AVR/TTL_MTTL/meshinfo.geojson``
returns, for a lon/lat position, the probabilistic seismic hazard for the
containing mesh. Key attributes:

- ``T30_I50_PS`` — probability of JMA intensity 5-strong or higher within 30 years
- ``T30_I60_PS`` — probability of intensity 6-lower or higher within 30 years

Free, key-less. Best-effort: failures return ``None``. Probabilities are mapped
to coarse labels so the UI stays readable, while the raw payload is preserved
in ``hazard_scores.raw_json`` (règle : ne jamais perdre la donnée source).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger("akiya.hazard")

JSHIS_ENDPOINT = (
    "https://www.j-shis.bosai.go.jp/map/api/pshm/{year}/AVR/TTL_MTTL/meshinfo.geojson"
)
JSHIS_YEAR = "Y2024"


@dataclass
class SeismicHazard:
    prob_shindo5_upper_30y: float | None
    prob_shindo6_lower_30y: float | None
    risk_label: str  # "low" | "medium" | "high" | "unknown"
    source_name: str
    raw: dict


def _label(prob_i50: float | None) -> str:
    """Coarse label from the 30-year intensity-5+ probability.

    Thresholds follow J-SHIS's own map legend breaks (≥26% ~ "high",
    ≥6% ~ "medium"), the convention used in national hazard communication.
    """
    if prob_i50 is None:
        return "unknown"
    if prob_i50 >= 0.26:
        return "high"
    if prob_i50 >= 0.06:
        return "medium"
    return "low"


def _to_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_seismic_hazard(lat, lon) -> SeismicHazard | None:
    """Query J-SHIS for the mesh containing (lat, lon), or ``None`` on failure."""
    settings = get_settings()
    if not settings.hazard_enabled or lat is None or lon is None:
        return None
    url = JSHIS_ENDPOINT.format(year=JSHIS_YEAR)
    try:
        resp = httpx.get(
            url,
            params={"position": f"{float(lon)},{float(lat)}", "epsg": "4326"},
            headers={"User-Agent": settings.user_agent},
            timeout=settings.import_fetch_timeout,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001 — enrichment must never break callers
        logger.info("J-SHIS lookup failed for (%s, %s): %s", lat, lon, exc)
        return None

    features = payload.get("features") if isinstance(payload, dict) else None
    if not features:
        return None
    props = features[0].get("properties", {})
    p50 = _to_float(props.get("T30_I50_PS"))
    p60 = _to_float(props.get("T30_I60_PS"))
    return SeismicHazard(
        prob_shindo5_upper_30y=p50,
        prob_shindo6_lower_30y=p60,
        risk_label=_label(p50),
        source_name=f"J-SHIS {JSHIS_YEAR} (防災科研)",
        raw=props if isinstance(props, dict) else {},
    )
