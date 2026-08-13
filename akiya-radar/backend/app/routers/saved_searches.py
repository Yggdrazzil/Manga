import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Listing, SavedSearch
from app.schemas.listing import ListingSummary
from app.schemas.misc import SavedSearchCreate, SavedSearchOut, SavedSearchUpdate

router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


def _get_or_404(db: Session, search_id: uuid.UUID) -> SavedSearch:
    search = db.get(SavedSearch, search_id)
    if search is None:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return search


def apply_criteria(stmt, criteria: dict):
    """Translate a saved-search ``criteria_json`` into query filters.

    Shares the same vocabulary as ``GET /listings`` query parameters so a saved
    search and a manual search behave identically.
    """
    mapping = {
        "prefecture": Listing.prefecture,
        "city": Listing.city,
        "property_type": Listing.property_type,
        "transaction_type": Listing.transaction_type,
        "personal_status": Listing.personal_status,
    }
    for key, column in mapping.items():
        if criteria.get(key) is not None:
            stmt = stmt.where(column == criteria[key])
    if criteria.get("max_price_yen") is not None:
        stmt = stmt.where(Listing.price_yen <= criteria["max_price_yen"])
    if criteria.get("min_land_area_m2") is not None:
        stmt = stmt.where(Listing.land_area_m2 >= criteria["min_land_area_m2"])
    if criteria.get("min_building_area_m2") is not None:
        stmt = stmt.where(Listing.building_area_m2 >= criteria["min_building_area_m2"])
    if criteria.get("favorite") is not None:
        stmt = stmt.where(Listing.favorite == criteria["favorite"])
    if criteria.get("query"):
        like = f"%{criteria['query']}%"
        stmt = stmt.where(
            or_(
                Listing.title_original.ilike(like),
                Listing.title_fr.ilike(like),
                Listing.city.ilike(like),
                Listing.prefecture.ilike(like),
            )
        )
    return stmt


@router.get("", response_model=list[SavedSearchOut])
def list_saved_searches(db: Session = Depends(get_db)) -> list[SavedSearch]:
    return list(
        db.execute(select(SavedSearch).order_by(SavedSearch.created_at.desc())).scalars()
    )


@router.post("", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(
    payload: SavedSearchCreate, db: Session = Depends(get_db)
) -> SavedSearch:
    search = SavedSearch(**payload.model_dump(exclude_unset=True))
    db.add(search)
    db.commit()
    db.refresh(search)
    return search


@router.get("/{search_id}", response_model=SavedSearchOut)
def get_saved_search(search_id: uuid.UUID, db: Session = Depends(get_db)) -> SavedSearch:
    return _get_or_404(db, search_id)


@router.patch("/{search_id}", response_model=SavedSearchOut)
def update_saved_search(
    search_id: uuid.UUID, payload: SavedSearchUpdate, db: Session = Depends(get_db)
) -> SavedSearch:
    search = _get_or_404(db, search_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(search, key, value)
    db.commit()
    db.refresh(search)
    return search


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(search_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    search = _get_or_404(db, search_id)
    db.delete(search)
    db.commit()


@router.post("/{search_id}/run", response_model=list[ListingSummary])
def run_saved_search(
    search_id: uuid.UUID, db: Session = Depends(get_db)
) -> list[Listing]:
    search = _get_or_404(db, search_id)
    stmt = select(Listing).options(
        selectinload(Listing.flags),
        selectinload(Listing.scores),
        selectinload(Listing.hazard_scores),
    )
    stmt = apply_criteria(stmt, search.criteria_json or {})
    rows = list(
        db.execute(stmt.order_by(Listing.created_at.desc())).scalars().unique()
    )
    search.last_checked_at = datetime.now(UTC)
    db.commit()
    return rows
