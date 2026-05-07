from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from common.jwt_auth import ensure_catalog_writer
from common.messaging import publish_event

from .db import get_session
from .models import CartItem, Category, Product, ProductReview, WishlistItem
from .schemas import (
    CartItemCreate,
    CartItemOut,
    CartItemUpdate,
    CategoryCreate,
    CategoryOut,
    ProductCreate,
    ProductFiltersOut,
    ProductOut,
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
    ],
)


@app.get("/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/categories", response_model=CategoryOut, status_code=201, tags=["categories"], dependencies=[Depends(ensure_catalog_writer)])
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)) -> Category:
    existing = session.scalar(select(Category).where(Category.name == payload.name))
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")
    category = Category(name=payload.name, parent_id=payload.parent_id)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@app.get("/categories", response_model=list[CategoryOut], tags=["categories"])
def list_categories(session: Session = Depends(get_session)) -> list[Category]:
    return list(session.scalars(select(Category).order_by(Category.name)))


@app.get("/categories/{category_id}", response_model=CategoryOut, tags=["categories"])
def get_category(category_id: int, session: Session = Depends(get_session)) -> Category:
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


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
    return product


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
    return list(session.scalars(stmt))


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
def get_product(product_id: int, session: Session = Depends(get_session)) -> Product:
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


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
    return product


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


@app.post("/users/{user_id}/cart/items", response_model=CartItemOut, status_code=201, tags=["cart"], dependencies=[Depends(ensure_catalog_writer)])
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


@app.patch("/users/{user_id}/cart/items/{item_id}", response_model=CartItemOut, tags=["cart"], dependencies=[Depends(ensure_catalog_writer)])
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


@app.delete("/users/{user_id}/cart/items/{item_id}", status_code=204, tags=["cart"], dependencies=[Depends(ensure_catalog_writer)])
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
    dependencies=[Depends(ensure_catalog_writer)],
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


@app.delete("/users/{user_id}/wishlist/products/{product_id}", status_code=204, tags=["wishlist"], dependencies=[Depends(ensure_catalog_writer)])
def delete_wishlist_item(user_id: str, product_id: int, session: Session = Depends(get_session)) -> None:
    item = session.scalar(
        select(WishlistItem).where(WishlistItem.user_id == user_id, WishlistItem.product_id == product_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    session.delete(item)
    session.commit()
