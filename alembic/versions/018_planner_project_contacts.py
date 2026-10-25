"""Store contact information supplied with a planner project.

Revision ID: 018_planner_project_contacts
Revises: 017_custom_order_fields
"""

from alembic import op
import sqlalchemy as sa


revision = "018_planner_project_contacts"
down_revision = "017_custom_order_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("planner_projects", sa.Column("customer_name", sa.String(length=180), nullable=True))
    op.add_column("planner_projects", sa.Column("customer_phone", sa.String(length=80), nullable=True))
    op.add_column("planner_projects", sa.Column("customer_email", sa.String(length=254), nullable=True))


def downgrade() -> None:
    op.drop_column("planner_projects", "customer_email")
    op.drop_column("planner_projects", "customer_phone")
    op.drop_column("planner_projects", "customer_name")
