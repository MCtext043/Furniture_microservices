"""Shop SBP payments (Elplat).

Revision ID: 014_shop_sbp_payments
Revises: 013_crm_admin_order_fields
"""

from alembic import op
import sqlalchemy as sa

revision = "014_shop_sbp_payments"
down_revision = "013_crm_admin_order_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shop_sbp_payments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=80), nullable=True),
        sa.Column("customer_name", sa.String(length=120), server_default="", nullable=False),
        sa.Column("email", sa.String(length=120), server_default="", nullable=False),
        sa.Column("amount_rub", sa.Numeric(12, 2), nullable=False),
        sa.Column("amount_kopecks", sa.Integer(), nullable=False),
        sa.Column("payment_purpose", sa.String(length=140), server_default="", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("qrc_id", sa.String(length=64), server_default="", nullable=False),
        sa.Column("qr_data", sa.Text(), server_default="", nullable=False),
        sa.Column("ebl27", sa.String(length=64), server_default="", nullable=False),
        sa.Column("pay_phone", sa.String(length=32), server_default="", nullable=False),
        sa.Column("trx_status", sa.String(length=32), server_default="", nullable=False),
        sa.Column("callback_payload", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shop_sbp_payments_user_id", "shop_sbp_payments", ["user_id"])
    op.create_index("ix_shop_sbp_payments_status", "shop_sbp_payments", ["status"])
    op.create_index("ix_shop_sbp_payments_qrc_id", "shop_sbp_payments", ["qrc_id"])


def downgrade() -> None:
    op.drop_index("ix_shop_sbp_payments_qrc_id", table_name="shop_sbp_payments")
    op.drop_index("ix_shop_sbp_payments_status", table_name="shop_sbp_payments")
    op.drop_index("ix_shop_sbp_payments_user_id", table_name="shop_sbp_payments")
    op.drop_table("shop_sbp_payments")
