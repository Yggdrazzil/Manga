"""Lightweight data carriers passed between adapter stages.

These are deliberately plain dataclasses (no ORM dependency) so the worker can
run independently of the backend and be tested in isolation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class RawListing:
    """Raw, source-shaped data straight out of an HTML parse."""

    source_url: str
    external_id: str | None = None
    title: str | None = None
    description: str | None = None
    price_text: str | None = None
    address_text: str | None = None
    raw_fields: dict[str, str] = field(default_factory=dict)
    raw_html_excerpt: str | None = None


@dataclass
class NormalizedListing:
    """Cleaned, typed data ready to be sent to the backend API."""

    source_url: str
    external_id: str | None = None
    title_original: str | None = None
    description_original: str | None = None
    price_yen: Decimal | None = None
    price_text_original: str | None = None
    prefecture: str | None = None
    city: str | None = None
    address_text: str | None = None
    land_area_m2: Decimal | None = None
    building_area_m2: Decimal | None = None
    floor_plan: str | None = None
    build_year: int | None = None
    raw_json: dict = field(default_factory=dict)
