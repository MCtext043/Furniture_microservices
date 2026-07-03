"""Store full cutting result JSON on jobs.

Revision ID: 005_cutting_job_result
Revises: 004_workflow
Create Date: 2026-07-03
"""

from alembic import op
import sqlalchemy as sa

revision = "005_cutting_job_result"
down_revision = "004_workflow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cutting_jobs", sa.Column("result_json", sa.Text(), server_default="", nullable=False))


def downgrade() -> None:
    op.drop_column("cutting_jobs", "result_json")
