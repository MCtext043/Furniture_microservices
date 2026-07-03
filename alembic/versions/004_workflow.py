"""Planner workflow + CRM photos and production statuses.

Revision ID: 004_workflow
Revises: 003_crm
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "004_workflow"
down_revision = "003_crm"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("planner_projects", sa.Column("user_id", sa.String(length=64), nullable=True))
    op.add_column("planner_projects", sa.Column("status", sa.String(length=32), server_default="draft", nullable=False))
    op.add_column("planner_projects", sa.Column("room_width", sa.Float(), server_default="6000", nullable=False))
    op.add_column("planner_projects", sa.Column("room_length", sa.Float(), server_default="5000", nullable=False))
    op.add_column("planner_projects", sa.Column("room_height", sa.Float(), server_default="2800", nullable=False))
    op.add_column("planner_projects", sa.Column("price_standard", sa.Numeric(12, 2), nullable=True))
    op.add_column("planner_projects", sa.Column("price_comfort", sa.Numeric(12, 2), nullable=True))
    op.add_column("planner_projects", sa.Column("price_premium", sa.Numeric(12, 2), nullable=True))
    op.add_column("planner_projects", sa.Column("bom_json", sa.Text(), server_default="", nullable=False))
    op.add_column("planner_projects", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_planner_projects_user_id", "planner_projects", ["user_id"])
    op.create_index("ix_planner_projects_status", "planner_projects", ["status"])

    op.add_column("planner_furniture", sa.Column("furniture_type", sa.String(length=32), server_default="cabinet", nullable=False))
    op.add_column("planner_furniture", sa.Column("texture", sa.String(length=64), server_default="wood_oak", nullable=False))
    op.add_column("planner_furniture", sa.Column("custom_color", sa.String(length=16), server_default="", nullable=False))
    op.add_column("planner_furniture", sa.Column("drawers", sa.Integer(), server_default="0", nullable=False))
    op.add_column("planner_furniture", sa.Column("handles", sa.Integer(), server_default="0", nullable=False))

    op.add_column("crm_production_orders", sa.Column("planner_project_id", sa.Integer(), nullable=True))
    op.add_column("crm_production_orders", sa.Column("user_id", sa.String(length=64), nullable=True))
    op.add_column("crm_production_orders", sa.Column("price_standard", sa.Numeric(12, 2), nullable=True))
    op.add_column("crm_production_orders", sa.Column("price_comfort", sa.Numeric(12, 2), nullable=True))
    op.add_column("crm_production_orders", sa.Column("price_premium", sa.Numeric(12, 2), nullable=True))
    op.create_index("ix_crm_production_orders_planner_project_id", "crm_production_orders", ["planner_project_id"])
    op.create_index("ix_crm_production_orders_user_id", "crm_production_orders", ["user_id"])

    op.create_table(
        "crm_order_photos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(length=255), nullable=False),
        sa.Column("caption", sa.String(length=255), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["crm_production_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crm_order_photos_order_id", "crm_order_photos", ["order_id"])


def downgrade() -> None:
    op.drop_table("crm_order_photos")
    op.drop_index("ix_crm_production_orders_user_id", table_name="crm_production_orders")
    op.drop_index("ix_crm_production_orders_planner_project_id", table_name="crm_production_orders")
    op.drop_column("crm_production_orders", "price_premium")
    op.drop_column("crm_production_orders", "price_comfort")
    op.drop_column("crm_production_orders", "price_standard")
    op.drop_column("crm_production_orders", "user_id")
    op.drop_column("crm_production_orders", "planner_project_id")

    op.drop_column("planner_furniture", "handles")
    op.drop_column("planner_furniture", "drawers")
    op.drop_column("planner_furniture", "custom_color")
    op.drop_column("planner_furniture", "texture")
    op.drop_column("planner_furniture", "furniture_type")

    op.drop_index("ix_planner_projects_status", table_name="planner_projects")
    op.drop_index("ix_planner_projects_user_id", table_name="planner_projects")
    op.drop_column("planner_projects", "submitted_at")
    op.drop_column("planner_projects", "bom_json")
    op.drop_column("planner_projects", "price_premium")
    op.drop_column("planner_projects", "price_comfort")
    op.drop_column("planner_projects", "price_standard")
    op.drop_column("planner_projects", "room_height")
    op.drop_column("planner_projects", "room_length")
    op.drop_column("planner_projects", "room_width")
    op.drop_column("planner_projects", "status")
    op.drop_column("planner_projects", "user_id")
