"""Product photos for catalog items.

Revision ID: 007_product_photos
Revises: 006_selected_tier
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "007_product_photos"
down_revision = "006_selected_tier"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "catalog_product_photos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["catalog_products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_catalog_product_photos_product_id", "catalog_product_photos", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_catalog_product_photos_product_id", table_name="catalog_product_photos")
    op.drop_table("catalog_product_photos")
