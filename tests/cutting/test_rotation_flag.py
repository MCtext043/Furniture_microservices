"""Tests for per-part rotation control in cutting optimizer."""

from fastapi.testclient import TestClient


def test_rotation_disabled_keeps_original_orientation(cutting_client: TestClient):
    response = cutting_client.post(
        "/optimize",
        json={
            "sheet_width": 1000,
            "sheet_height": 800,
            "parts": [
                {"name": "Длинная", "width": 700, "height": 300, "quantity": 2, "allow_rotation": False},
                {"name": "Короткая", "width": 400, "height": 250, "quantity": 2, "allow_rotation": True},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    long_parts = [p for p in body["placements"] if p["name"] == "Длинная"]
    assert long_parts, "Long parts should be placed"
    assert all(not p.get("rotated") for p in long_parts)


def test_rotation_enabled_can_rotate(cutting_client: TestClient):
    response = cutting_client.post(
        "/optimize",
        json={
            "sheet_width": 400,
            "sheet_height": 1000,
            "parts": [
                {"name": "Панель", "width": 600, "height": 350, "quantity": 1, "allow_rotation": True},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["placed_count"] == 1
    assert body["placements"][0]["rotated"] is True
