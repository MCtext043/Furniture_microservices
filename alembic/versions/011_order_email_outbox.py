"""Durable email notifications for new orders."""
from alembic import op
import sqlalchemy as sa

revision = "011_order_email_outbox"
down_revision = "010_planner_scene_v2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "order_email_outbox",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("text_body", sa.Text(), nullable=False),
        sa.Column("html_body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_order_email_outbox_next_attempt_at", "order_email_outbox", ["next_attempt_at"])


def downgrade():
    op.drop_table("order_email_outbox")
