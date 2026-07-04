"""Extended planner project workflow tests."""

from fastapi.testclient import TestClient


def test_create_project_with_room_and_pricing(planner_client: TestClient):
    response = planner_client.post(
        "/projects",
        json={
            "name": "Кухня-гостиная",
            "location": "Москва",
            "room_width": 4200,
            "room_length": 3600,
            "room_height": 2700,
            "price_standard": 150000,
            "price_comfort": 185000,
            "price_premium": 230000,
            "selected_tier": "comfort",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["room_width"] == 4200
    assert body["price_premium"] == 230000.0
    assert body["selected_tier"] == "comfort"
    assert body["status"] == "draft"


def test_update_project_selected_tier(planner_client: TestClient):
    project = planner_client.post("/projects", json={"name": "Кухня", "location": ""}).json()
    response = planner_client.patch(
        f"/projects/{project['id']}",
        json={"selected_tier": "premium", "price_premium": 300000},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["selected_tier"] == "premium"
    assert body["price_premium"] == 300000.0


def test_add_furniture_with_custom_color_and_hardware(planner_client: TestClient):
    project = planner_client.post("/projects", json={"name": "Кухня", "location": ""}).json()
    response = planner_client.post(
        f"/projects/{project['id']}/furniture",
        json={
            "name": "Нижний модуль",
            "width": 800,
            "depth": 560,
            "height": 720,
            "furniture_type": "cabinet",
            "texture": "mdf_matte",
            "custom_color": "#8B4513",
            "drawers": 3,
            "handles": 3,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["custom_color"] == "#8B4513"
    assert body["drawers"] == 3
    assert body["handles"] == 3


def test_submit_project_marks_submitted(planner_client: TestClient):
    project = planner_client.post(
        "/projects",
        json={"name": "Кухня Nord", "location": "СПб", "user_id": "u42", "selected_tier": "comfort"},
    ).json()
    response = planner_client.post(f"/projects/{project['id']}/submit", json={"selected_tier": "premium"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "submitted"
    assert body["selected_tier"] == "premium"
    assert body["submitted_at"] is not None
