"""Cross-cutting listing operations: enrichment, flag detection, scoring.

Kept separate from the routers so the same logic can be reused by the worker
and by the seed script.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Listing, ListingFlag, ListingScore
from app.services import red_flags, scoring
from app.services.providers import (
    get_exchange_rate_provider,
    get_summary_provider,
    get_translation_provider,
)


def listing_text_fields(listing: Listing) -> list[str | None]:
    return [
        listing.title_original,
        listing.description_original,
        listing.price_text_original,
        (listing.raw_json or {}).get("notes_source") if listing.raw_json else None,
    ]


def listing_to_dict(listing: Listing) -> dict:
    return {
        "id": listing.id,
        "source_url": listing.source_url,
        "external_id": listing.external_id,
        "title_original": listing.title_original,
        "title_fr": listing.title_fr,
        "price_yen": listing.price_yen,
        "prefecture": listing.prefecture,
        "city": listing.city,
        "lat": listing.lat,
        "lon": listing.lon,
        "geocode_accuracy": listing.geocode_accuracy,
        "land_area_m2": listing.land_area_m2,
        "building_area_m2": listing.building_area_m2,
        "build_year": listing.build_year,
        "property_type": listing.property_type,
    }


def set_geom_from_latlon(listing: Listing) -> None:
    if listing.lat is not None and listing.lon is not None:
        listing.geom = f"SRID=4326;POINT({float(listing.lon)} {float(listing.lat)})"


def detect_and_store_flags(db: Session, listing: Listing) -> list[ListingFlag]:
    # Replace through the relationship so the in-memory collection stays in sync
    # with the database (delete-orphan removes the old rows on flush).
    listing.flags.clear()
    db.flush()
    detected = red_flags.detect_flags(*listing_text_fields(listing))
    for flag in detected:
        listing.flags.append(ListingFlag(**flag))
    db.flush()
    return list(listing.flags)


def compute_and_store_score(
    db: Session, listing: Listing, prefs: dict | None = None
) -> ListingScore:
    flags = [
        {"flag_code": f.flag_code, "severity": f.severity} for f in listing.flags
    ]
    result = scoring.score_listing(listing_to_dict(listing), flags=flags, prefs=prefs)
    row = ListingScore(**result.to_dict())
    listing.scores.append(row)
    db.flush()
    return row


def update_price_eur(listing: Listing) -> None:
    if listing.price_yen is not None:
        provider = get_exchange_rate_provider()
        listing.price_eur = provider.jpy_to_eur(Decimal(listing.price_yen))


def enrich_listing(db: Session, listing: Listing, prefs: dict | None = None) -> Listing:
    """Full enrichment pass: translation, summary, FX, flags, score."""
    set_geom_from_latlon(listing)
    update_price_eur(listing)

    translator = get_translation_provider()
    if listing.title_original and not listing.title_fr:
        listing.title_fr = translator.translate_to_french(listing.title_original)
    if listing.description_original and not listing.description_fr:
        listing.description_fr = translator.translate_to_french(
            listing.description_original
        )
    if not listing.summary_fr:
        listing.summary_fr = get_summary_provider().summarize_listing(
            listing_to_dict(listing)
        )

    detect_and_store_flags(db, listing)
    compute_and_store_score(db, listing, prefs=prefs)
    db.flush()
    return listing
