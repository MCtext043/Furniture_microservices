"""Warehouse ledger and issued quantity on order materials.

Revision ID: 015_crm_stock_movements
Revises: 014_shop_sbp_payments
"""

from alembic import op
import sqlalchemy as sa


revision = "015_crm_stock_movements"
down_revision = "014_shop_sbp_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_order_materials",
        sa.Column("issued_qty", sa.Numeric(12, 2), server_default="0", nullable=False),
    )
    op.create_table(
        "crm_stock_movements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("delta", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantity_after", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("note", sa.String(length=255), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["material_id"], ["crm_materials.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["crm_production_orders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crm_stock_movements_material_id", "crm_stock_movements", ["material_id"])
    op.create_index("ix_crm_stock_movements_kind", "crm_stock_movements", ["kind"])
    op.create_index("ix_crm_stock_movements_order_id", "crm_stock_movements", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_crm_stock_movements_order_id", table_name="crm_stock_movements")
    op.drop_index("ix_crm_stock_movements_kind", table_name="crm_stock_movements")
    op.drop_index("ix_crm_stock_movements_material_id", table_name="crm_stock_movements")
    op.drop_table("crm_stock_movements")
    op.drop_column("crm_order_materials", "issued_qty")
