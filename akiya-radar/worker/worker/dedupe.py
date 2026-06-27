"""Minimal duplicate key helpers for the worker pipeline."""

from __future__ import annotations

import hashlib
import re
from decimal import Decimal

from worker.models import NormalizedListing


def _norm(text: str | None) -> str:
    return re.sub(r"\s+", "", text or "").lower()


def dedupe_key(listing: NormalizedListing) -> str:
    """Stable content key (title + city + price) for cheap duplicate checks."""
    price = ""
    if isinstance(listing.price_yen, Decimal):
        price = str(int(listing.price_yen))
    key = "|".join([_norm(listing.title_original), _norm(listing.city), price])
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def is_probable_duplicate(a: NormalizedListing, b: NormalizedListing) -> bool:
    if a.source_url and a.source_url == b.source_url:
        return True
    if a.external_id and a.external_id == b.external_id:
        return True
    return dedupe_key(a) == dedupe_key(b) and bool(_norm(a.title_original))
