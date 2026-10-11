"""Warehouse stock: purchases, manual edits, and order write-off."""

from fastapi.testclient import TestClient


def _order(catalog_client: TestClient, **extra) -> dict:
    payload = {
        "title": "Кухня склада",
        "customer": "Иванов",
        "status": "черновой замер",
        "materials": [],
    }
    payload.update(extra)
    response = catalog_client.post("/crm/orders", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_add_material_and_set_stock(catalog_client: TestClient):
    created = catalog_client.post(
        "/crm/materials",
        json={"name": "Петля", "unit": "шт", "purchase_price_rub": 40},
    )
    assert created.status_code == 201
    material_id = created.json()["id"]
    updated = catalog_client.put(f"/crm/warehouse/{material_id}", json={"quantity": 12})
    assert updated.status_code == 200
    assert updated.json()["quantity"] == 12
    assert updated.json()["purchase_price_rub"] == 40


def test_purchase_adds_stock_and_can_create_material(catalog_client: TestClient):
    existing = catalog_client.post("/crm/materials", json={"name": "ДСП 16", "unit": "лист"}).json()
    catalog_client.put(f"/crm/warehouse/{existing['id']}", json={"quantity": 2})
    response = catalog_client.post(
        "/crm/warehouse/purchases",
        json={
            "note": "Накладная 14",
            "lines": [
                {"material_id": existing["id"], "quantity": 3, "unit_price_rub": 1500},
                {"material_name": "Кромка", "unit": "м", "quantity": 20, "unit_price_rub": 15},
            ],
        },
    )
    assert response.status_code == 200, response.text
    by_name = {row["material_name"]: row for row in catalog_client.get("/crm/warehouse").json()}
    assert by_name["ДСП 16"]["quantity"] == 5
    assert by_name["ДСП 16"]["purchase_price_rub"] == 1500
    assert by_name["Кромка"]["quantity"] == 20
    movements = catalog_client.get("/crm/warehouse/movements").json()
    assert any(row["kind"] == "purchase" and row["material_name"] == "Кромка" for row in movements)


def test_manual_adjust_can_reduce_stock(catalog_client: TestClient):
    material_id = catalog_client.post("/crm/materials", json={"name": "Направляющая", "unit": "шт"}).json()["id"]
    catalog_client.put(f"/crm/warehouse/{material_id}", json={"quantity": 10})
    adjusted = catalog_client.post(f"/crm/warehouse/{material_id}/adjust", json={"delta": -4, "note": "Брак"})
    assert adjusted.status_code == 200
    assert adjusted.json()["quantity"] == 6


def test_production_status_consumes_and_rollback_returns_stock(catalog_client: TestClient):
    material_id = catalog_client.post("/crm/materials", json={"name": "Лист ЛДСП", "unit": "лист"}).json()["id"]
    catalog_client.put(f"/crm/warehouse/{material_id}", json={"quantity": 10})
    order = _order(
        catalog_client,
        status="чистовой замер",
        materials=[{"material_id": material_id, "required_qty": 4}],
    )
    stock = catalog_client.get("/crm/warehouse").json()
    assert stock[0]["quantity"] == 10
    assert order["materials"][0]["issued_qty"] == 0

    started = catalog_client.patch(f"/crm/orders/{order['id']}/status", json={"status": "технолог"})
    assert started.status_code == 200
    assert started.json()["materials"][0]["issued_qty"] == 4
    assert catalog_client.get("/crm/warehouse").json()[0]["quantity"] == 6

    again = catalog_client.post("/crm/warehouse/reconcile")
    assert again.json()[0]["quantity"] == 6

    back = catalog_client.patch(f"/crm/orders/{order['id']}/status", json={"status": "черновой замер"})
    assert back.json()["materials"][0]["issued_qty"] == 0
    assert catalog_client.get("/crm/warehouse").json()[0]["quantity"] == 10


def test_changing_order_cost_adjusts_only_the_difference(catalog_client: TestClient):
    material_id = catalog_client.post("/crm/materials", json={"name": "Кромка ПВХ", "unit": "м"}).json()["id"]
    catalog_client.put(f"/crm/warehouse/{material_id}", json={"quantity": 30})
    order = _order(
        catalog_client,
        status="технолог",
        materials=[{"material_id": material_id, "required_qty": 8}],
    )
    assert catalog_client.get("/crm/warehouse").json()[0]["quantity"] == 22
    updated = catalog_client.patch(
        f"/crm/orders/{order['id']}",
        json={"materials": [{"material_id": material_id, "required_qty": 5}]},
    )
    assert updated.status_code == 200
    assert updated.json()["materials"][0]["issued_qty"] == 5
    assert catalog_client.get("/crm/warehouse").json()[0]["quantity"] == 25


def test_delete_material_blocked_when_used_by_order(catalog_client: TestClient):
    material_id = catalog_client.post("/crm/materials", json={"name": "Зеркало", "unit": "шт"}).json()["id"]
    _order(catalog_client, materials=[{"material_id": material_id, "required_qty": 1}])
    denied = catalog_client.delete(f"/crm/materials/{material_id}")
    assert denied.status_code == 409
    free_id = catalog_client.post("/crm/materials", json={"name": "Заглушка", "unit": "шт"}).json()["id"]
    removed = catalog_client.delete(f"/crm/materials/{free_id}")
    assert removed.status_code == 200
    names = [row["material_name"] for row in catalog_client.get("/crm/warehouse").json()]
    assert "Заглушка" not in names


def test_deleting_issued_order_returns_stock(catalog_client: TestClient):
    material_id = catalog_client.post("/crm/materials", json={"name": "Евровинт", "unit": "шт"}).json()["id"]
    catalog_client.put(f"/crm/warehouse/{material_id}", json={"quantity": 100})
    order = _order(
        catalog_client,
        status="собрано",
        materials=[{"material_id": material_id, "required_qty": 16}],
    )
    assert catalog_client.get("/crm/warehouse").json()[0]["quantity"] == 84
    deleted = catalog_client.delete(f"/crm/orders/{order['id']}")
    assert deleted.status_code == 200
    assert catalog_client.get("/crm/warehouse").json()[0]["quantity"] == 100
