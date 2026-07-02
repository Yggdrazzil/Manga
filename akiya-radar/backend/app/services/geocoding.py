"""Geocoding of Japanese addresses via the GSI (国土地理院) public API.

``https://msearch.gsi.go.jp/address-search/AddressSearch?q=<address>`` is a
free, key-less government service returning GeoJSON-like features with
``geometry.coordinates`` as ``[lon, lat]``. Best-effort: any failure returns
``None`` so callers never break on enrichment.

Accuracy is inferred from how specific the matched title is compared to the
query — a match that only resolves the municipality is flagged ``city`` so the
UI never presents it as an exact location (règle du cahier des charges).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal

import httpx

from app.config import get_settings

logger = logging.getLogger("akiya.geocoding")

GSI_ENDPOINT = "https://msearch.gsi.go.jp/address-search/AddressSearch"
GSI_REVERSE_ENDPOINT = (
    "https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress"
)


@dataclass
class GeocodeResult:
    lat: Decimal
    lon: Decimal
    matched_title: str
    accuracy: str  # "exact" | "approximate" | "city"


def _infer_accuracy(query: str, matched_title: str) -> str:
    # Municipality-only matches (…市 / …町 / …村 / …区 endings, short titles)
    # are city-level. A title covering most of the queried address is exact-ish.
    if len(matched_title) >= max(8, int(len(query) * 0.8)):
        return "approximate"  # street-level Japanese geocoding is rarely parcel-exact
    if matched_title.endswith(("市", "町", "村", "区", "郡", "県", "道", "府", "都")):
        return "city"
    return "approximate"


def is_on_land(lat, lon) -> bool:
    """Check that a point resolves to a Japanese address (GSI reverse geocoder).

    The reverse geocoder returns ``{}`` for open water — the exact failure mode
    behind "un marqueur dans la mer". Fails *open* on network errors so an
    offline environment never blocks geocoding.
    """
    settings = get_settings()
    try:
        resp = httpx.get(
            GSI_REVERSE_ENDPOINT,
            params={"lat": float(lat), "lon": float(lon)},
            headers={"User-Agent": settings.user_agent},
            timeout=settings.import_fetch_timeout,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.info("reverse geocode unavailable for (%s, %s): %s", lat, lon, exc)
        return True
    return bool(isinstance(payload, dict) and payload.get("results"))


def geocode(address: str) -> GeocodeResult | None:
    """Resolve a Japanese address to coordinates, or ``None`` on any failure."""
    settings = get_settings()
    if not settings.geocoding_enabled or not address or not address.strip():
        return None
    try:
        resp = httpx.get(
            GSI_ENDPOINT,
            params={"q": address.strip()},
            headers={"User-Agent": settings.user_agent},
            timeout=settings.import_fetch_timeout,
        )
        resp.raise_for_status()
        features = resp.json()
    except Exception as exc:  # noqa: BLE001 — enrichment must never break callers
        logger.info("geocoding failed for %r (%s)", address, exc)
        return None

    if not isinstance(features, list) or not features:
        return None
    feature = features[0]
    try:
        lon, lat = feature["geometry"]["coordinates"]
        title = str(feature.get("properties", {}).get("title", ""))
    except (KeyError, TypeError, ValueError, IndexError) as exc:
        logger.info("unexpected geocoding payload for %r (%s)", address, exc)
        return None

    # Never place a listing in the sea: reject points that don't reverse-resolve
    # to a Japanese address.
    if not is_on_land(lat, lon):
        logger.info("geocode of %r landed in water (%s, %s) — rejected", address, lat, lon)
        return None

    return GeocodeResult(
        lat=Decimal(str(lat)),
        lon=Decimal(str(lon)),
        matched_title=title,
        accuracy=_infer_accuracy(address, title),
    )
