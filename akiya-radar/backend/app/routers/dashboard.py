from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Listing, ListingFlag, ListingScore, ListingTask
from app.schemas.listing import ListingSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    total: int
    new: int
    favorites: int
    very_interesting: int
    critical_flags: int
    open_tasks: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    top_opportunities: list[ListingSummary]
    recent_listings: list[ListingSummary]


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


@router.get("", response_model=DashboardResponse)
def dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    total = db.execute(select(func.count(Listing.id))).scalar_one()
    new = db.execute(
        select(func.count(Listing.id)).where(Listing.personal_status == "new")
    ).scalar_one()
    favorites = db.execute(
        select(func.count(Listing.id)).where(Listing.favorite.is_(True))
    ).scalar_one()
    very_interesting = db.execute(
        select(func.count(Listing.id)).where(
            Listing.personal_status == "very_interesting"
        )
    ).scalar_one()
    critical_flags = db.execute(
        select(func.count(func.distinct(ListingFlag.listing_id))).where(
            ListingFlag.severity == "critical"
        )
    ).scalar_one()
    open_tasks = db.execute(
        select(func.count(ListingTask.id)).where(ListingTask.status != "done")
    ).scalar_one()

    score_subq = _latest_score_subq()
    loaders = (selectinload(Listing.flags), selectinload(Listing.scores))

    top = list(
        db.execute(
            select(Listing)
            .options(*loaders)
            .join(score_subq, Listing.id == score_subq.c.listing_id)
            .where(Listing.listing_status.not_in(["sold", "gone"]))
            .order_by(score_subq.c.total_score.desc())
            .limit(5)
        )
        .scalars()
        .unique()
    )
    recent = list(
        db.execute(
            select(Listing).options(*loaders).order_by(Listing.created_at.desc()).limit(8)
        )
        .scalars()
        .unique()
    )

    return DashboardResponse(
        stats=DashboardStats(
            total=total,
            new=new,
            favorites=favorites,
            very_interesting=very_interesting,
            critical_flags=critical_flags,
            open_tasks=open_tasks,
        ),
        top_opportunities=[ListingSummary.model_validate(r) for r in top],
        recent_listings=[ListingSummary.model_validate(r) for r in recent],
    )
