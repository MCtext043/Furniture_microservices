from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class OrderEmail(Base):
    __tablename__ = "order_email_outbox"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(Integer, unique=True)
    subject: Mapped[str] = mapped_column(String(255))
    text_body: Mapped[str] = mapped_column(Text)
    html_body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)


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
    photos: Mapped[list["ProductPhoto"]] = relationship(back_populates="product", order_by="ProductPhoto.sort_order")


class ProductPhoto(Base):
    __tablename__ = "catalog_product_photos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("catalog_products.id", ondelete="CASCADE"), index=True)
    object_key: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="photos")


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
    purchase_price_rub: Mapped[float] = mapped_column(Numeric(12, 2), default=0)


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
    status: Mapped[str] = mapped_column(String(32), default="черновой замер", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    planner_project_id: Mapped[int | None] = mapped_column(index=True, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    price_standard: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    price_comfort: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    price_premium: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    selected_tier: Mapped[str] = mapped_column(String(16), default="standard")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Admin / production card fields (empty until admin fills)
    customer_full_name: Mapped[str] = mapped_column(String(180), default="")
    signature_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    price_admin: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    advance_paid: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    balance_due: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    email: Mapped[str] = mapped_column(String(254), default="")
    phone: Mapped[str] = mapped_column(String(80), default="")
    install_address: Mapped[str] = mapped_column(String(255), default="")
    color_corpus: Mapped[str] = mapped_column(String(120), default="")
    color_facade_1: Mapped[str] = mapped_column(String(120), default="")
    color_facade_2: Mapped[str] = mapped_column(String(120), default="")
    color_facade_3: Mapped[str] = mapped_column(String(120), default="")
    visible_parts: Mapped[str] = mapped_column(String(120), default="")
    guides: Mapped[str] = mapped_column(String(120), default="")
    hinges: Mapped[str] = mapped_column(String(120), default="")
    mirror: Mapped[str] = mapped_column(String(120), default="")
    countertop: Mapped[str] = mapped_column(String(120), default="")
    apron: Mapped[str] = mapped_column(String(120), default="")
    gola_profile: Mapped[str] = mapped_column(String(120), default="")
    plinth: Mapped[str] = mapped_column(String(120), default="")
    false_panel: Mapped[str] = mapped_column(String(120), default="")
    light_inset: Mapped[str] = mapped_column(String(120), default="")
    light_overlay: Mapped[str] = mapped_column(String(120), default="")
    euro_cut: Mapped[str] = mapped_column(String(120), default="")
    cutlery_tray: Mapped[str] = mapped_column(String(120), default="")
    vent_grille: Mapped[str] = mapped_column(String(120), default="")
    handles: Mapped[str] = mapped_column(String(120), default="")


class CrmFieldOption(Base):
    """Editable dictionaries for admin order fields."""

    __tablename__ = "crm_field_options"
    __table_args__ = (UniqueConstraint("field_key", "value", name="uq_crm_field_options_key_value"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    field_key: Mapped[str] = mapped_column(String(64), index=True)
    value: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CrmOrderPhoto(Base):
    __tablename__ = "crm_order_photos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("crm_production_orders.id"), index=True)
    object_key: Mapped[str] = mapped_column(String(255))
    caption: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    order: Mapped[CrmProductionOrder] = relationship()


class CrmOrderReceipt(Base):
    """Photo of a purchase receipt uploaded by one admin so another can verify the buy."""

    __tablename__ = "crm_order_receipts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("crm_production_orders.id", ondelete="CASCADE"), index=True)
    object_key: Mapped[str] = mapped_column(String(255))
    note: Mapped[str] = mapped_column(String(255), default="")
    amount_rub: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    uploaded_by: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    order: Mapped[CrmProductionOrder] = relationship()


class CrmOrderMaterial(Base):
    __tablename__ = "crm_order_materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("crm_production_orders.id"), index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("crm_materials.id"), index=True)
    required_qty: Mapped[float] = mapped_column(Numeric(12, 2))

    material: Mapped[CrmMaterial] = relationship()
    order: Mapped[CrmProductionOrder] = relationship()


class CrmOrderProcurement(Base):
    __tablename__ = "crm_order_procurements"
    __table_args__ = (
        UniqueConstraint("order_id", "material_id", name="uq_crm_order_procurement_order_material"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("crm_production_orders.id", ondelete="CASCADE"), index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("crm_materials.id", ondelete="CASCADE"), index=True)

    to_buy_qty: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    unit_price_rub: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    purchased_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    is_purchased: Mapped[bool] = mapped_column(Boolean, default=False)

    material: Mapped[CrmMaterial] = relationship()
    order: Mapped[CrmProductionOrder] = relationship()
