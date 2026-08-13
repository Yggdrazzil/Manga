import uuid
from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geography
from sqlalchemy import Boolean, ForeignKey, Index, Integer, Numeric, Text
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


PROPERTY_TYPES = ["kominka", "machiya", "house", "apartment", "land", "other"]
TRANSACTION_TYPES = ["sale", "rent", "unknown"]


class Listing(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "listings"

    # Composite indexes for the filter combinations the listings page actually
    # issues; the single-column ones are declared on the columns themselves.
    __table_args__ = (
        Index("ix_listings_prefecture_city", "prefecture", "city"),
        Index("ix_listings_status_created", "listing_status", "created_at"),
    )

    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sources.id"), index=True
    )
    # Catalogue entry this listing came from, kept even if the Source row is
    # deleted so provenance survives a source being re-registered.
    source_key: Mapped[str | None] = mapped_column(Text, index=True)
    source_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    external_id: Mapped[str | None] = mapped_column(Text)

    title_original: Mapped[str | None] = mapped_column(Text)
    title_fr: Mapped[str | None] = mapped_column(Text)

    description_original: Mapped[str | None] = mapped_column(Text)
    description_fr: Mapped[str | None] = mapped_column(Text)
    summary_fr: Mapped[str | None] = mapped_column(Text)

    price_yen: Mapped[Decimal | None] = mapped_column(Numeric, index=True)
    price_eur: Mapped[Decimal | None] = mapped_column(Numeric)
    price_text_original: Mapped[str | None] = mapped_column(Text)
    # Rentals are kept strictly apart from sale prices: a ¥70 000 monthly rent
    # in price_yen would out-rank every genuine bargain on the board.
    rent_yen_month: Mapped[Decimal | None] = mapped_column(Numeric)

    prefecture: Mapped[str | None] = mapped_column(Text, index=True)
    city: Mapped[str | None] = mapped_column(Text, index=True)
    address_text: Mapped[str | None] = mapped_column(Text)

    lat: Mapped[Decimal | None] = mapped_column(Numeric)
    lon: Mapped[Decimal | None] = mapped_column(Numeric)
    geom: Mapped[object | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    geocode_accuracy: Mapped[str | None] = mapped_column(Text)

    land_area_m2: Mapped[Decimal | None] = mapped_column(Numeric, index=True)
    building_area_m2: Mapped[Decimal | None] = mapped_column(Numeric)
    floor_plan: Mapped[str | None] = mapped_column(Text)
    build_year: Mapped[int | None] = mapped_column(Integer)

    # Structured context harvested from the source page (see services/normalize).
    zoning: Mapped[str | None] = mapped_column(Text)
    structure: Mapped[str | None] = mapped_column(Text)
    land_rights: Mapped[str | None] = mapped_column(Text)
    parking: Mapped[str | None] = mapped_column(Text)
    current_state: Mapped[str | None] = mapped_column(Text)
    features: Mapped[list | None] = mapped_column(JSONB)
    utilities: Mapped[list | None] = mapped_column(JSONB)

    station_name: Mapped[str | None] = mapped_column(Text)
    station_line: Mapped[str | None] = mapped_column(Text)
    station_walk_minutes: Mapped[int | None] = mapped_column(Integer)
    station_distance_km: Mapped[Decimal | None] = mapped_column(Numeric)
    elevation_m: Mapped[Decimal | None] = mapped_column(Numeric)

    property_type: Mapped[str | None] = mapped_column(Text, index=True)
    transaction_type: Mapped[str | None] = mapped_column(Text, index=True)
    listing_status: Mapped[str | None] = mapped_column(Text, default="active")

    personal_status: Mapped[str] = mapped_column(Text, default="new", index=True)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    rating: Mapped[int | None] = mapped_column(Integer)

    # 0-100: how much of the comparable core this listing actually has. Lets the
    # UI say "fiche incomplète" instead of rendering convincing blanks.
    data_completeness: Mapped[int | None] = mapped_column(Integer)
    # "static" (plain HTTP) or "rendered" (the page needed JavaScript). Explains
    # why a source is slow, and flags listings whose markup may shift.
    fetch_mode: Mapped[str | None] = mapped_column(Text)
    # {field: {label, text}} — the original Japanese label and text behind every
    # normalised value, so nothing the app shows is unattributable.
    field_provenance: Mapped[dict | None] = mapped_column(JSONB)

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
