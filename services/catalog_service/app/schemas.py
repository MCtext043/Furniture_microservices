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


class ProductPhotoCreate(BaseModel):
    object_key: str = Field(min_length=3, max_length=255)
    sort_order: int = Field(default=0, ge=0)


class ProductPhotoOut(ProductPhotoCreate):
    id: int
    product_id: int
    model_config = ConfigDict(from_attributes=True)


class ProductOut(ProductCreate):
    id: int
    photos: list[ProductPhotoOut] = []
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
    purchase_price_rub: float = Field(default=0, ge=0)


class CrmMaterialUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    unit: str | None = Field(default=None, max_length=20)
    purchase_price_rub: float | None = Field(default=None, ge=0)


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
    material_id: int | None = None
    material_name: str | None = Field(default=None, min_length=2, max_length=120)
    unit: str | None = Field(default=None, max_length=20)
    required_qty: float = Field(gt=0)


class CrmOrderMaterialLine(CrmOrderMaterialLineIn):
    material_name: str
    unit: str


class CrmOrderAdminFields(BaseModel):
    customer_full_name: str = Field(default="", max_length=180)
    signature_date: str | None = Field(default=None, description="YYYY-MM-DD")
    delivery_date: str | None = Field(default=None, description="YYYY-MM-DD")
    price_admin: float | None = Field(default=None, ge=0)
    advance_paid: float | None = Field(default=None, ge=0)
    balance_due: float | None = Field(default=None)
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=80)
    install_address: str = Field(default="", max_length=255)
    color_corpus: str = Field(default="", max_length=120)
    color_facade_1: str = Field(default="", max_length=120)
    color_facade_2: str = Field(default="", max_length=120)
    color_facade_3: str = Field(default="", max_length=120)
    visible_parts: str = Field(default="", max_length=120)
    guides: str = Field(default="", max_length=120)
    hinges: str = Field(default="", max_length=120)
    mirror: str = Field(default="", max_length=120)
    countertop: str = Field(default="", max_length=120)
    apron: str = Field(default="", max_length=120)
    gola_profile: str = Field(default="", max_length=120)
    plinth: str = Field(default="", max_length=120)
    false_panel: str = Field(default="", max_length=120)
    light_inset: str = Field(default="", max_length=120)
    light_overlay: str = Field(default="", max_length=120)
    euro_cut: str = Field(default="", max_length=120)
    cutlery_tray: str = Field(default="", max_length=120)
    vent_grille: str = Field(default="", max_length=120)
    handles: str = Field(default="", max_length=120)


class CrmOrderCreate(CrmOrderAdminFields):
    title: str = Field(min_length=2, max_length=180)
    customer: str = Field(default="", max_length=120)
    status: str = Field(default="черновой замер", max_length=32)
    notes: str = ""
    materials: list[CrmOrderMaterialLineIn] = Field(default_factory=list)


class CrmOrderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=180)
    customer: str | None = Field(default=None, max_length=120)
    status: str | None = Field(default=None, max_length=32)
    notes: str | None = None
    materials: list[CrmOrderMaterialLineIn] | None = None
    customer_full_name: str | None = Field(default=None, max_length=180)
    signature_date: str | None = None
    delivery_date: str | None = None
    price_admin: float | None = Field(default=None, ge=0)
    advance_paid: float | None = Field(default=None, ge=0)
    balance_due: float | None = None
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=80)
    install_address: str | None = Field(default=None, max_length=255)
    color_corpus: str | None = Field(default=None, max_length=120)
    color_facade_1: str | None = Field(default=None, max_length=120)
    color_facade_2: str | None = Field(default=None, max_length=120)
    color_facade_3: str | None = Field(default=None, max_length=120)
    visible_parts: str | None = Field(default=None, max_length=120)
    guides: str | None = Field(default=None, max_length=120)
    hinges: str | None = Field(default=None, max_length=120)
    mirror: str | None = Field(default=None, max_length=120)
    countertop: str | None = Field(default=None, max_length=120)
    apron: str | None = Field(default=None, max_length=120)
    gola_profile: str | None = Field(default=None, max_length=120)
    plinth: str | None = Field(default=None, max_length=120)
    false_panel: str | None = Field(default=None, max_length=120)
    light_inset: str | None = Field(default=None, max_length=120)
    light_overlay: str | None = Field(default=None, max_length=120)
    euro_cut: str | None = Field(default=None, max_length=120)
    cutlery_tray: str | None = Field(default=None, max_length=120)
    vent_grille: str | None = Field(default=None, max_length=120)
    handles: str | None = Field(default=None, max_length=120)


class CrmOrderOut(CrmOrderAdminFields):
    id: int
    title: str
    customer: str
    status: str
    notes: str
    planner_project_id: int | None = None
    user_id: str | None = None
    price_standard: float | None = None
    price_comfort: float | None = None
    price_premium: float | None = None
    selected_tier: str = "standard"
    materials: list[CrmOrderMaterialLine]
    created_at: str | None = None
    status_changed_at: str | None = None
    calendar_kind: str | None = None


class CrmFieldOptionCreate(BaseModel):
    field_key: str = Field(min_length=2, max_length=64)
    value: str = Field(min_length=1, max_length=120)
    sort_order: int = 0


class CrmFieldOptionOut(BaseModel):
    id: int
    field_key: str
    value: str
    sort_order: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class CrmFieldOptionUpdate(BaseModel):
    value: str | None = Field(default=None, min_length=1, max_length=120)
    sort_order: int | None = None
    is_active: bool | None = None


class CrmFieldDictionaryOut(BaseModel):
    field_key: str
    label: str
    options: list[CrmFieldOptionOut]


class CrmOrderStatusUpdate(BaseModel):
    status: str = Field(
        pattern=r"^(черновой замер|чистовой замер|выбор цветов|технолог|распил-фасады-фурнитура|доставлено|собрано|готово|конструктор|закупка|сборка|готова)$"
    )


class CrmOrderPhotoCreate(BaseModel):
    object_key: str = Field(min_length=3, max_length=255)
    caption: str = Field(default="", max_length=255)


class CrmOrderPhotoOut(CrmOrderPhotoCreate):
    id: int
    order_id: int
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class CrmOrderReceiptCreate(BaseModel):
    object_key: str = Field(min_length=3, max_length=255)
    note: str = Field(default="", max_length=255)
    amount_rub: float | None = Field(default=None, ge=0)
    uploaded_by: str = Field(default="", max_length=120)


class CrmOrderReceiptOut(CrmOrderReceiptCreate):
    id: int
    order_id: int
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class CrmPricingIn(BaseModel):
    standard: float = Field(ge=0)
    comfort: float = Field(ge=0)
    premium: float = Field(ge=0)


class CrmCuttingSummary(BaseModel):
    total_sheets: int = Field(ge=1, le=500)
    sheet_width: int | None = Field(default=None, gt=0)
    sheet_height: int | None = Field(default=None, gt=0)


class CrmSubmitProjectIn(BaseModel):
    planner_project_id: int
    title: str = Field(min_length=2, max_length=180)
    customer: str = Field(default="", max_length=120)
    customer_phone: str = Field(default="", max_length=80, pattern=r"^[^\r\n]*$")
    customer_email: str = Field(default="", max_length=254, pattern=r"^[^\r\n]*$")
    user_id: str = Field(min_length=1, max_length=64)
    pricing: CrmPricingIn
    selected_tier: str = Field(default="standard", pattern=r"^(standard|comfort|premium)$")
    materials: list[CrmOrderMaterialLineIn] = Field(default_factory=list)
    cutting: CrmCuttingSummary | None = None
    notes: str = ""


class CrmProcurementLine(BaseModel):
    material_id: int
    material_name: str
    unit: str
    required_qty: float
    in_stock_qty: float
    to_buy_qty_base: float
    to_buy_qty: float
    unit_price_rub: float
    line_total_rub: float
    purchased_qty: float
    purchased_total_rub: float
    overspend_qty: float = 0
    overspend_rub: float = 0
    is_purchased: bool


class CrmProcurementLineUpdateIn(BaseModel):
    material_id: int | None = None
    material_name: str | None = Field(default=None, min_length=2, max_length=120)
    unit: str | None = Field(default=None, max_length=20)
    required_qty: float | None = Field(default=None, ge=0)
    to_buy_qty: float | None = Field(default=None, ge=0)
    unit_price_rub: float | None = Field(default=None, ge=0)
    purchased_qty: float | None = Field(default=None, ge=0)
    is_purchased: bool | None = None


class CrmOrderProcurementOut(BaseModel):
    order_id: int
    title: str
    customer: str
    status: str
    lines: list[CrmProcurementLine]
    procurement_sum_rub: float
    purchased_sum_rub: float
    overspend_sum_rub: float = 0
    progress_percent: float
