"""Atomic, idempotent planner scene persistence."""


def _placement(client_id: str, width: float = 600) -> dict:
    return {
        "client_id": client_id,
        "definition_id": "kitchen.base-cabinet.v1",
        "definition_version": 1,
        "name": "Base cabinet",
        "width": width,
        "depth": 560,
        "height": 850,
        "x": 800,
        "y": 0,
        "z": 400,
        "rotation_y": 0,
        "furniture_type": "cabinet",
        "texture": "mdf_matte",
        "configuration_json": {"shelfCount": 1},
        "appearance_json": {"facadeMaterialId": "mdf-matte"},
    }


def _scene(revision: int, placements: list[dict]) -> dict:
    return {
        "schema_version": 2,
        "expected_revision": revision,
        "room": {"width": 4200, "length": 3600, "height": 2700, "finish": {"floor": "oak"}},
        "placements": placements,
    }


def test_scene_save_is_upsert_and_removes_absent_placements(planner_client):
    project_id = planner_client.post("/projects", json={"name": "Atomic scene"}).json()["id"]
    first = planner_client.put(f"/projects/{project_id}/scene", json=_scene(0, [_placement("a"), _placement("b")]))
    assert first.status_code == 200
    assert first.json()["revision"] == 1

    second = planner_client.put(f"/projects/{project_id}/scene", json=_scene(1, [_placement("a", 800)]))
    assert second.status_code == 200
    assert second.json()["revision"] == 2
    loaded = planner_client.get(f"/projects/{project_id}/scene").json()
    assert [item["client_id"] for item in loaded["placements"]] == ["a"]
    assert loaded["placements"][0]["width"] == 800


def test_scene_rejects_stale_revision_without_partial_changes(planner_client):
    project_id = planner_client.post("/projects", json={"name": "Revision guard"}).json()["id"]
    assert planner_client.put(f"/projects/{project_id}/scene", json=_scene(0, [_placement("stable")])).status_code == 200
    conflict = planner_client.put(f"/projects/{project_id}/scene", json=_scene(0, [_placement("wrong")]))
    assert conflict.status_code == 409
    loaded = planner_client.get(f"/projects/{project_id}/scene").json()
    assert [item["client_id"] for item in loaded["placements"]] == ["stable"]


def test_scene_rejects_duplicate_client_ids(planner_client):
    project_id = planner_client.post("/projects", json={"name": "No duplicates"}).json()["id"]
    response = planner_client.put(f"/projects/{project_id}/scene", json=_scene(0, [_placement("same"), _placement("same")]))
    assert response.status_code == 422
