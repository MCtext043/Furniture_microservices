"""Stage working-day deadlines and the reminder outbox.

Revision ID: 016_stage_reminders
Revises: 015_crm_stock_movements
"""

from alembic import op
import sqlalchemy as sa


revision = "016_stage_reminders"
down_revision = "015_crm_stock_movements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_production_orders",
        sa.Column("stage_workdays", sa.JSON(), server_default="{}", nullable=False),
    )
    op.add_column(
        "catalog_shop_settings",
        sa.Column("stage_alert_lead_days", sa.Integer(), server_default="2", nullable=False),
    )
    op.create_table(
        "crm_stage_reminders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("stage", sa.String(length=64), nullable=False),
        sa.Column("deadline_on", sa.Date(), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("text_body", sa.Text(), nullable=False),
        sa.Column("html_body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["crm_production_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", "stage", name="uq_crm_stage_reminder_order_stage"),
    )
    op.create_index("ix_crm_stage_reminders_order_id", "crm_stage_reminders", ["order_id"])
    op.create_index("ix_crm_stage_reminders_next_attempt_at", "crm_stage_reminders", ["next_attempt_at"])


def downgrade() -> None:
    op.drop_index("ix_crm_stage_reminders_next_attempt_at", table_name="crm_stage_reminders")
    op.drop_index("ix_crm_stage_reminders_order_id", table_name="crm_stage_reminders")
    op.drop_table("crm_stage_reminders")
    op.drop_column("catalog_shop_settings", "stage_alert_lead_days")
    op.drop_column("crm_production_orders", "stage_workdays")
