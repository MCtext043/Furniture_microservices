"""CRM procurement overrides, prices, and progress.

Revision ID: 008_crm_procurement_costs
Revises: 007_product_photos
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "008_crm_procurement_costs"
down_revision = "007_product_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_materials",
        sa.Column("purchase_price_rub", sa.Numeric(12, 2), server_default="0", nullable=False),
    )

    op.create_table(
        "crm_order_procurements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("to_buy_qty", sa.Numeric(12, 2), nullable=True),
        sa.Column("unit_price_rub", sa.Numeric(12, 2), nullable=True),
        sa.Column("purchased_qty", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("is_purchased", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["material_id"], ["crm_materials.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["crm_production_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", "material_id", name="uq_crm_order_procurement_order_material"),
    )
    op.create_index(
        "ix_crm_order_procurements_order_id",
        "crm_order_procurements",
        ["order_id"],
    )
    op.create_index(
        "ix_crm_order_procurements_material_id",
        "crm_order_procurements",
        ["material_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_crm_order_procurements_material_id", table_name="crm_order_procurements")
    op.drop_index("ix_crm_order_procurements_order_id", table_name="crm_order_procurements")
    op.drop_table("crm_order_procurements")
    op.drop_column("crm_materials", "purchase_price_rub")

