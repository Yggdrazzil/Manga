"""Duplicate detection for listings.

Per the spec, duplicates are *surfaced*, never auto-merged when uncertain.
Functions here return match candidates with a reason and a confidence label.
"""

from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class DuplicateMatch:
    listing_id: str
    reason: str
    confidence: str  # "exact" | "high" | "possible"


def _norm_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", "", text).lower()


def _to_float(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def content_hash(title: str | None, city: str | None, price_yen) -> str:
    """Stable hash of title + city + price for cheap duplicate lookups."""
    price = _to_float(price_yen)
    price_part = "" if price is None else str(int(price))
    key = "|".join([_norm_text(title), _norm_text(city), price_part])
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def haversine_m(lat1, lon1, lat2, lon2) -> float | None:
    coords = [_to_float(v) for v in (lat1, lon1, lat2, lon2)]
    if any(c is None for c in coords):
        return None
    lat1, lon1, lat2, lon2 = coords
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _jaccard(a: str, b: str) -> float:
    set_a = set(_norm_text(a))
    set_b = set(_norm_text(b))
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def _attrs_match(candidate: dict, other: dict) -> bool:
    keys = ("city", "price_yen", "land_area_m2", "building_area_m2")
    have = 0
    for key in keys:
        cv, ov = candidate.get(key), other.get(key)
        if cv is None or ov is None:
            continue
        if key == "city":
            if _norm_text(cv) != _norm_text(ov):
                return False
        else:
            cf, of = _to_float(cv), _to_float(ov)
            if cf is None or of is None:
                continue
            if abs(cf - of) > max(1.0, 0.02 * max(cf, of)):
                return False
        have += 1
    return have >= 3


def find_duplicates(candidate: dict, existing: list[dict]) -> list[DuplicateMatch]:
    """Return possible duplicates of ``candidate`` among ``existing`` listings.

    Detection ladder (strongest first): exact URL, external_id, content hash,
    attribute match, geo proximity, then textual similarity.
    """
    matches: list[DuplicateMatch] = []
    cand_hash = content_hash(
        candidate.get("title_original") or candidate.get("title_fr"),
        candidate.get("city"),
        candidate.get("price_yen"),
    )
    for other in existing:
        oid = str(other.get("id"))
        if other.get("source_url") and candidate.get("source_url") == other.get("source_url"):
            matches.append(DuplicateMatch(oid, "URL identique", "exact"))
            continue
        if (
            candidate.get("external_id")
            and candidate.get("external_id") == other.get("external_id")
        ):
            matches.append(DuplicateMatch(oid, "external_id identique", "exact"))
            continue

        other_hash = content_hash(
            other.get("title_original") or other.get("title_fr"),
            other.get("city"),
            other.get("price_yen"),
        )
        if cand_hash == other_hash and cand_hash != content_hash(None, None, None):
            matches.append(DuplicateMatch(oid, "titre + ville + prix identiques", "high"))
            continue

        if _attrs_match(candidate, other):
            matches.append(
                DuplicateMatch(oid, "ville + prix + surfaces identiques", "high")
            )
            continue

        dist = haversine_m(
            candidate.get("lat"), candidate.get("lon"), other.get("lat"), other.get("lon")
        )
        if dist is not None and dist < 30:
            matches.append(
                DuplicateMatch(oid, f"coordonnées très proches ({dist:.0f} m)", "possible")
            )
            continue

        sim = _jaccard(
            candidate.get("title_original") or candidate.get("title_fr") or "",
            other.get("title_original") or other.get("title_fr") or "",
        )
        if sim >= 0.85:
            matches.append(
                DuplicateMatch(oid, f"titres très similaires ({sim:.0%})", "possible")
            )
    return matches
