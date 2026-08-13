"""initial schema with PostGIS

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-27

Creates the PostGIS extension and all core tables. The schema is built from the
SQLAlchemy metadata so it stays in lock-step with the ORM models (including the
GeoAlchemy2 geography column and its spatial index).
"""

from collections.abc import Sequence

# Ensure all models are registered on the metadata.
import app.models  # noqa: F401
from alembic import op
from app.database import Base

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
