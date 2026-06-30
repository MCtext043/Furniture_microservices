from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    parent_id: int | None = None


class CategoryOut(CategoryCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    parent_id: int | None = None


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    sku: str = Field(min_length=2, max_length=64)
    brand: str = Field(default="", max_length=120)
    description: str = ""
    price: float = Field(gt=0)
    category_id: int | None = None
    stock: int = Field(ge=0)
    is_active: bool = True


class ProductOut(ProductCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    brand: str | None = Field(default=None, max_length=120)
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    category_id: int | None = None
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ReviewCreate(BaseModel):
    author_name: str = Field(min_length=2, max_length=120)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReviewOut(ReviewCreate):
    id: int
    product_id: int
    model_config = ConfigDict(from_attributes=True)


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(gt=0, le=999)


class CartItemOut(BaseModel):
    id: int
    user_id: str
    product_id: int
    quantity: int
    model_config = ConfigDict(from_attributes=True)


class WishlistItemOut(BaseModel):
    id: int
    user_id: str
    product_id: int
    model_config = ConfigDict(from_attributes=True)


class ProductFiltersOut(BaseModel):
    min_price: float
    max_price: float
    brands: list[str]


class DeliverySettingsOut(BaseModel):
    free_delivery_threshold: float
    delivery_price_per_km: float
    warehouse_address: str
    warehouse_lat: float | None = None
    warehouse_lon: float | None = None


class DeliverySettingsPublicOut(BaseModel):
    free_delivery_threshold: float
    delivery_price_per_km: float


class DeliverySettingsUpdate(BaseModel):
    free_delivery_threshold: float = Field(gt=0)
    delivery_price_per_km: float = Field(ge=0)
    warehouse_address: str = Field(min_length=5, max_length=500)


class DeliveryQuoteRequest(BaseModel):
    address: str = Field(min_length=5, max_length=500)
    subtotal: float = Field(ge=0)


class DeliveryQuoteOut(BaseModel):
    subtotal: float
    delivery_fee: float
    distance_km: float
    free_delivery: bool
    free_delivery_threshold: float
    delivery_price_per_km: float
    amount_until_free_delivery: float
    grand_total: float


class CrmMaterialCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    unit: str = Field(default="шт", max_length=20)


class CrmMaterialUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    unit: str | None = Field(default=None, max_length=20)


class CrmMaterialOut(CrmMaterialCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class CrmWarehouseStockOut(BaseModel):
    material_id: int
    material_name: str
    unit: str
    quantity: float


class CrmWarehouseStockUpdate(BaseModel):
    quantity: float = Field(ge=0)


class CrmOrderMaterialLineIn(BaseModel):
    material_id: int
    required_qty: float = Field(gt=0)


class CrmOrderMaterialLine(CrmOrderMaterialLineIn):
    material_name: str
    unit: str


class CrmOrderCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    customer: str = Field(default="", max_length=120)
    status: str = Field(default="new", max_length=32)
    notes: str = ""
    materials: list[CrmOrderMaterialLineIn] = Field(min_length=1)


class CrmOrderOut(BaseModel):
    id: int
    title: str
    customer: str
    status: str
    notes: str
    materials: list[CrmOrderMaterialLine]


class CrmProcurementLine(BaseModel):
    material_id: int
    material_name: str
    unit: str
    required_qty: float
    in_stock_qty: float
    to_buy_qty: float


class CrmOrderProcurementOut(BaseModel):
    order_id: int
    title: str
    customer: str
    status: str
    lines: list[CrmProcurementLine]
