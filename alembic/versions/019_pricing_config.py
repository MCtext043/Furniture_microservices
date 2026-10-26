"""Editable spreadsheet pricing configuration."""
from alembic import op
import sqlalchemy as sa

revision = "019_pricing_config"
down_revision = "018_planner_project_contacts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_shop_settings", sa.Column("pricing_config", sa.JSON(), server_default="{}", nullable=False))


def downgrade() -> None:
    op.drop_column("catalog_shop_settings", "pricing_config")
