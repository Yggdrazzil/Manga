import csv
import io
import uuid
from dataclasses import asdict
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Listing, ListingFlag, ListingScore
from app.schemas.listing import (
    CompsOut,
    DuplicateOut,
    FavoriteRequest,
    ImportResult,
    ImportUrlRequest,
    ListingCreate,
    ListingDetail,
    ListingListResponse,
    ListingSummary,
    ListingUpdate,
    RefreshResult,
    StationOut,
)
from app.services import extraction, fetcher, listing_ops, mlit, osm

router = APIRouter(prefix="/listings", tags=["listings"])

_LOADERS = (
    selectinload(Listing.flags),
    selectinload(Listing.scores),
    selectinload(Listing.hazard_scores),
)
_DETAIL_LOADERS = (
    *_LOADERS,
    selectinload(Listing.notes),
    selectinload(Listing.tasks),
    selectinload(Listing.price_history),
)


def _get_or_404(db: Session, listing_id: uuid.UUID, detail: bool = False) -> Listing:
    loaders = _DETAIL_LOADERS if detail else _LOADERS
    listing = db.execute(
        select(Listing).options(*loaders).where(Listing.id == listing_id)
    ).scalar_one_or_none()
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


def _latest_score_subq():
    latest = (
        select(
            ListingScore.listing_id,
            func.max(ListingScore.created_at).label("latest"),
        )
        .group_by(ListingScore.listing_id)
        .subquery()
    )
    return (
        select(ListingScore.listing_id, ListingScore.total_score)
        .join(
            latest,
            (ListingScore.listing_id == latest.c.listing_id)
            & (ListingScore.created_at == latest.c.latest),
        )
        .subquery()
    )


def _apply_sort(stmt, sort: str):
    if sort == "price_asc":
        return stmt.order_by(Listing.price_yen.asc().nulls_last())
    if sort == "price_desc":
        return stmt.order_by(Listing.price_yen.desc().nulls_last())
    if sort == "score_desc":
        score_subq = _latest_score_subq()
        return stmt.outerjoin(score_subq, Listing.id == score_subq.c.listing_id).order_by(
            score_subq.c.total_score.desc().nulls_last()
        )
    return stmt.order_by(Listing.created_at.desc())


def _filtered_stmt(
    prefecture: str | None,
    city: str | None,
    max_price_yen: float | None,
    min_land_area_m2: float | None,
    min_building_area_m2: float | None,
    property_type: str | None,
    transaction_type: str | None,
    personal_status: str | None,
    favorite: bool | None,
    min_score: int | None,
    exclude_critical_flags: bool,
    query: str | None,
):
    stmt = select(Listing).options(*_LOADERS)

    if prefecture:
        stmt = stmt.where(Listing.prefecture == prefecture)
    if city:
        stmt = stmt.where(Listing.city == city)
    if max_price_yen is not None:
        stmt = stmt.where(Listing.price_yen <= max_price_yen)
    if min_land_area_m2 is not None:
        stmt = stmt.where(Listing.land_area_m2 >= min_land_area_m2)
    if min_building_area_m2 is not None:
        stmt = stmt.where(Listing.building_area_m2 >= min_building_area_m2)
    if property_type:
        stmt = stmt.where(Listing.property_type == property_type)
    if transaction_type:
        stmt = stmt.where(Listing.transaction_type == transaction_type)
    if personal_status:
        stmt = stmt.where(Listing.personal_status == personal_status)
    if favorite is not None:
        stmt = stmt.where(Listing.favorite == favorite)
    if query:
        like = f"%{query}%"
        stmt = stmt.where(
            or_(
                Listing.title_original.ilike(like),
                Listing.title_fr.ilike(like),
                Listing.summary_fr.ilike(like),
                Listing.city.ilike(like),
                Listing.prefecture.ilike(like),
                Listing.address_text.ilike(like),
            )
        )

    if min_score is not None:
        latest_score = (
            select(
                ListingScore.listing_id,
                func.max(ListingScore.created_at).label("latest"),
            )
            .group_by(ListingScore.listing_id)
            .subquery()
        )
        scored = (
            select(ListingScore.listing_id)
            .join(
                latest_score,
                (ListingScore.listing_id == latest_score.c.listing_id)
                & (ListingScore.created_at == latest_score.c.latest),
            )
            .where(ListingScore.total_score >= min_score)
        )
        stmt = stmt.where(Listing.id.in_(scored))

    if exclude_critical_flags:
        critical = select(ListingFlag.listing_id).where(ListingFlag.severity == "critical")
        stmt = stmt.where(Listing.id.not_in(critical))

    return stmt


@router.get("", response_model=ListingListResponse)
def list_listings(
    db: Session = Depends(get_db),
    prefecture: str | None = None,
    city: str | None = None,
    max_price_yen: float | None = None,
    min_land_area_m2: float | None = None,
    min_building_area_m2: float | None = None,
    property_type: str | None = None,
    transaction_type: str | None = None,
    personal_status: str | None = None,
    favorite: bool | None = None,
    min_score: int | None = None,
    exclude_critical_flags: bool = False,
    query: str | None = None,
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|score_desc)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ListingListResponse:
    stmt = _filtered_stmt(
        prefecture,
        city,
        max_price_yen,
        min_land_area_m2,
        min_building_area_m2,
        property_type,
        transaction_type,
        personal_status,
        favorite,
        min_score,
        exclude_critical_flags,
        query,
    )
    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()

    rows = (
        db.execute(_apply_sort(stmt, sort).limit(limit).offset(offset))
        .scalars()
        .unique()
        .all()
    )
    return ListingListResponse(
        items=[ListingSummary.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/export.csv")
def export_csv(
    db: Session = Depends(get_db),
    prefecture: str | None = None,
    city: str | None = None,
    max_price_yen: float | None = None,
    favorite: bool | None = None,
    exclude_critical_flags: bool = False,
) -> StreamingResponse:
    """Export the (optionally filtered) listings as CSV for spreadsheets."""
    stmt = _filtered_stmt(
        prefecture, city, max_price_yen, None, None, None, None, None,
        favorite, None, exclude_critical_flags, None,
    )
    rows = db.execute(_apply_sort(stmt, "newest")).scalars().unique().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id", "titre", "prefecture", "ville", "prix_yen", "prix_eur",
            "terrain_m2", "bati_m2", "annee", "plan", "score", "confiance",
            "red_flags", "statut_personnel", "favori", "url_source",
        ]
    )
    for listing in rows:
        score = listing.scores[-1] if listing.scores else None
        writer.writerow(
            [
                listing.id,
                listing.title_original or listing.title_fr or "",
                listing.prefecture or "",
                listing.city or "",
                listing.price_yen or "",
                listing.price_eur or "",
                listing.land_area_m2 or "",
                listing.building_area_m2 or "",
                listing.build_year or "",
                listing.floor_plan or "",
                score.total_score if score else "",
                score.confidence_score if score else "",
                "|".join(f.flag_code for f in listing.flags),
                listing.personal_status,
                "oui" if listing.favorite else "non",
                listing.source_url,
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=akiya-radar-export.csv"},
    )


@router.post("", response_model=ListingDetail, status_code=status.HTTP_201_CREATED)
def create_listing(payload: ListingCreate, db: Session = Depends(get_db)) -> Listing:
    existing = db.execute(
        select(Listing).where(Listing.source_url == payload.source_url)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="A listing with this URL already exists")

    now = datetime.now(UTC)
    data = payload.model_dump(exclude_unset=True)
    listing = Listing(**data)
    listing.first_seen_at = listing.first_seen_at or now
    listing.last_seen_at = now
    db.add(listing)
    db.flush()
    listing_ops.enrich_listing(db, listing)
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.get("/{listing_id}", response_model=ListingDetail)
def get_listing(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> Listing:
    return _get_or_404(db, listing_id, detail=True)


@router.patch("/{listing_id}", response_model=ListingDetail)
def update_listing(
    listing_id: uuid.UUID, payload: ListingUpdate, db: Session = Depends(get_db)
) -> Listing:
    listing = _get_or_404(db, listing_id, detail=True)
    data = payload.model_dump(exclude_unset=True)
    price_changed = "price_yen" in data and data["price_yen"] != listing.price_yen
    for key, value in data.items():
        setattr(listing, key, value)
    if price_changed:
        from app.models import PriceHistory

        db.add(
            PriceHistory(
                listing_id=listing.id,
                price_yen=listing.price_yen,
                source_url=listing.source_url,
            )
        )
    listing_ops.set_geom_from_latlon(listing)
    listing_ops.update_price_eur(listing)
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    listing = _get_or_404(db, listing_id)
    db.delete(listing)
    db.commit()


@router.post("/import-url", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
def import_url(payload: ImportUrlRequest, db: Session = Depends(get_db)) -> ImportResult:
    """Create an always-editable listing from a URL.

    Best-effort: if the page is reachable and robots.txt allows it, fields are
    extracted automatically. Import never fails on fetch/parse errors — at
    minimum a record with the source URL and editable fields is created.
    Possible duplicates are surfaced (never auto-merged).
    """
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=422, detail="URL is required")

    existing = db.execute(
        select(Listing).where(Listing.source_url == url)
    ).scalar_one_or_none()
    if existing is not None:
        return ImportResult(
            listing=ListingDetail.model_validate(_get_or_404(db, existing.id, detail=True)),
            fetched=False,
            fields_filled=[],
            possible_duplicates=listing_ops.find_possible_duplicates(db, existing),
        )

    now = datetime.now(UTC)
    listing = Listing(
        source_url=url,
        source_id=payload.source_id,
        personal_status="new",
        listing_status="unknown",
        first_seen_at=now,
        last_seen_at=now,
    )
    db.add(listing)
    db.flush()

    fetched = False
    fields_filled: list[str] = []
    # Sources that ship an empty app shell are re-fetched through a browser.
    outcome, html, mode = fetcher.fetch_page_smart(url)
    if outcome == "ok" and html:
        fetched = True
        listing.fetch_mode = mode
        try:
            extracted = extraction.extract_listing(html, base_url=url)
        except Exception:  # noqa: BLE001 — extraction must never break import
            extracted = {}
        fields_filled = listing_ops.apply_extracted(listing, extracted)
    listing.raw_json = {
        "import": "manual",
        "fetched": fetched,
        "fetch_mode": mode,
        "fields_filled": fields_filled,
    }

    listing_ops.enrich_listing(db, listing)
    duplicates = listing_ops.find_possible_duplicates(db, listing)
    db.commit()

    return ImportResult(
        listing=ListingDetail.model_validate(_get_or_404(db, listing.id, detail=True)),
        fetched=fetched,
        fields_filled=fields_filled,
        possible_duplicates=duplicates,
    )


@router.get("/{listing_id}/duplicates", response_model=list[DuplicateOut])
def listing_duplicates(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> list[dict]:
    listing = _get_or_404(db, listing_id)
    return listing_ops.find_possible_duplicates(db, listing)


@router.post("/{listing_id}/enrich", response_model=ListingDetail)
def enrich(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> Listing:
    listing = _get_or_404(db, listing_id, detail=True)
    listing_ops.enrich_listing(db, listing)
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.post("/{listing_id}/favorite", response_model=ListingDetail)
def set_favorite(
    listing_id: uuid.UUID, payload: FavoriteRequest, db: Session = Depends(get_db)
) -> Listing:
    listing = _get_or_404(db, listing_id, detail=True)
    listing.favorite = payload.favorite
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.post("/{listing_id}/score", response_model=ListingDetail)
def rescore(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> Listing:
    listing = _get_or_404(db, listing_id, detail=True)
    listing_ops.compute_and_store_score(db, listing)
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.post("/{listing_id}/detect-flags", response_model=ListingDetail)
def detect_flags(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> Listing:
    listing = _get_or_404(db, listing_id, detail=True)
    listing_ops.detect_and_store_flags(db, listing)
    listing_ops.compute_and_store_score(db, listing)
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.post("/{listing_id}/geocode", response_model=ListingDetail)
def geocode_listing(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> Listing:
    """Resolve the listing's address to coordinates via the free GSI API."""
    listing = _get_or_404(db, listing_id, detail=True)
    updated = listing_ops.geocode_listing(db, listing, force=True)
    if not updated:
        raise HTTPException(
            status_code=422,
            detail="Géocodage impossible : adresse absente ou API GSI sans résultat.",
        )
    listing_ops.compute_and_store_score(db, listing)
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.post("/{listing_id}/hazard", response_model=ListingDetail)
def check_hazard(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> Listing:
    """Fetch real seismic hazard (J-SHIS) for the listing's coordinates."""
    listing = _get_or_404(db, listing_id, detail=True)
    if listing.lat is None or listing.lon is None:
        raise HTTPException(
            status_code=422,
            detail="Coordonnées requises : géocodez d'abord l'annonce.",
        )
    row = listing_ops.enrich_hazard(db, listing)
    if row is None:
        raise HTTPException(status_code=502, detail="API J-SHIS injoignable.")
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


@router.get("/{listing_id}/comps", response_model=CompsOut)
def listing_comps(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> CompsOut:
    """Real MLIT transaction comparables for the listing's prefecture/city."""
    listing = _get_or_404(db, listing_id)
    result = mlit.fetch_comps(listing.prefecture, listing.city)
    return CompsOut(
        available=result.available,
        reason=result.reason,
        comps=[asdict(c) for c in result.comps],
        median_unit_price=result.median_unit_price,
        sample_size=result.sample_size,
    )


@router.post("/{listing_id}/refresh", response_model=RefreshResult)
def refresh_listing(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> RefreshResult:
    """Re-check the source page: gone/sold detection, price change, photos."""
    listing = _get_or_404(db, listing_id, detail=True)
    result = listing_ops.refresh_listing(db, listing)
    db.commit()
    return RefreshResult(
        **result,
        listing=ListingDetail.model_validate(_get_or_404(db, listing.id, detail=True)),
    )


@router.get("/{listing_id}/nearest-station", response_model=StationOut)
def nearest_station(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> StationOut:
    """Closest railway station (OpenStreetMap/Overpass) within 15 km."""
    listing = _get_or_404(db, listing_id)
    if listing.lat is None or listing.lon is None:
        raise HTTPException(
            status_code=422,
            detail="Coordonnées requises : géocodez d'abord l'annonce.",
        )
    station = osm.find_nearest_station(listing.lat, listing.lon)
    if station is None:
        return StationOut(found=False)
    return StationOut(found=True, **asdict(station))
