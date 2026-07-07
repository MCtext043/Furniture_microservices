"""CRM production workflow tests."""

from fastapi.testclient import TestClient


def _seed_material(catalog_client: TestClient, name: str = "Лист ДСП 16мм") -> int:
    response = catalog_client.post("/crm/materials", json={"name": name, "unit": "лист"})
    assert response.status_code == 201
    return response.json()["id"]


def test_submit_project_creates_production_order(catalog_client: TestClient):
    material_id = _seed_material(catalog_client)
    response = catalog_client.post(
        "/crm/orders/submit-project",
        json={
            "planner_project_id": 42,
            "title": "Кухня Иванова",
            "customer": "Иванова М.",
            "user_id": "7",
            "pricing": {"standard": 180000, "comfort": 215000, "premium": 260000},
            "selected_tier": "comfort",
            "materials": [{"material_id": material_id, "required_qty": 12}],
            "notes": "Комплектация: Комфорт",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "конструктор"
    assert body["planner_project_id"] == 42
    assert body["price_standard"] == 180000.0
    assert body["selected_tier"] == "comfort"
    assert body["materials"][0]["required_qty"] == 12.0


def test_update_order_status_to_done(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "Кромка")
    created = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Шкаф",
            "customer": "Петров",
            "status": "сборка",
            "materials": [{"material_id": material_id, "required_qty": 5}],
        },
    ).json()
    response = catalog_client.patch(
        f"/crm/orders/{created['id']}/status",
        json={"status": "готова"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "готова"


def test_update_order_status(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "Кромка ПВХ")
    created = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Шкаф",
            "customer": "Петров",
            "status": "конструктор",
            "materials": [{"material_id": material_id, "required_qty": 5}],
        },
    ).json()
    response = catalog_client.patch(
        f"/crm/orders/{created['id']}/status",
        json={"status": "закупка"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "закупка"


def test_add_order_photo(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "Петля")
    order = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Кухня",
            "customer": "Сидоров",
            "status": "сборка",
            "materials": [{"material_id": material_id, "required_qty": 4}],
        },
    ).json()
    response = catalog_client.post(
        f"/crm/orders/{order['id']}/photos",
        json={"object_key": "orders/1/front.jpg", "caption": "Фасады готовы"},
    )
    assert response.status_code == 201
    photos = catalog_client.get(f"/crm/orders/{order['id']}/photos")
    assert photos.status_code == 200
    assert len(photos.json()) == 1
    assert photos.json()[0]["caption"] == "Фасады готовы"


def test_user_orders_list(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "Саморез")
    created = catalog_client.post(
        "/crm/orders/submit-project",
        json={
            "planner_project_id": 1,
            "title": "Кухня A",
            "customer": "User1",
            "user_id": "u1",
            "pricing": {"standard": 100, "comfort": 120, "premium": 150},
            "materials": [{"material_id": material_id, "required_qty": 1}],
        },
    )
    assert created.status_code == 201
    response = catalog_client.get("/crm/orders/user/u1")
    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert response.json()[0]["user_id"] == "u1"
