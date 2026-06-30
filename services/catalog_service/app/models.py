from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Category(Base):
    __tablename__ = "catalog_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("catalog_categories.id"))


class Product(Base):
    __tablename__ = "catalog_products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    brand: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("catalog_categories.id"))
    stock: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[Category | None] = relationship()


class ProductReview(Base):
    __tablename__ = "catalog_product_reviews"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("catalog_products.id"), index=True)
    author_name: Mapped[str] = mapped_column(String(120))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")


class CartItem(Base):
    __tablename__ = "catalog_cart_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(80), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("catalog_products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)


class WishlistItem(Base):
    __tablename__ = "catalog_wishlist_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(80), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("catalog_products.id"), index=True)


class ShopSettings(Base):
    """Singleton shop configuration (first row is used)."""

    __tablename__ = "catalog_shop_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    free_delivery_threshold: Mapped[float] = mapped_column(Numeric(10, 2), default=3000)
    delivery_price_per_km: Mapped[float] = mapped_column(Numeric(10, 2), default=45)
    warehouse_address: Mapped[str] = mapped_column(String(500), default="")
    warehouse_lat: Mapped[float | None] = mapped_column(nullable=True)
    warehouse_lon: Mapped[float | None] = mapped_column(nullable=True)


class CrmMaterial(Base):
    __tablename__ = "crm_materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    unit: Mapped[str] = mapped_column(String(20), default="шт")


class CrmWarehouseStock(Base):
    __tablename__ = "crm_warehouse_stock"

    material_id: Mapped[int] = mapped_column(ForeignKey("crm_materials.id"), primary_key=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    material: Mapped[CrmMaterial] = relationship()


class CrmProductionOrder(Base):
    __tablename__ = "crm_production_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    customer: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")


class CrmOrderMaterial(Base):
    __tablename__ = "crm_order_materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("crm_production_orders.id"), index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("crm_materials.id"), index=True)
    required_qty: Mapped[float] = mapped_column(Numeric(12, 2))

    material: Mapped[CrmMaterial] = relationship()
    order: Mapped[CrmProductionOrder] = relationship()
