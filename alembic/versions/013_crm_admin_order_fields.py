"""CRM admin order card fields and editable field dictionaries.

Revision ID: 013_crm_admin_order_fields
Revises: 012_production_ops
"""

from alembic import op
import sqlalchemy as sa

revision = "013_crm_admin_order_fields"
down_revision = "012_production_ops"
branch_labels = None
depends_on = None


ADMIN_COLUMNS = [
    ("customer_full_name", sa.String(180), ""),
    ("signature_date", sa.Date(), None),
    ("delivery_date", sa.Date(), None),
    ("price_admin", sa.Numeric(12, 2), None),
    ("advance_paid", sa.Numeric(12, 2), None),
    ("balance_due", sa.Numeric(12, 2), None),
    ("email", sa.String(254), ""),
    ("phone", sa.String(80), ""),
    ("install_address", sa.String(255), ""),
    ("color_corpus", sa.String(120), ""),
    ("color_facade_1", sa.String(120), ""),
    ("color_facade_2", sa.String(120), ""),
    ("color_facade_3", sa.String(120), ""),
    ("visible_parts", sa.String(120), ""),
    ("guides", sa.String(120), ""),
    ("hinges", sa.String(120), ""),
    ("mirror", sa.String(120), ""),
    ("countertop", sa.String(120), ""),
    ("apron", sa.String(120), ""),
    ("gola_profile", sa.String(120), ""),
    ("plinth", sa.String(120), ""),
    ("false_panel", sa.String(120), ""),
    ("light_inset", sa.String(120), ""),
    ("light_overlay", sa.String(120), ""),
    ("euro_cut", sa.String(120), ""),
    ("cutlery_tray", sa.String(120), ""),
    ("vent_grille", sa.String(120), ""),
    ("handles", sa.String(120), ""),
]


def upgrade() -> None:
    for name, col_type, server_default in ADMIN_COLUMNS:
        kwargs = {"nullable": True if server_default is None else False}
        if server_default is not None:
            kwargs["server_default"] = sa.text(f"'{server_default}'")
            kwargs["nullable"] = False
        op.add_column("crm_production_orders", sa.Column(name, col_type, **kwargs))

    op.create_index("ix_crm_production_orders_delivery_date", "crm_production_orders", ["delivery_date"])

    op.create_table(
        "crm_field_options",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("field_key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("field_key", "value", name="uq_crm_field_options_key_value"),
    )
    op.create_index("ix_crm_field_options_field_key", "crm_field_options", ["field_key"])


def downgrade() -> None:
    op.drop_index("ix_crm_field_options_field_key", table_name="crm_field_options")
    op.drop_table("crm_field_options")
    op.drop_index("ix_crm_production_orders_delivery_date", table_name="crm_production_orders")
    for name, _, _ in reversed(ADMIN_COLUMNS):
        op.drop_column("crm_production_orders", name)
