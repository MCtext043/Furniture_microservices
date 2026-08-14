"""Atomic, idempotent planner scene persistence."""

from common.jwt_auth import AuthContext, TokenClaims, get_auth_context
from services.planner_service.app.main import app as planner_app


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


def test_authenticated_identity_owns_project_and_other_user_is_forbidden(planner_client):
    current = {"sub": "owner-1"}
    def auth_context():
        return AuthContext(enforced=True, claims=TokenClaims(sub=current["sub"], username=current["sub"], roles=["user"]))
    planner_app.dependency_overrides[get_auth_context] = auth_context
    try:
        created = planner_client.post("/projects", json={"name": "Private", "user_id": "spoofed"})
        assert created.status_code == 201
        assert created.json()["user_id"] == "owner-1"
        project_id = created.json()["id"]
        current["sub"] = "owner-2"
        assert planner_client.get(f"/projects/{project_id}/scene").status_code == 403
        assert planner_client.patch(f"/projects/{project_id}", json={"name": "Stolen"}).status_code == 403
    finally:
        planner_app.dependency_overrides.pop(get_auth_context, None)


def test_admin_can_read_all_projects(planner_client):
    current = {"sub": "owner", "roles": ["user"]}
    def auth_context():
        return AuthContext(enforced=True, claims=TokenClaims(sub=current["sub"], username=current["sub"], roles=current["roles"]))
    planner_app.dependency_overrides[get_auth_context] = auth_context
    try:
        project_id = planner_client.post("/projects", json={"name": "Admin visible"}).json()["id"]
        current.update(sub="admin-1", roles=["admin"])
        assert any(row["id"] == project_id for row in planner_client.get("/projects").json())
        assert planner_client.get(f"/projects/{project_id}/scene").status_code == 200
    finally:
        planner_app.dependency_overrides.pop(get_auth_context, None)
