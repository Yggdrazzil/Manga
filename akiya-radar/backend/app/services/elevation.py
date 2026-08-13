"""Ground elevation via the GSI (国土地理院) elevation API.

``https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php``
is free and key-less, and returns the elevation in metres plus the DEM source
("5m（レーザ）" for LIDAR-grade data, "10m（標高）" otherwise).

Elevation is the cheapest strong signal about water risk: a house at 2 m in a
coastal town is a very different proposition from the same house at 40 m, and
the tsunami layer alone does not convey that.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger("akiya.elevation")

GSI_ELEVATION_ENDPOINT = (
    "https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php"
)


@dataclass
class Elevation:
    metres: float
    source: str | None


def fetch_elevation(lat, lon) -> Elevation | None:
    """Ground elevation in metres at ``(lat, lon)``, or ``None`` on any failure."""
    settings = get_settings()
    if not settings.geocoding_enabled or lat is None or lon is None:
        return None
    try:
        resp = httpx.get(
            GSI_ELEVATION_ENDPOINT,
            params={"lon": float(lon), "lat": float(lat), "outtype": "JSON"},
            headers={"User-Agent": settings.user_agent},
            timeout=settings.import_fetch_timeout,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001 — enrichment must never break callers
        logger.info("elevation lookup failed for (%s, %s): %s", lat, lon, exc)
        return None

    if not isinstance(payload, dict):
        return None
    raw = payload.get("elevation")
    # The API answers "-----" for points outside its coverage (open sea).
    try:
        metres = float(raw)
    except (TypeError, ValueError):
        return None
    return Elevation(metres=metres, source=payload.get("hsrc"))
