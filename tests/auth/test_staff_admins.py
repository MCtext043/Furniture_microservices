from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from services.auth_service.app.main import _hash_password
from services.auth_service.app.models import User


def test_superadmin_can_create_staff_without_delete_role(auth_client: TestClient):
    created = auth_client.post(
        "/admins",
        json={"username": "manager01", "password": "password1"},
    )
    assert created.status_code == 201
    body = created.json()
    assert "admin" in body["roles"]
    assert "superadmin" not in body["roles"]
    assert body["email_verified"] is True


def test_staff_can_login(auth_client: TestClient, auth_engine, monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "unit-test-secret")
    SessionLocal = sessionmaker(bind=auth_engine, autoflush=False, autocommit=False)
    with SessionLocal() as session:
        session.add(
            User(
                username="manager02",
                password_hash=_hash_password("password1"),
                roles=["admin", "catalog:write"],
                email_verified=True,
            )
        )
        session.commit()
    token = auth_client.post("/token", json={"username": "manager02", "password": "password1"})
    assert token.status_code == 200
    assert token.json()["access_token"]
