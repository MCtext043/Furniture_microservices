"""Initial schema: catalog, cutting, planner, auth.

Revision ID: 001_initial
Revises:
Create Date: 2026-05-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=255), server_default="", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "auth_users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("roles", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="uq_auth_users_username"),
    )
    op.create_index("ix_auth_users_id", "auth_users", ["id"], unique=False)
    op.create_index("ix_auth_users_username", "auth_users", ["username"], unique=False)

    op.create_table(
        "catalog_categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.ForeignKeyConstraint(["parent_id"], ["catalog_categories.id"]),
    )
    op.create_index("ix_catalog_categories_id", "catalog_categories", ["id"], unique=False)
    op.create_index("ix_catalog_categories_name", "catalog_categories", ["name"], unique=False)

    op.create_table(
        "catalog_products",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("brand", sa.String(length=120), server_default="", nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("stock", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sku"),
        sa.ForeignKeyConstraint(["category_id"], ["catalog_categories.id"]),
    )
    op.create_index("ix_catalog_products_id", "catalog_products", ["id"], unique=False)
    op.create_index("ix_catalog_products_name", "catalog_products", ["name"], unique=False)
    op.create_index("ix_catalog_products_sku", "catalog_products", ["sku"], unique=False)

    op.create_table(
        "catalog_product_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("author_name", sa.String(length=120), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), server_default="", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["catalog_products.id"]),
    )
    op.create_index(
        "ix_catalog_product_reviews_product_id",
        "catalog_product_reviews",
        ["product_id"],
        unique=False,
    )

    op.create_table(
        "catalog_cart_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=80), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["catalog_products.id"]),
        sa.UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),
    )
    op.create_index("ix_catalog_cart_items_product_id", "catalog_cart_items", ["product_id"], unique=False)
    op.create_index("ix_catalog_cart_items_user_id", "catalog_cart_items", ["user_id"], unique=False)

    op.create_table(
        "catalog_wishlist_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=80), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["catalog_products.id"]),
        sa.UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),
    )
    op.create_index(
        "ix_catalog_wishlist_items_product_id", "catalog_wishlist_items", ["product_id"], unique=False
    )
    op.create_index(
        "ix_catalog_wishlist_items_user_id", "catalog_wishlist_items", ["user_id"], unique=False
    )

    op.create_table(
        "cutting_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sheet_width", sa.Integer(), nullable=False),
        sa.Column("sheet_height", sa.Integer(), nullable=False),
        sa.Column("parts_count", sa.Integer(), nullable=False),
        sa.Column("placed_count", sa.Integer(), nullable=False),
        sa.Column("utilization_percent", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cutting_jobs_id", "cutting_jobs", ["id"], unique=False)

    op.create_table(
        "planner_projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("location", sa.String(length=180), server_default="", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_planner_projects_id", "planner_projects", ["id"], unique=False)

    op.create_table(
        "planner_furniture",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("depth", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column("x", sa.Float(), server_default="0", nullable=False),
        sa.Column("y", sa.Float(), server_default="0", nullable=False),
        sa.Column("z", sa.Float(), server_default="0", nullable=False),
        sa.Column("rotation_y", sa.Float(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["planner_projects.id"]),
    )
    op.create_index("ix_planner_furniture_project_id", "planner_furniture", ["project_id"], unique=False)
    op.create_index("ix_planner_furniture_id", "planner_furniture", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("planner_furniture")
    op.drop_table("planner_projects")
    op.drop_table("cutting_jobs")
    op.drop_table("catalog_wishlist_items")
    op.drop_table("catalog_cart_items")
    op.drop_table("catalog_product_reviews")
    op.drop_table("catalog_products")
    op.drop_table("catalog_categories")
    op.drop_table("auth_users")
    op.drop_table("auth_roles")
