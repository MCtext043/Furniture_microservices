"""Order calendar timestamps, staff directory fields, email confirmation tokens.

Revision ID: 012_production_ops
Revises: 011_order_email_outbox
"""

from alembic import op
import sqlalchemy as sa

revision = "012_production_ops"
down_revision = "011_order_email_outbox"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_production_orders",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.add_column(
        "crm_production_orders",
        sa.Column(
            "status_changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.add_column("auth_users", sa.Column("email", sa.String(length=254), nullable=True))
    op.add_column(
        "auth_users",
        sa.Column("email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_index("ix_auth_users_email", "auth_users", ["email"], unique=True)

    op.create_table(
        "auth_email_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_auth_email_tokens_user_id", "auth_email_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_auth_email_tokens_user_id", table_name="auth_email_tokens")
    op.drop_table("auth_email_tokens")
    op.drop_index("ix_auth_users_email", table_name="auth_users")
    op.drop_column("auth_users", "email_verified")
    op.drop_column("auth_users", "email")
    op.drop_column("crm_production_orders", "status_changed_at")
    op.drop_column("crm_production_orders", "created_at")
