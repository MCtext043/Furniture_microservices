"""CRM order purchase receipts (чеки закупки).

Revision ID: 009_crm_order_receipts
Revises: 008_crm_procurement_costs
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "009_crm_order_receipts"
down_revision = "008_crm_procurement_costs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "crm_order_receipts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("note", sa.String(length=255), server_default="", nullable=False),
        sa.Column("amount_rub", sa.Numeric(12, 2), nullable=True),
        sa.Column("uploaded_by", sa.String(length=120), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["crm_production_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_crm_order_receipts_order_id",
        "crm_order_receipts",
        ["order_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_crm_order_receipts_order_id", table_name="crm_order_receipts")
    op.drop_table("crm_order_receipts")
