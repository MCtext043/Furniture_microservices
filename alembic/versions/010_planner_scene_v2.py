"""Planner scene v2 with stable placement identity and revisioning.

Revision ID: 010_planner_scene_v2
Revises: 009_crm_order_receipts
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "010_planner_scene_v2"
down_revision = "009_crm_order_receipts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("planner_projects", sa.Column("schema_version", sa.Integer(), server_default="2", nullable=False))
    op.add_column("planner_projects", sa.Column("scene_revision", sa.Integer(), server_default="0", nullable=False))
    op.add_column("planner_projects", sa.Column("room_finish_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False))
    op.add_column("planner_projects", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("planner_furniture", sa.Column("client_id", sa.String(64), nullable=True))
    op.add_column("planner_furniture", sa.Column("definition_id", sa.String(120), server_default="legacy.cabinet.v1", nullable=False))
    op.add_column("planner_furniture", sa.Column("definition_version", sa.Integer(), server_default="1", nullable=False))
    op.add_column("planner_furniture", sa.Column("configuration_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False))
    op.add_column("planner_furniture", sa.Column("appearance_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False))
    op.add_column("planner_furniture", sa.Column("renderer_mode", sa.String(24), server_default="parametric", nullable=False))
    op.add_column("planner_furniture", sa.Column("model_asset_key", sa.String(255), nullable=True))
    op.add_column("planner_furniture", sa.Column("model_version", sa.Integer(), nullable=True))
    op.add_column("planner_furniture", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE planner_furniture SET client_id = 'legacy-' || id::text WHERE client_id IS NULL")
    op.alter_column("planner_furniture", "client_id", nullable=False)
    op.create_index("ix_planner_furniture_client_id", "planner_furniture", ["client_id"])
    op.create_unique_constraint("uq_planner_furniture_project_client", "planner_furniture", ["project_id", "client_id"])


def downgrade() -> None:
    op.drop_constraint("uq_planner_furniture_project_client", "planner_furniture", type_="unique")
    op.drop_index("ix_planner_furniture_client_id", table_name="planner_furniture")
    for column in ["updated_at", "model_version", "model_asset_key", "renderer_mode", "appearance_json", "configuration_json", "definition_version", "definition_id", "client_id"]:
        op.drop_column("planner_furniture", column)
    for column in ["updated_at", "room_finish_json", "scene_revision", "schema_version"]:
        op.drop_column("planner_projects", column)
