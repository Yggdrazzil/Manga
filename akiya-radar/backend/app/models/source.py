from datetime import datetime

from sqlalchemy import Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class Source(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sources"

    name: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    base_url: Mapped[str | None] = mapped_column(Text)
    municipality: Mapped[str | None] = mapped_column(Text)
    prefecture: Mapped[str | None] = mapped_column(Text)
    crawl_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    crawl_frequency_days: Mapped[int] = mapped_column(Integer, default=7)
    robots_txt_checked_at: Mapped[datetime | None] = mapped_column()
    terms_note: Mapped[str | None] = mapped_column(Text)
    last_crawled_at: Mapped[datetime | None] = mapped_column()
    last_error: Mapped[str | None] = mapped_column(Text)

    listings: Mapped[list["Listing"]] = relationship(  # noqa: F821
        back_populates="source"
    )
