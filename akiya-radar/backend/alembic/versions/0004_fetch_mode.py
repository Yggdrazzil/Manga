"""record how each listing page was fetched

Revision ID: 0004_fetch_mode
Revises: 0003_normalized
Create Date: 2026-08-13

Sources that ship an empty app shell have to be rendered in a browser before
anything can be extracted. Storing which path was taken makes a slow source
explainable, and marks the listings whose markup is the most likely to shift.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_fetch_mode"
down_revision: str | None = "0003_normalized"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column() -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(c["name"] == "fetch_mode" for c in inspector.get_columns("listings"))


def upgrade() -> None:
    if not _has_column():
        op.add_column("listings", sa.Column("fetch_mode", sa.Text(), nullable=True))


def downgrade() -> None:
    if _has_column():
        op.drop_column("listings", "fetch_mode")
