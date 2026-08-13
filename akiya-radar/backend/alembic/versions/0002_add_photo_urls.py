"""add photo_urls to listings

Revision ID: 0002_photo_urls
Revises: 0001_initial
Create Date: 2026-07-04

The initial migration creates tables from the live SQLAlchemy metadata, so a
fresh database already has this column — the guard makes both paths work.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0002_photo_urls"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column() -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(c["name"] == "photo_urls" for c in inspector.get_columns("listings"))


def upgrade() -> None:
    if not _has_column():
        op.add_column("listings", sa.Column("photo_urls", JSONB(), nullable=True))


def downgrade() -> None:
    if _has_column():
        op.drop_column("listings", "photo_urls")
