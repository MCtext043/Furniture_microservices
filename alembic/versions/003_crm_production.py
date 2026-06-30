"""CRM: materials, warehouse stock, production orders.

Revision ID: 003_crm
Revises: 002_delivery
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "003_crm"
down_revision = "002_delivery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "crm_materials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="шт"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_crm_materials_name", "crm_materials", ["name"])

    op.create_table(
        "crm_warehouse_stock",
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["material_id"], ["crm_materials.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("material_id"),
    )

    op.create_table(
        "crm_production_orders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("customer", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="new"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crm_production_orders_status", "crm_production_orders", ["status"])
    op.create_index("ix_crm_production_orders_title", "crm_production_orders", ["title"])

    op.create_table(
        "crm_order_materials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("required_qty", sa.Numeric(12, 2), nullable=False),
        sa.ForeignKeyConstraint(["material_id"], ["crm_materials.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["crm_production_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crm_order_materials_order_id", "crm_order_materials", ["order_id"])
    op.create_index("ix_crm_order_materials_material_id", "crm_order_materials", ["material_id"])


def downgrade() -> None:
    op.drop_table("crm_order_materials")
    op.drop_table("crm_production_orders")
    op.drop_table("crm_warehouse_stock")
    op.drop_table("crm_materials")
