import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import UUIDMixin


class ListingScore(UUIDMixin, Base):
    __tablename__ = "listing_scores"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    total_score: Mapped[int | None] = mapped_column(Integer)
    price_score: Mapped[int | None] = mapped_column(Integer)
    location_score: Mapped[int | None] = mapped_column(Integer)
    natural_risk_score: Mapped[int | None] = mapped_column(Integer)
    legal_risk_score: Mapped[int | None] = mapped_column(Integer)
    renovation_score: Mapped[int | None] = mapped_column(Integer)
    personal_fit_score: Mapped[int | None] = mapped_column(Integer)
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    explanation_fr: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    listing: Mapped["Listing"] = relationship(back_populates="scores")  # noqa: F821
