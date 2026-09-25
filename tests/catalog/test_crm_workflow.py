"""CRM production workflow tests."""

from fastapi.testclient import TestClient


def _seed_material(catalog_client: TestClient, name: str = "Лист ДСП 16мм") -> int:
    response = catalog_client.post("/crm/materials", json={"name": name, "unit": "лист"})
    assert response.status_code == 201
    return response.json()["id"]


def test_submit_project_creates_materials_from_names(catalog_client: TestClient):
    response = catalog_client.post(
        "/crm/orders/submit-project",
        json={
            "planner_project_id": 7,
            "title": "Кухня без демо CRM",
            "customer": "Новый клиент",
            "user_id": "client-1",
            "pricing": {"standard": 180000, "comfort": 215000, "premium": 260000},
            "selected_tier": "standard",
            "cutting": {"total_sheets": 3, "sheet_width": 2800, "sheet_height": 2070},
            "materials": [{"material_name": "Лист ДСП 16мм", "unit": "лист", "required_qty": 3}],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["materials"][0]["material_name"] == "Лист ДСП 16мм"
    assert body["created_at"]
    assert body["status_changed_at"]


def test_submit_project_uses_cutting_when_materials_omitted(catalog_client: TestClient):
    response = catalog_client.post(
        "/crm/orders/submit-project",
        json={
            "planner_project_id": 8,
            "title": "Шкаф из раскроя",
            "customer": "Клиент",
            "user_id": "client-2",
            "pricing": {"standard": 100, "comfort": 120, "premium": 150},
            "cutting": {"total_sheets": 2, "sheet_width": 2800, "sheet_height": 2070},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["materials"][0]["required_qty"] == 2.0


def test_status_change_moves_calendar_timestamp(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "Кромка календарь")
    created = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Календарь",
            "customer": "Петров",
            "status": "технолог",
            "materials": [{"material_id": material_id, "required_qty": 1}],
        },
    ).json()
    first = created["status_changed_at"]
    updated = catalog_client.patch(
        f"/crm/orders/{created['id']}/status",
        json={"status": "готово"},
    ).json()
    assert updated["status"] == "готово"
    assert updated["status_changed_at"] >= first
    calendar = catalog_client.get("/crm/calendar")
    assert calendar.status_code == 200
    assert any(item["id"] == created["id"] for item in calendar.json())


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
    assert body["status"] == "черновой замер"
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


def test_update_order_status_to_ready(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "Ручка")
    created = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Тумба",
            "customer": "Петров",
            "status": "собрано",
            "materials": [{"material_id": material_id, "required_qty": 2}],
        },
    ).json()
    response = catalog_client.patch(
        f"/crm/orders/{created['id']}/status",
        json={"status": "готово"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "готово"


def test_procurement_rename_and_add_line(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "ДСП 16")
    created = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Кухня",
            "customer": "A",
            "status": "технолог",
            "materials": [{"material_id": material_id, "required_qty": 3}],
        },
    ).json()
    order_id = created["id"]
    updated = catalog_client.put(
        f"/crm/orders/{order_id}/procurement",
        json=[
            {
                "material_id": material_id,
                "material_name": "ДСП 16 мм белая",
                "unit": "лист",
                "required_qty": 4,
                "to_buy_qty": 4,
                "unit_price_rub": 1200,
                "purchased_qty": 5,
                "is_purchased": False,
            },
            {
                "material_name": "Кромка ABS",
                "unit": "м",
                "required_qty": 8,
                "to_buy_qty": 8,
                "unit_price_rub": 40,
                "purchased_qty": 8,
                "is_purchased": True,
            },
        ],
    )
    assert updated.status_code == 200
    body = updated.json()
    names = {line["material_name"] for line in body["lines"]}
    assert "ДСП 16 мм белая" in names
    assert "Кромка ABS" in names
    dsb = next(line for line in body["lines"] if line["material_name"] == "ДСП 16 мм белая")
    assert dsb["overspend_qty"] == 1
    assert dsb["overspend_rub"] == 1200
