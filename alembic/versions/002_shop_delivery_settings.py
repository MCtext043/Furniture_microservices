"""Shop delivery settings table.

Revision ID: 002_delivery
Revises: 001_initial
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002_delivery"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "catalog_shop_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("free_delivery_threshold", sa.Numeric(10, 2), nullable=False, server_default="3000"),
        sa.Column("delivery_price_per_km", sa.Numeric(10, 2), nullable=False, server_default="45"),
        sa.Column("warehouse_address", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("warehouse_lat", sa.Float(), nullable=True),
        sa.Column("warehouse_lon", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            "INSERT INTO catalog_shop_settings (free_delivery_threshold, delivery_price_per_km, warehouse_address) "
            "VALUES (3000, 45, 'Москва, ул. Складская, 1')"
        )
    )


def downgrade() -> None:
    op.drop_table("catalog_shop_settings")
