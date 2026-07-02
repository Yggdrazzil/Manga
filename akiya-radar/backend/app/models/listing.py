import uuid
from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geography
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

PERSONAL_STATUSES = [
    "new",
    "to_review",
    "interesting",
    "very_interesting",
    "needs_verification",
    "contact_to_make",
    "contacted",
    "visit_to_plan",
    "visited",
    "offer_considered",
    "abandoned",
]

LISTING_STATUSES = [
    "active",
    "unknown",
    "gone",
    "sold",
    "under_negotiation",
    "paused",
]


class Listing(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "listings"

    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sources.id")
    )
    source_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    external_id: Mapped[str | None] = mapped_column(Text)

    title_original: Mapped[str | None] = mapped_column(Text)
    title_fr: Mapped[str | None] = mapped_column(Text)

    description_original: Mapped[str | None] = mapped_column(Text)
    description_fr: Mapped[str | None] = mapped_column(Text)
    summary_fr: Mapped[str | None] = mapped_column(Text)

    price_yen: Mapped[Decimal | None] = mapped_column(Numeric)
    price_eur: Mapped[Decimal | None] = mapped_column(Numeric)
    price_text_original: Mapped[str | None] = mapped_column(Text)

    prefecture: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    address_text: Mapped[str | None] = mapped_column(Text)

    lat: Mapped[Decimal | None] = mapped_column(Numeric)
    lon: Mapped[Decimal | None] = mapped_column(Numeric)
    geom: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    geocode_accuracy: Mapped[str | None] = mapped_column(Text)

    land_area_m2: Mapped[Decimal | None] = mapped_column(Numeric)
    building_area_m2: Mapped[Decimal | None] = mapped_column(Numeric)
    floor_plan: Mapped[str | None] = mapped_column(Text)
    build_year: Mapped[int | None] = mapped_column(Integer)

    property_type: Mapped[str | None] = mapped_column(Text)
    transaction_type: Mapped[str | None] = mapped_column(Text)
    listing_status: Mapped[str | None] = mapped_column(Text, default="active")

    personal_status: Mapped[str] = mapped_column(Text, default="new")
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[int | None] = mapped_column(Integer)

    first_seen_at: Mapped[datetime | None] = mapped_column()
    last_seen_at: Mapped[datetime | None] = mapped_column()
    source_updated_at: Mapped[datetime | None] = mapped_column()

    raw_hash: Mapped[str | None] = mapped_column(Text)
    raw_json: Mapped[dict | None] = mapped_column(JSONB)
    # URLs of photos found on the source page (never re-hosted — the source
    # stays the canonical owner; broken links simply stop rendering).
    photo_urls: Mapped[list | None] = mapped_column(JSONB)

    source: Mapped["Source | None"] = relationship(back_populates="listings")  # noqa: F821
    flags: Mapped[list["ListingFlag"]] = relationship(  # noqa: F821
        back_populates="listing", cascade="all, delete-orphan"
    )
    scores: Mapped[list["ListingScore"]] = relationship(  # noqa: F821
        back_populates="listing", cascade="all, delete-orphan"
    )
    hazard_scores: Mapped[list["HazardScore"]] = relationship(  # noqa: F821
        back_populates="listing", cascade="all, delete-orphan"
    )
    notes: Mapped[list["ListingNote"]] = relationship(  # noqa: F821
        back_populates="listing", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["ListingTask"]] = relationship(  # noqa: F821
        back_populates="listing", cascade="all, delete-orphan"
    )
    price_history: Mapped[list["PriceHistory"]] = relationship(  # noqa: F821
        back_populates="listing", cascade="all, delete-orphan"
    )
