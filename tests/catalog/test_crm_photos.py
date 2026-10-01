"""CRM production photo delete."""

from fastapi.testclient import TestClient


def test_add_and_delete_order_photo(catalog_client: TestClient):
    created = catalog_client.post(
        "/crm/orders",
        json={"title": "Фото заказ", "customer": "Клиент", "status": "технолог", "materials": []},
    )
    assert created.status_code == 201
    order_id = created.json()["id"]

    photo = catalog_client.post(
        f"/crm/orders/{order_id}/photos",
        json={"object_key": "crm/orders/1/stage-a.jpg", "caption": "Сборка"},
    )
    assert photo.status_code == 201
    photo_id = photo.json()["id"]

    listed = catalog_client.get(f"/crm/orders/{order_id}/photos")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    deleted = catalog_client.delete(f"/crm/orders/{order_id}/photos/{photo_id}")
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"

    listed_after = catalog_client.get(f"/crm/orders/{order_id}/photos")
    assert listed_after.json() == []


def test_delete_order_photo_wrong_order_404(catalog_client: TestClient):
    a_resp = catalog_client.post(
        "/crm/orders",
        json={"title": "Заказ A", "customer": "A", "status": "технолог", "materials": []},
    )
    assert a_resp.status_code == 201, a_resp.text
    a = a_resp.json()["id"]
    b_resp = catalog_client.post(
        "/crm/orders",
        json={"title": "Заказ B", "customer": "B", "status": "технолог", "materials": []},
    )
    assert b_resp.status_code == 201, b_resp.text
    b = b_resp.json()["id"]
    photo_resp = catalog_client.post(
        f"/crm/orders/{a}/photos",
        json={"object_key": "crm/orders/a.jpg"},
    )
    assert photo_resp.status_code == 201, photo_resp.text
    photo_id = photo_resp.json()["id"]
    response = catalog_client.delete(f"/crm/orders/{b}/photos/{photo_id}")
    assert response.status_code == 404
