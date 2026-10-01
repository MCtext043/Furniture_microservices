"""Staff permission catalog and flexible role assignment."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from common.staff_permissions import (
    ASSIGNABLE_CODES,
    DEFAULT_STAFF_PERMISSION_CODES,
    normalize_staff_roles,
)
from services.auth_service.app.main import _hash_password
from services.auth_service.app.models import User


def test_normalize_staff_roles_default_excludes_delete():
    roles = normalize_staff_roles(None)
    assert roles[0] == "admin"
    assert "catalog:write" in roles
    assert "crm:orders:write" in roles
    assert "crm:orders:status" in roles
    assert "records:delete" not in roles
    assert "crm:orders:delete" not in roles
    assert "superadmin" not in roles


def test_normalize_staff_roles_filters_forbidden_and_unknown():
    roles = normalize_staff_roles(
        ["catalog:write", "superadmin", "*", "user", "not:a:role", "crm:orders:delete"]
    )
    assert roles == ["admin", "catalog:write", "crm:orders:delete"]
    assert set(roles[1:]).issubset(ASSIGNABLE_CODES)


def test_permission_catalog_endpoint(auth_client: TestClient):
    response = auth_client.get("/permission-catalog")
    assert response.status_code == 200
    body = response.json()
    codes = {item["code"] for item in body}
    assert "crm:orders:write" in codes
    assert "crm:orders:status" in codes
    assert "records:delete" in codes
    assert "superadmin" not in codes


def test_create_staff_with_custom_roles(auth_client: TestClient):
    created = auth_client.post(
        "/admins",
        json={
            "username": "crmonly01",
            "password": "password1",
            "roles": ["crm:orders:write", "crm:orders:status", "assets:write"],
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["roles"] == [
        "admin",
        "crm:orders:write",
        "crm:orders:status",
        "assets:write",
    ]
    assert "catalog:write" not in body["roles"]
    assert "superadmin" not in body["roles"]


def test_create_staff_default_roles_still_without_delete(auth_client: TestClient):
    created = auth_client.post(
        "/admins",
        json={"username": "manager01", "password": "password1"},
    )
    assert created.status_code == 201
    body = created.json()
    assert "admin" in body["roles"]
    assert "superadmin" not in body["roles"]
    for code in DEFAULT_STAFF_PERMISSION_CODES:
        assert code in body["roles"]
    assert "records:delete" not in body["roles"]
    assert "crm:orders:delete" not in body["roles"]


def test_update_staff_roles(auth_client: TestClient, auth_engine):
    SessionLocal = sessionmaker(bind=auth_engine, autoflush=False, autocommit=False)
    with SessionLocal() as session:
        user = User(
            username="manager03",
            password_hash=_hash_password("password1"),
            roles=["admin", "catalog:write"],
            email_verified=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id

    updated = auth_client.patch(
        f"/admins/{user_id}",
        json={"roles": ["crm:orders:write", "crm:orders:delete"]},
    )
    assert updated.status_code == 200
    assert updated.json()["roles"] == ["admin", "crm:orders:write", "crm:orders:delete"]
