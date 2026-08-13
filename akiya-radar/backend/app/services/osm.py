"""Nearest railway station via the Overpass API (OpenStreetMap).

Free, key-less. One query per listing, on demand only (never in bulk) —
Overpass is a shared community resource. Best-effort: failures return ``None``.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger("akiya.osm")

# Overpass instances go down, rate-limit, or become unreachable from a given
# network independently of one another. With a single endpoint every station
# lookup silently returned "no station found"; the mirrors are tried in order
# and the first usable answer wins.
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
)
SEARCH_RADIUS_M = 15_000


@dataclass
class NearestStation:
    name: str
    distance_km: float
    lat: float
    lon: float
    operator: str | None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def find_nearest_station(lat, lon) -> NearestStation | None:
    """Return the closest railway station within 15 km, or ``None``."""
    settings = get_settings()
    if lat is None or lon is None:
        return None
    query = (
        f"[out:json][timeout:10];"
        f"node(around:{SEARCH_RADIUS_M},{float(lat)},{float(lon)})[railway=station];"
        f"out body 20;"
    )
    elements: list[dict] = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            resp = httpx.post(
                endpoint,
                data={"data": query},
                headers={"User-Agent": settings.user_agent},
                timeout=20.0,
            )
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
        except Exception as exc:  # noqa: BLE001 — enrichment must never break callers
            logger.info("Overpass %s failed for (%s, %s): %s", endpoint, lat, lon, exc)
            continue
        break
    else:
        logger.info("all Overpass mirrors unreachable for (%s, %s)", lat, lon)
        return None

    best: NearestStation | None = None
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:ja") or tags.get("name:en")
        if not name or "lat" not in el or "lon" not in el:
            continue
        dist = _haversine_km(float(lat), float(lon), el["lat"], el["lon"])
        if best is None or dist < best.distance_km:
            best = NearestStation(
                name=name,
                distance_km=round(dist, 2),
                lat=el["lat"],
                lon=el["lon"],
                operator=tags.get("operator"),
            )
    return best
