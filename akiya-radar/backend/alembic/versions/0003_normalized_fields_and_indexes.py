"""normalised listing fields, provenance and the missing indexes

Revision ID: 0003_normalized
Revises: 0002_photo_urls
Create Date: 2026-08-13

Two changes:

1. Columns for the canonical fields harvested from real sources (zoning,
   station, elevation, rent kept apart from sale price…) plus provenance and a
   completeness score.
2. The indexes the schema never had. Every listing filter — prefecture, city,
   price, status, favourite — was a sequential scan, and each ``selectinload``
   of flags/scores/notes scanned the whole child table.

Like 0002, a fresh database is created from live metadata, so each step is
guarded to keep both paths working.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0003_normalized"
down_revision: str | None = "0002_photo_urls"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_COLUMNS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("source_key", sa.Text()),
    ("rent_yen_month", sa.Numeric()),
    ("zoning", sa.Text()),
    ("structure", sa.Text()),
    ("land_rights", sa.Text()),
    ("parking", sa.Text()),
    ("current_state", sa.Text()),
    ("features", JSONB()),
    ("utilities", JSONB()),
    ("station_name", sa.Text()),
    ("station_line", sa.Text()),
    ("station_walk_minutes", sa.Integer()),
    ("station_distance_km", sa.Numeric()),
    ("elevation_m", sa.Numeric()),
    ("data_completeness", sa.Integer()),
    ("field_provenance", JSONB()),
)

SINGLE_INDEXES: tuple[tuple[str, str, str], ...] = (
    ("ix_listings_source_id", "listings", "source_id"),
    ("ix_listings_source_key", "listings", "source_key"),
    ("ix_listings_price_yen", "listings", "price_yen"),
    ("ix_listings_prefecture", "listings", "prefecture"),
    ("ix_listings_city", "listings", "city"),
    ("ix_listings_land_area_m2", "listings", "land_area_m2"),
    ("ix_listings_property_type", "listings", "property_type"),
    ("ix_listings_transaction_type", "listings", "transaction_type"),
    ("ix_listings_personal_status", "listings", "personal_status"),
    ("ix_listings_favorite", "listings", "favorite"),
    ("ix_listing_flags_listing_id", "listing_flags", "listing_id"),
    ("ix_listing_scores_listing_id", "listing_scores", "listing_id"),
    ("ix_price_history_listing_id", "price_history", "listing_id"),
    ("ix_listing_notes_listing_id", "listing_notes", "listing_id"),
    ("ix_listing_tasks_listing_id", "listing_tasks", "listing_id"),
    ("ix_hazard_scores_listing_id", "hazard_scores", "listing_id"),
)

COMPOSITE_INDEXES: tuple[tuple[str, str, list[str]], ...] = (
    ("ix_listings_prefecture_city", "listings", ["prefecture", "city"]),
    ("ix_listings_status_created", "listings", ["listing_status", "created_at"]),
)


def _existing_columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {c["name"] for c in inspector.get_columns(table)}


def _existing_indexes(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {i["name"] for i in inspector.get_indexes(table)}


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    present = _existing_columns("listings")
    for name, type_ in NEW_COLUMNS:
        if name not in present:
            op.add_column("listings", sa.Column(name, type_, nullable=True))

    tables = _tables()
    for index_name, table, column in SINGLE_INDEXES:
        if table not in tables or index_name in _existing_indexes(table):
            continue
        op.create_index(index_name, table, [column])

    for index_name, table, columns in COMPOSITE_INDEXES:
        if table not in tables or index_name in _existing_indexes(table):
            continue
        op.create_index(index_name, table, columns)


def downgrade() -> None:
    tables = _tables()
    for index_name, table, _ in COMPOSITE_INDEXES:
        if table in tables and index_name in _existing_indexes(table):
            op.drop_index(index_name, table_name=table)
    for index_name, table, _ in SINGLE_INDEXES:
        if table in tables and index_name in _existing_indexes(table):
            op.drop_index(index_name, table_name=table)

    present = _existing_columns("listings")
    for name, _ in NEW_COLUMNS:
        if name in present:
            op.drop_column("listings", name)
