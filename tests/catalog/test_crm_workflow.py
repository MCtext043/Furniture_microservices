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


def test_admin_creates_order_with_card_fields(catalog_client: TestClient):
    response = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Кухня админ",
            "customer_full_name": "Сидоров Иван",
            "signature_date": "2026-03-01",
            "delivery_date": "2026-04-15",
            "price_admin": 250000,
            "advance_paid": 100000,
            "email": "sidorov@example.com",
            "phone": "+79001112233",
            "install_address": "ул. Ленина, 10",
            "color_corpus": "Белый",
            "handles": "Скоба",
            "materials": [],
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["customer_full_name"] == "Сидоров Иван"
    assert body["customer"] == "Сидоров Иван"
    assert body["delivery_date"] == "2026-04-15"
    assert body["price_admin"] == 250000
    assert body["advance_paid"] == 100000
    assert body["balance_due"] == 150000
    assert body["install_address"] == "ул. Ленина, 10"
    assert body["color_corpus"] == "Белый"
    assert body["handles"] == "Скоба"
    assert body["materials"] == []


def test_admin_patches_client_order_fields(catalog_client: TestClient):
    created = catalog_client.post(
        "/crm/orders/submit-project",
        json={
            "planner_project_id": 99,
            "title": "Клиентский заказ",
            "customer": "Клиент К.",
            "customer_phone": "+7999",
            "customer_email": "c@ex.com",
            "user_id": "u-client",
            "pricing": {"standard": 10, "comfort": 20, "premium": 30},
            "cutting": {"total_sheets": 1},
        },
    )
    assert created.status_code == 201, created.text
    order = created.json()
    assert order["customer_full_name"] == "Клиент К."
    assert order["phone"] == "+7999"
    assert order["email"] == "c@ex.com"
    assert order["delivery_date"] is None
    assert order["color_corpus"] == ""
    assert order["price_admin"] is None

    patched = catalog_client.patch(
        f"/crm/orders/{order['id']}",
        json={
            "delivery_date": "2026-05-20",
            "install_address": "пр. Мира, 5",
            "price_admin": 180000,
            "advance_paid": 50000,
            "color_facade_1": "Дуб",
            "hinges": "Blum",
        },
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["delivery_date"] == "2026-05-20"
    assert body["install_address"] == "пр. Мира, 5"
    assert body["balance_due"] == 130000
    assert body["color_facade_1"] == "Дуб"
    assert body["hinges"] == "Blum"
    assert body["phone"] == "+7999"


def test_calendar_includes_delivery_date(catalog_client: TestClient):
    created = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Сдача в календарь",
            "customer_full_name": "Календарёв",
            "delivery_date": "2026-06-01",
            "install_address": "ул. Календарная, 1",
        },
    ).json()
    calendar = catalog_client.get("/crm/calendar")
    assert calendar.status_code == 200
    items = calendar.json()
    delivery = [i for i in items if i["id"] == created["id"] and i.get("calendar_kind") == "delivery"]
    assert len(delivery) == 1
    assert delivery[0]["install_address"] == "ул. Календарная, 1"
    assert delivery[0]["status_changed_at"].startswith("2026-06-01")


def test_field_dictionaries_defaults_and_add(catalog_client: TestClient):
    listed = catalog_client.get("/crm/field-dictionaries")
    assert listed.status_code == 200
    dicts = listed.json()
    keys = {d["field_key"] for d in dicts}
    assert "color_corpus" in keys
    assert "handles" in keys
    corpus = next(d for d in dicts if d["field_key"] == "color_corpus")
    assert len(corpus["options"]) >= 1

    added = catalog_client.post(
        "/crm/field-options",
        json={"field_key": "handles", "value": "Кастомная ручка X"},
    )
    assert added.status_code == 201, added.text
    again = catalog_client.get("/crm/field-dictionaries").json()
    handles = next(d for d in again if d["field_key"] == "handles")
    assert any(o["value"] == "Кастомная ручка X" for o in handles["options"])


def test_get_order_returns_admin_fields(catalog_client: TestClient):
    created = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Детали",
            "customer_full_name": "Тест",
            "countertop": "Камень",
            "apron": "Стекло",
        },
    ).json()
    got = catalog_client.get(f"/crm/orders/{created['id']}")
    assert got.status_code == 200
    body = got.json()
    assert body["countertop"] == "Камень"
    assert body["apron"] == "Стекло"


def test_order_receipt_create_and_list(catalog_client: TestClient):
    material_id = _seed_material(catalog_client, "Чек материал")
    order = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Заказ с чеком",
            "customer": "Покупатель",
            "status": "закупка",
            "materials": [{"material_id": material_id, "required_qty": 1}],
        },
    ).json()
    empty = catalog_client.get(f"/crm/orders/{order['id']}/receipts")
    assert empty.status_code == 200
    assert empty.json() == []

    created = catalog_client.post(
        f"/crm/orders/{order['id']}/receipts",
        json={
            "object_key": f"receipts/{order['id']}/demo.jpg",
            "note": "Петли Blum",
            "amount_rub": 4500.5,
            "uploaded_by": "admin",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["note"] == "Петли Blum"
    assert body["amount_rub"] == 4500.5
    assert body["object_key"].endswith("demo.jpg")

    listed = catalog_client.get(f"/crm/orders/{order['id']}/receipts")
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["note"] == "Петли Blum"
    assert items[0]["amount_rub"] == 4500.5
