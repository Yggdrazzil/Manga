import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import UUIDMixin


class HazardScore(UUIDMixin, Base):
    __tablename__ = "hazard_scores"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    flood_risk: Mapped[str | None] = mapped_column(Text)
    tsunami_risk: Mapped[str | None] = mapped_column(Text)
    landslide_risk: Mapped[str | None] = mapped_column(Text)
    storm_surge_risk: Mapped[str | None] = mapped_column(Text)
    earthquake_risk: Mapped[str | None] = mapped_column(Text)
    snow_risk: Mapped[str | None] = mapped_column(Text)
    source_name: Mapped[str | None] = mapped_column(Text)
    source_date: Mapped[str | None] = mapped_column(Text)
    raw_json: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    listing: Mapped["Listing"] = relationship(back_populates="hazard_scores")  # noqa: F821
