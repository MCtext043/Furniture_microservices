from fastapi.testclient import TestClient


def test_patch_category(catalog_client: TestClient):
    cat = catalog_client.post("/categories", json={"name": "Офис"}).json()
    cid = cat["id"]
    res = catalog_client.patch(f"/categories/{cid}", json={"name": "Офисная мебель"})
    assert res.status_code == 200
    assert res.json()["name"] == "Офисная мебель"

    catalog_client.post("/categories", json={"name": "Кухни"}).json()
    conflict = catalog_client.patch(f"/categories/{cid}", json={"name": "Кухни"})
    assert conflict.status_code == 409


def test_reject_corrupt_category_name(catalog_client: TestClient):
    response = catalog_client.post("/categories", json={"name": "????"})
    assert response.status_code == 422


def test_delete_category_unlinks_products(catalog_client: TestClient):
    category = catalog_client.post("/categories", json={"name": "Временная"}).json()
    product = catalog_client.post(
        "/products",
        json={
            "name": "Стол",
            "sku": "TABLE-001",
            "brand": "Test",
            "description": "",
            "price": 10000,
            "category_id": category["id"],
            "stock": 1,
            "is_active": True,
        },
    ).json()
    deleted = catalog_client.delete(f"/categories/{category['id']}")
    assert deleted.status_code == 204
    updated = catalog_client.get(f"/products/{product['id']}").json()
    assert updated["category_id"] is None


def test_product_photos_crud(catalog_client: TestClient):
    category = catalog_client.post("/categories", json={"name": "Диваны"}).json()
    product = catalog_client.post(
        "/products",
        json={
            "name": "Диван Soft",
            "sku": "SOFA-001",
            "brand": "Test",
            "description": "",
            "price": 50000,
            "category_id": category["id"],
            "stock": 2,
            "is_active": True,
        },
    ).json()
    created = catalog_client.post(
        f"/products/{product['id']}/photos",
        json={"object_key": "products/1/front.jpg", "sort_order": 0},
    )
    assert created.status_code == 201
    listed = catalog_client.get(f"/products/{product['id']}/photos")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    details = catalog_client.get(f"/products/{product['id']}")
    assert details.json()["photos"][0]["object_key"] == "products/1/front.jpg"
    photo_id = listed.json()[0]["id"]
    deleted = catalog_client.delete(f"/products/{product['id']}/photos/{photo_id}")
    assert deleted.status_code == 204
    assert catalog_client.get(f"/products/{product['id']}/photos").json() == []


def test_create_and_filter_products(catalog_client: TestClient):
    category = catalog_client.post("/categories", json={"name": "Кухни"}).json()

    created = catalog_client.post(
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

    search = catalog_client.get("/products", params={"q": "Лофт"})
    assert search.status_code == 200
    assert len(search.json()) == 1


def test_marketplace_endpoints_reviews_cart_wishlist(catalog_client: TestClient):
    category = catalog_client.post("/categories", json={"name": "Шкафы"}).json()

    product = catalog_client.post(
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

    details = catalog_client.get(f"/products/{product_id}")
    assert details.status_code == 200

    updated = catalog_client.patch(f"/products/{product_id}", json={"price": 70000, "stock": 8})
    assert updated.status_code == 200
    assert updated.json()["price"] == 70000.0

    review = catalog_client.post(
        f"/products/{product_id}/reviews",
        json={"author_name": "Ivan", "rating": 5, "comment": "Отличный шкаф"},
    )
    assert review.status_code == 201
    assert len(catalog_client.get(f"/products/{product_id}/reviews").json()) == 1

    cart_item = catalog_client.post(
        "/users/u1/cart/items",
        json={"product_id": product_id, "quantity": 2},
    )
    assert cart_item.status_code == 201
    item_id = cart_item.json()["id"]

    cart_update = catalog_client.patch(f"/users/u1/cart/items/{item_id}", json={"quantity": 5})
    assert cart_update.status_code == 200
    assert cart_update.json()["quantity"] == 5

    wishlist = catalog_client.post(f"/users/u1/wishlist/products/{product_id}")
    assert wishlist.status_code == 201
    assert len(catalog_client.get("/users/u1/wishlist").json()) == 1

    filters = catalog_client.get("/products/filters")
    assert filters.status_code == 200
    assert "WoodLine" in filters.json()["brands"]
