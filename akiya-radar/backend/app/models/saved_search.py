from datetime import datetime

from sqlalchemy import Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class SavedSearch(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "saved_searches"

    name: Mapped[str] = mapped_column(Text, nullable=False)
    criteria_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    alert_frequency: Mapped[str] = mapped_column(Text, default="weekly")
    last_checked_at: Mapped[datetime | None] = mapped_column()
