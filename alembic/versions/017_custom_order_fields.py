"""Admin-defined order dictionary fields.

Revision ID: 017_custom_order_fields
Revises: 016_stage_reminders
"""

from alembic import op
import sqlalchemy as sa


revision = "017_custom_order_fields"
down_revision = "016_stage_reminders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_production_orders",
        sa.Column("custom_fields", sa.JSON(), server_default="{}", nullable=False),
    )
    op.create_table(
        "crm_custom_fields",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("field_key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("field_key"),
    )
    op.create_index("ix_crm_custom_fields_field_key", "crm_custom_fields", ["field_key"])


def downgrade() -> None:
    op.drop_index("ix_crm_custom_fields_field_key", table_name="crm_custom_fields")
    op.drop_table("crm_custom_fields")
    op.drop_column("crm_production_orders", "custom_fields")
