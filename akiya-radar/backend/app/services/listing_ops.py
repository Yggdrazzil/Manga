"""Cross-cutting listing operations: enrichment, flag detection, scoring.

Kept separate from the routers so the same logic can be reused by the worker
and by the seed script.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import HazardScore, Listing, ListingFlag, ListingScore, PriceHistory
from app.services import dedupe, extraction, fetcher, geocoding, hazard, red_flags, scoring
from app.services.providers import (
    get_exchange_rate_provider,
    get_summary_provider,
    get_translation_provider,
)

# Listing columns the importer is allowed to auto-fill from extracted HTML.
_EXTRACTABLE_FIELDS = (
    "title_original",
    "description_original",
    "price_text_original",
    "price_yen",
    "prefecture",
    "city",
    "address_text",
    "land_area_m2",
    "building_area_m2",
    "floor_plan",
    "build_year",
    "photo_urls",
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
        "listing_status": listing.listing_status,
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


def latest_hazard_dict(db: Session, listing: Listing) -> dict | None:
    row = db.execute(
        select(HazardScore)
        .where(HazardScore.listing_id == listing.id)
        .order_by(HazardScore.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        return None
    return {"earthquake_risk": row.earthquake_risk, "source_name": row.source_name}


def compute_and_store_score(
    db: Session, listing: Listing, prefs: dict | None = None
) -> ListingScore:
    flags = [
        {"flag_code": f.flag_code, "severity": f.severity} for f in listing.flags
    ]
    result = scoring.score_listing(
        listing_to_dict(listing),
        flags=flags,
        hazard=latest_hazard_dict(db, listing),
        prefs=prefs,
    )
    row = ListingScore(**result.to_dict())
    listing.scores.append(row)
    db.flush()
    return row


def geocode_listing(db: Session, listing: Listing, force: bool = False) -> bool:
    """Fill coordinates from the address via GSI. Returns True when updated.

    Never overwrites existing coordinates unless ``force`` — and never claims
    better accuracy than the geocoder inferred.
    """
    if not force and listing.lat is not None and listing.lon is not None:
        return False
    address = listing.address_text or " ".join(
        p for p in (listing.prefecture, listing.city) if p
    )
    result = geocoding.geocode(address)
    if result is None:
        return False
    listing.lat = result.lat
    listing.lon = result.lon
    listing.geocode_accuracy = result.accuracy
    set_geom_from_latlon(listing)
    db.flush()
    return True


def enrich_hazard(db: Session, listing: Listing) -> HazardScore | None:
    """Fetch real J-SHIS seismic hazard for the listing's coordinates."""
    result = hazard.fetch_seismic_hazard(listing.lat, listing.lon)
    if result is None:
        return None
    row = HazardScore(
        earthquake_risk=result.risk_label,
        source_name=result.source_name,
        raw_json={
            "T30_I50_PS": result.prob_shindo5_upper_30y,
            "T30_I60_PS": result.prob_shindo6_lower_30y,
            **result.raw,
        },
    )
    # Append through the relationship so the in-memory collection stays in sync.
    listing.hazard_scores.append(row)
    db.flush()
    compute_and_store_score(db, listing)
    return row


def update_price_eur(listing: Listing) -> None:
    if listing.price_yen is not None:
        provider = get_exchange_rate_provider()
        listing.price_eur = provider.jpy_to_eur(Decimal(listing.price_yen))


def apply_extracted(listing: Listing, extracted: dict) -> list[str]:
    """Fill empty listing fields from extracted HTML data (never overwrite).

    Returns the names of the fields that were actually filled.
    """
    filled: list[str] = []
    for field in _EXTRACTABLE_FIELDS:
        value = extracted.get(field)
        if value in (None, ""):
            continue
        if getattr(listing, field) in (None, ""):
            setattr(listing, field, value)
            filled.append(field)
    return filled


def find_possible_duplicates(db: Session, listing: Listing) -> list[dict]:
    """Surface possible duplicates of ``listing`` without ever auto-merging."""
    others = db.execute(select(Listing).where(Listing.id != listing.id)).scalars().all()
    if not others:
        return []
    candidate = listing_to_dict(listing)
    existing = [
        {
            "id": o.id,
            "source_url": o.source_url,
            "external_id": o.external_id,
            "title_original": o.title_original,
            "title_fr": o.title_fr,
            "city": o.city,
            "price_yen": o.price_yen,
            "land_area_m2": o.land_area_m2,
            "building_area_m2": o.building_area_m2,
            "lat": o.lat,
            "lon": o.lon,
        }
        for o in others
    ]
    by_id = {str(o.id): o for o in others}
    matches = dedupe.find_duplicates(candidate, existing)
    result: list[dict] = []
    for match in matches:
        other = by_id.get(match.listing_id)
        if other is None:
            continue
        result.append(
            {
                "listing_id": match.listing_id,
                "reason": match.reason,
                "confidence": match.confidence,
                "title": other.title_original or other.title_fr,
                "city": other.city,
                "price_yen": other.price_yen,
            }
        )
    return result


# Japanese transactional-status keywords → listing_status (checked in order).
_STATUS_KEYWORDS = (
    ("成約済み", "sold"),
    ("売約済み", "sold"),
    ("受付停止", "paused"),
    ("商談中", "under_negotiation"),
)


def refresh_listing(db: Session, listing: Listing) -> dict:
    """Re-check the source page: availability, price changes, photos.

    Rules (cahier des charges) : une annonce disparue est MARQUÉE ``gone``,
    jamais supprimée — notes, historique et score restent consultables. Une
    erreur réseau ne change jamais le statut (unknown ≠ gone).
    """
    outcome, html = fetcher.fetch_page(listing.source_url)
    result = {
        "outcome": outcome,
        "status_before": listing.listing_status,
        "price_changed": False,
    }

    if outcome == "gone":
        listing.listing_status = "gone"
    elif outcome == "ok" and html:
        listing.last_seen_at = datetime.now(UTC)
        for keyword, status in _STATUS_KEYWORDS:
            if keyword in html:
                listing.listing_status = status
                break
        else:
            listing.listing_status = "active"

        try:
            extracted = extraction.extract_listing_fields(html, base_url=listing.source_url)
        except Exception:  # noqa: BLE001 — refresh must never break on parse
            extracted = {}
        new_price = extracted.get("price_yen")
        if new_price is not None:
            if listing.price_yen is not None and new_price != listing.price_yen:
                listing.price_history.append(
                    PriceHistory(price_yen=new_price, source_url=listing.source_url)
                )
                result["price_changed"] = True
            listing.price_yen = new_price
            update_price_eur(listing)
        if not listing.photo_urls and extracted.get("photo_urls"):
            listing.photo_urls = extracted["photo_urls"]
    # outcome error/disallowed/disabled → statut inchangé.

    compute_and_store_score(db, listing)
    db.flush()
    result["status_after"] = listing.listing_status
    return result


def enrich_listing(db: Session, listing: Listing, prefs: dict | None = None) -> Listing:
    """Full enrichment pass: geocode, translation, summary, FX, flags, score."""
    if listing.lat is None and (listing.address_text or listing.city):
        geocode_listing(db, listing)
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
