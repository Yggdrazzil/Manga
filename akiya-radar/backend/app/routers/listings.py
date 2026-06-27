import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Listing, ListingFlag, ListingScore
from app.schemas.listing import (
    FavoriteRequest,
    ImportUrlRequest,
    ListingCreate,
    ListingDetail,
    ListingListResponse,
    ListingSummary,
    ListingUpdate,
)
from app.services import listing_ops

router = APIRouter(prefix="/listings", tags=["listings"])

_LOADERS = (
    selectinload(Listing.flags),
    selectinload(Listing.scores),
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
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ListingListResponse:
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

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()

    rows = (
        db.execute(
            stmt.order_by(Listing.created_at.desc()).limit(limit).offset(offset)
        )
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


@router.post("/import-url", response_model=ListingDetail, status_code=status.HTTP_201_CREATED)
def import_url(payload: ImportUrlRequest, db: Session = Depends(get_db)) -> Listing:
    """Create a minimal, always-editable listing from a URL.

    Import never fails on parse errors: at minimum a record with the source URL
    and editable fields is created. Real fetching/parsing is delegated to the
    worker; the MVP stores the URL and runs enrichment on whatever is present.
    """
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=422, detail="URL is required")

    existing = db.execute(
        select(Listing).where(Listing.source_url == url)
    ).scalar_one_or_none()
    if existing is not None:
        return _get_or_404(db, existing.id, detail=True)

    now = datetime.now(UTC)
    listing = Listing(
        source_url=url,
        source_id=payload.source_id,
        personal_status="new",
        listing_status="unknown",
        first_seen_at=now,
        last_seen_at=now,
        raw_json={"import": "manual", "parsed": False},
    )
    db.add(listing)
    db.flush()
    listing_ops.enrich_listing(db, listing)
    db.commit()
    return _get_or_404(db, listing.id, detail=True)


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
