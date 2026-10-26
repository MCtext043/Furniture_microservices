"""Store the production assembly price visible to assembler staff."""
from alembic import op
import sqlalchemy as sa

revision = "020_assembler_price"
down_revision = "019_pricing_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_production_orders", sa.Column("price_assembler", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("crm_production_orders", "price_assembler")
