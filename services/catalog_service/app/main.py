from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from common.jwt_auth import ensure_catalog_writer, ensure_shop_user
from common.messaging import publish_event

from .db import SessionLocal, get_session
from .delivery import GeoPoint, calculate_delivery_quote, estimate_road_distance_km, geocode_address
from .models import CartItem, Category, Product, ProductPhoto, ProductReview, ShopSettings, WishlistItem
from .schemas import (
    CartItemCreate,
    CartItemOut,
    CartItemUpdate,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    DeliveryQuoteOut,
    DeliveryQuoteRequest,
    DeliverySettingsOut,
    DeliverySettingsPublicOut,
    DeliverySettingsUpdate,
    ProductCreate,
    ProductFiltersOut,
    ProductOut,
    ProductPhotoCreate,
    ProductPhotoOut,
    ProductUpdate,
    ReviewCreate,
    ReviewOut,
    WishlistItemOut,
)


app = FastAPI(
    title="Furniture Catalog Service",
    description="Каталог мебели: карточки, категории, фильтры и поиск.",
    version="0.1.0",
    openapi_tags=[
        {"name": "system", "description": "Служебные эндпоинты"},
        {"name": "categories", "description": "Работа с категориями каталога"},
        {"name": "products", "description": "Карточки товаров и фильтры"},
        {"name": "reviews", "description": "Отзывы к товарам"},
        {"name": "cart", "description": "Корзина пользователя"},
        {"name": "wishlist", "description": "Избранные товары пользователя"},
        {"name": "delivery", "description": "Доставка и настройки магазина"},
        {"name": "crm", "description": "CRM производства: заказы, склад, закупки"},
    ],
)


from .crm_routes import router as crm_router

app.include_router(crm_router)


def _get_or_create_shop_settings(session: Session) -> ShopSettings:
    row = session.scalar(select(ShopSettings).order_by(ShopSettings.id).limit(1))
    if row is None:
        row = ShopSettings(
            free_delivery_threshold=3000,
            delivery_price_per_km=45,
            warehouse_address="Москва, ул. Складская, 1",
        )
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


async def _warehouse_point(settings: ShopSettings) -> GeoPoint:
    if settings.warehouse_lat is not None and settings.warehouse_lon is not None:
        return GeoPoint(lat=float(settings.warehouse_lat), lon=float(settings.warehouse_lon))
    if not settings.warehouse_address.strip():
        raise HTTPException(status_code=503, detail="Адрес склада не настроен администратором")
    point = await geocode_address(settings.warehouse_address)
    return point


@app.on_event("startup")
def ensure_shop_settings_row() -> None:
    session = SessionLocal()
    try:
        _get_or_create_shop_settings(session)
    finally:
        session.close()


@app.get("/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


def _is_corrupt_category_name(name: str) -> bool:
    stripped = (name or "").strip()
    if len(stripped) < 2:
        return True
    if "\ufffd" in stripped:
        return True
    q_count = stripped.count("?")
    if q_count == 0:
        return False
    core_len = len(stripped.replace(" ", ""))
    if core_len == 0:
        return True
    if q_count >= max(2, int(core_len * 0.12)):
        return True
    return q_count >= 1 and core_len <= 8


def _validate_category_name(name: str) -> str:
    cleaned = name.strip()
    if _is_corrupt_category_name(cleaned):
        raise HTTPException(status_code=422, detail="Некорректное название категории")
    return cleaned


def _photos_by_product(session: Session, product_ids: list[int]) -> dict[int, list[ProductPhoto]]:
    if not product_ids:
        return {}
    rows = list(
        session.scalars(
            select(ProductPhoto)
            .where(ProductPhoto.product_id.in_(product_ids))
            .order_by(ProductPhoto.sort_order.asc(), ProductPhoto.id.asc())
        )
    )
    grouped: dict[int, list[ProductPhoto]] = {}
    for row in rows:
        grouped.setdefault(row.product_id, []).append(row)
    return grouped


def _product_out(product: Product, photos: list[ProductPhoto] | None = None) -> ProductOut:
    photo_rows = photos if photos is not None else list(product.photos or [])
    return ProductOut(
        id=product.id,
        name=product.name,
        sku=product.sku,
        brand=product.brand,
        description=product.description,
        price=float(product.price),
        category_id=product.category_id,
        stock=product.stock,
        is_active=product.is_active,
        photos=[ProductPhotoOut.model_validate(row) for row in photo_rows],
    )


@app.post("/categories", response_model=CategoryOut, status_code=201, tags=["categories"], dependencies=[Depends(ensure_catalog_writer)])
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)) -> Category:
    name = _validate_category_name(payload.name)
    existing = session.scalar(select(Category).where(Category.name == name))
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")
    category = Category(name=name, parent_id=payload.parent_id)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@app.get("/categories", response_model=list[CategoryOut], tags=["categories"])
def list_categories(session: Session = Depends(get_session)) -> list[Category]:
    rows = list(session.scalars(select(Category).order_by(Category.name)))
    return [row for row in rows if not _is_corrupt_category_name(row.name)]


@app.get("/categories/{category_id}", response_model=CategoryOut, tags=["categories"])
def get_category(category_id: int, session: Session = Depends(get_session)) -> Category:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@app.patch("/categories/{category_id}", response_model=CategoryOut, tags=["categories"], dependencies=[Depends(ensure_catalog_writer)])
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    session: Session = Depends(get_session),
) -> Category:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if payload.name is not None:
        name = _validate_category_name(payload.name)
        existing = session.scalar(
            select(Category).where(Category.name == name, Category.id != category_id)
        )
        if existing:
            raise HTTPException(status_code=409, detail="Category already exists")
        category.name = name
    if payload.parent_id is not None:
        category.parent_id = payload.parent_id
    session.commit()
    session.refresh(category)
    return category


@app.delete("/categories/{category_id}", status_code=204, tags=["categories"], dependencies=[Depends(ensure_catalog_writer)])
def delete_category(category_id: int, session: Session = Depends(get_session)) -> None:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for product in session.scalars(select(Product).where(Product.category_id == category_id)):
        product.category_id = None
    session.delete(category)
    session.commit()


@app.post("/products", response_model=ProductOut, status_code=201, tags=["products"], dependencies=[Depends(ensure_catalog_writer)])
def create_product(payload: ProductCreate, session: Session = Depends(get_session)) -> Product:
    existing_sku = session.scalar(select(Product).where(Product.sku == payload.sku))
    if existing_sku:
        raise HTTPException(status_code=409, detail="SKU already exists")
    if payload.category_id is not None:
        category = session.get(Category, payload.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    product = Product(**payload.model_dump())
    session.add(product)
    session.commit()
    session.refresh(product)
    publish_event(
        "catalog.product.created",
        {
            "id": product.id,
            "sku": product.sku,
            "name": product.name,
            "price": float(product.price),
        },
    )
    return _product_out(product, [])


@app.get("/products", response_model=list[ProductOut], tags=["products"])
def list_products(
    session: Session = Depends(get_session),
    q: str | None = Query(default=None, description="Поиск по названию"),
    category_id: int | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    brand: str | None = Query(default=None),
    in_stock_only: bool = Query(default=False),
    is_active: bool = Query(default=True),
    sort_by: str = Query(default="newest", pattern="^(newest|price_asc|price_desc|name)$"),
) -> list[Product]:
    stmt: Select[tuple[Product]] = select(Product)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    if brand:
        stmt = stmt.where(Product.brand == brand)
    if in_stock_only:
        stmt = stmt.where(Product.stock > 0)
    stmt = stmt.where(Product.is_active == is_active)

    if sort_by == "price_asc":
        stmt = stmt.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        stmt = stmt.order_by(Product.price.desc())
    elif sort_by == "name":
        stmt = stmt.order_by(Product.name.asc())
    else:
        stmt = stmt.order_by(Product.id.desc())

    stmt = stmt.offset(skip).limit(limit)
    products = list(session.scalars(stmt))
    photos_map = _photos_by_product(session, [p.id for p in products])
    return [_product_out(product, photos_map.get(product.id, [])) for product in products]


@app.get("/products/filters", response_model=ProductFiltersOut, tags=["products"])
def product_filters(session: Session = Depends(get_session)) -> ProductFiltersOut:
    min_price = session.scalar(select(func.min(Product.price)).where(Product.is_active.is_(True))) or 0
    max_price = session.scalar(select(func.max(Product.price)).where(Product.is_active.is_(True))) or 0
    brands = list(
        session.scalars(
            select(Product.brand)
            .where(Product.is_active.is_(True), Product.brand != "")
            .distinct()
            .order_by(Product.brand.asc())
        )
    )
    return ProductFiltersOut(min_price=float(min_price), max_price=float(max_price), brands=brands)


@app.get("/products/{product_id}", response_model=ProductOut, tags=["products"])
def get_product(product_id: int, session: Session = Depends(get_session)) -> ProductOut:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    photos_map = _photos_by_product(session, [product_id])
    return _product_out(product, photos_map.get(product_id, []))


@app.patch("/products/{product_id}", response_model=ProductOut, tags=["products"], dependencies=[Depends(ensure_catalog_writer)])
def update_product(
    product_id: int,
    payload: ProductUpdate,
    session: Session = Depends(get_session),
) -> Product:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if payload.category_id is not None:
        category = session.get(Category, payload.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    session.commit()
    session.refresh(product)
    photos_map = _photos_by_product(session, [product_id])
    return _product_out(product, photos_map.get(product_id, []))


@app.get("/products/{product_id}/photos", response_model=list[ProductPhotoOut], tags=["products"])
def list_product_photos(product_id: int, session: Session = Depends(get_session)) -> list[ProductPhoto]:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return list(
        session.scalars(
            select(ProductPhoto)
            .where(ProductPhoto.product_id == product_id)
            .order_by(ProductPhoto.sort_order.asc(), ProductPhoto.id.asc())
        )
    )


@app.post(
    "/products/{product_id}/photos",
    response_model=ProductPhotoOut,
    status_code=201,
    tags=["products"],
    dependencies=[Depends(ensure_catalog_writer)],
)
def add_product_photo(
    product_id: int,
    payload: ProductPhotoCreate,
    session: Session = Depends(get_session),
) -> ProductPhoto:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    photo = ProductPhoto(
        product_id=product_id,
        object_key=payload.object_key,
        sort_order=payload.sort_order,
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


@app.delete(
    "/products/{product_id}/photos/{photo_id}",
    status_code=204,
    tags=["products"],
    dependencies=[Depends(ensure_catalog_writer)],
)
def delete_product_photo(
    product_id: int,
    photo_id: int,
    session: Session = Depends(get_session),
) -> None:
    photo = session.get(ProductPhoto, photo_id)
    if not photo or photo.product_id != product_id:
        raise HTTPException(status_code=404, detail="Photo not found")
    session.delete(photo)
    session.commit()


@app.delete("/products/{product_id}", status_code=204, tags=["products"], dependencies=[Depends(ensure_catalog_writer)])
def delete_product(product_id: int, session: Session = Depends(get_session)) -> None:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    session.commit()


@app.post("/products/{product_id}/reviews", response_model=ReviewOut, status_code=201, tags=["reviews"], dependencies=[Depends(ensure_catalog_writer)])
def add_review(
    product_id: int,
    payload: ReviewCreate,
    session: Session = Depends(get_session),
) -> ProductReview:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    review = ProductReview(product_id=product_id, **payload.model_dump())
    session.add(review)
    session.commit()
    session.refresh(review)
    return review


@app.get("/products/{product_id}/reviews", response_model=list[ReviewOut], tags=["reviews"])
def list_reviews(product_id: int, session: Session = Depends(get_session)) -> list[ProductReview]:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return list(session.scalars(select(ProductReview).where(ProductReview.product_id == product_id)))


@app.post("/users/{user_id}/cart/items", response_model=CartItemOut, status_code=201, tags=["cart"], dependencies=[Depends(ensure_shop_user)])
def add_cart_item(
    user_id: str,
    payload: CartItemCreate,
    session: Session = Depends(get_session),
) -> CartItem:
    product = session.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    existing = session.scalar(
        select(CartItem).where(CartItem.user_id == user_id, CartItem.product_id == payload.product_id)
    )
    if existing:
        existing.quantity += payload.quantity
        session.commit()
        session.refresh(existing)
        return existing
    item = CartItem(user_id=user_id, **payload.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.get("/users/{user_id}/cart/items", response_model=list[CartItemOut], tags=["cart"])
def list_cart_items(user_id: str, session: Session = Depends(get_session)) -> list[CartItem]:
    return list(session.scalars(select(CartItem).where(CartItem.user_id == user_id)))


@app.patch("/users/{user_id}/cart/items/{item_id}", response_model=CartItemOut, tags=["cart"], dependencies=[Depends(ensure_shop_user)])
def update_cart_item(
    user_id: str,
    item_id: int,
    payload: CartItemUpdate,
    session: Session = Depends(get_session),
) -> CartItem:
    item = session.get(CartItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    item.quantity = payload.quantity
    session.commit()
    session.refresh(item)
    return item


@app.delete("/users/{user_id}/cart/items/{item_id}", status_code=204, tags=["cart"], dependencies=[Depends(ensure_shop_user)])
def delete_cart_item(user_id: str, item_id: int, session: Session = Depends(get_session)) -> None:
    item = session.get(CartItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    session.delete(item)
    session.commit()


@app.post(
    "/users/{user_id}/wishlist/products/{product_id}",
    response_model=WishlistItemOut,
    status_code=201,
    tags=["wishlist"],
    dependencies=[Depends(ensure_shop_user)],
)
def add_wishlist_item(user_id: str, product_id: int, session: Session = Depends(get_session)) -> WishlistItem:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    existing = session.scalar(
        select(WishlistItem).where(WishlistItem.user_id == user_id, WishlistItem.product_id == product_id)
    )
    if existing:
        return existing
    item = WishlistItem(user_id=user_id, product_id=product_id)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.get("/users/{user_id}/wishlist", response_model=list[WishlistItemOut], tags=["wishlist"])
def list_wishlist(user_id: str, session: Session = Depends(get_session)) -> list[WishlistItem]:
    return list(session.scalars(select(WishlistItem).where(WishlistItem.user_id == user_id)))


@app.delete("/users/{user_id}/wishlist/products/{product_id}", status_code=204, tags=["wishlist"], dependencies=[Depends(ensure_shop_user)])
def delete_wishlist_item(user_id: str, product_id: int, session: Session = Depends(get_session)) -> None:
    item = session.scalar(
        select(WishlistItem).where(WishlistItem.user_id == user_id, WishlistItem.product_id == product_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    session.delete(item)
    session.commit()


@app.get("/delivery/settings", response_model=DeliverySettingsPublicOut, tags=["delivery"])
def get_delivery_settings_public(session: Session = Depends(get_session)) -> DeliverySettingsPublicOut:
    settings = _get_or_create_shop_settings(session)
    return DeliverySettingsPublicOut(
        free_delivery_threshold=float(settings.free_delivery_threshold),
        delivery_price_per_km=float(settings.delivery_price_per_km),
    )


@app.get(
    "/settings/delivery",
    response_model=DeliverySettingsOut,
    tags=["delivery"],
    dependencies=[Depends(ensure_catalog_writer)],
)
def get_delivery_settings_admin(session: Session = Depends(get_session)) -> DeliverySettingsOut:
    settings = _get_or_create_shop_settings(session)
    return DeliverySettingsOut(
        free_delivery_threshold=float(settings.free_delivery_threshold),
        delivery_price_per_km=float(settings.delivery_price_per_km),
        warehouse_address=settings.warehouse_address,
        warehouse_lat=settings.warehouse_lat,
        warehouse_lon=settings.warehouse_lon,
    )


@app.put(
    "/settings/delivery",
    response_model=DeliverySettingsOut,
    tags=["delivery"],
    dependencies=[Depends(ensure_catalog_writer)],
)
async def update_delivery_settings(
    payload: DeliverySettingsUpdate,
    session: Session = Depends(get_session),
) -> DeliverySettingsOut:
    settings = _get_or_create_shop_settings(session)
    settings.free_delivery_threshold = payload.free_delivery_threshold
    settings.delivery_price_per_km = payload.delivery_price_per_km
    settings.warehouse_address = payload.warehouse_address.strip()
    try:
        warehouse = await geocode_address(settings.warehouse_address)
        settings.warehouse_lat = warehouse.lat
        settings.warehouse_lon = warehouse.lon
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    session.commit()
    session.refresh(settings)
    return DeliverySettingsOut(
        free_delivery_threshold=float(settings.free_delivery_threshold),
        delivery_price_per_km=float(settings.delivery_price_per_km),
        warehouse_address=settings.warehouse_address,
        warehouse_lat=settings.warehouse_lat,
        warehouse_lon=settings.warehouse_lon,
    )


@app.post("/delivery/quote", response_model=DeliveryQuoteOut, tags=["delivery"])
async def quote_delivery(payload: DeliveryQuoteRequest, session: Session = Depends(get_session)) -> DeliveryQuoteOut:
    settings = _get_or_create_shop_settings(session)
    try:
        warehouse = await _warehouse_point(settings)
        destination = await geocode_address(payload.address)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Сервис геокодирования временно недоступен") from exc

    distance_km = estimate_road_distance_km(warehouse, destination)
    quote = calculate_delivery_quote(
        subtotal=payload.subtotal,
        distance_km=distance_km,
        free_delivery_threshold=float(settings.free_delivery_threshold),
        delivery_price_per_km=float(settings.delivery_price_per_km),
    )
    return DeliveryQuoteOut(
        subtotal=quote.subtotal,
        delivery_fee=quote.delivery_fee,
        distance_km=quote.distance_km,
        free_delivery=quote.free_delivery,
        free_delivery_threshold=quote.free_delivery_threshold,
        delivery_price_per_km=quote.delivery_price_per_km,
        amount_until_free_delivery=quote.amount_until_free_delivery,
        grand_total=quote.grand_total,
    )
