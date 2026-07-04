"""Selected pricing tier on planner projects and CRM orders.

Revision ID: 006_selected_tier
Revises: 005_cutting_job_result
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "006_selected_tier"
down_revision = "005_cutting_job_result"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "planner_projects",
        sa.Column("selected_tier", sa.String(length=16), server_default="standard", nullable=False),
    )
    op.add_column(
        "crm_production_orders",
        sa.Column("selected_tier", sa.String(length=16), server_default="standard", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("crm_production_orders", "selected_tier")
    op.drop_column("planner_projects", "selected_tier")
