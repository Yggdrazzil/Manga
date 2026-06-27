import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import UUIDMixin


class PriceHistory(UUIDMixin, Base):
    __tablename__ = "price_history"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    price_yen: Mapped[Decimal | None] = mapped_column(Numeric)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source_url: Mapped[str | None] = mapped_column(Text)

    listing: Mapped["Listing"] = relationship(back_populates="price_history")  # noqa: F821
