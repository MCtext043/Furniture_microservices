import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from services.catalog_service.app.db import Base, get_session
from services.catalog_service.app.main import app


def _client() -> TestClient:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_session():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    return TestClient(app)


def test_create_and_filter_products():
    client = _client()
    category = client.post("/categories", json={"name": "Кухни"}).json()

    created = client.post(
        "/products",
        json={
            "name": "Кухня Лофт",
            "sku": "KITCH-LOFT-001",
            "brand": "FurniPro",
            "description": "Серый фасад",
            "price": 155000,
            "category_id": category["id"],
            "stock": 3,
            "is_active": True,
        },
    )
    assert created.status_code == 201

    search = client.get("/products", params={"q": "Лофт"})
    assert search.status_code == 200
    assert len(search.json()) == 1


def test_marketplace_endpoints_reviews_cart_wishlist():
    client = _client()
    category = client.post("/categories", json={"name": "Шкафы"}).json()

    product = client.post(
        "/products",
        json={
            "name": "Шкаф Верона",
            "sku": "WARD-VERONA-001",
            "brand": "WoodLine",
            "description": "3 створки",
            "price": 65000,
            "category_id": category["id"],
            "stock": 10,
            "is_active": True,
        },
    ).json()
    product_id = product["id"]

    details = client.get(f"/products/{product_id}")
    assert details.status_code == 200

    updated = client.patch(f"/products/{product_id}", json={"price": 70000, "stock": 8})
    assert updated.status_code == 200
    assert updated.json()["price"] == 70000.0

    review = client.post(
        f"/products/{product_id}/reviews",
        json={"author_name": "Ivan", "rating": 5, "comment": "Отличный шкаф"},
    )
    assert review.status_code == 201
    assert len(client.get(f"/products/{product_id}/reviews").json()) == 1

    cart_item = client.post("/users/u1/cart/items", json={"product_id": product_id, "quantity": 2})
    assert cart_item.status_code == 201
    item_id = cart_item.json()["id"]

    cart_update = client.patch(f"/users/u1/cart/items/{item_id}", json={"quantity": 5})
    assert cart_update.status_code == 200
    assert cart_update.json()["quantity"] == 5

    wishlist = client.post(f"/users/u1/wishlist/products/{product_id}")
    assert wishlist.status_code == 201
    assert len(client.get("/users/u1/wishlist").json()) == 1

    filters = client.get("/products/filters")
    assert filters.status_code == 200
    assert "WoodLine" in filters.json()["brands"]
