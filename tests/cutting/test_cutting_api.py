import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from services.cutting_service.app.db import Base, get_session
from services.cutting_service.app.main import app


def _client() -> TestClient:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_session():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    return TestClient(app)


def test_optimize_sheet_and_save_job():
    client = _client()
    response = client.post(
        "/optimize",
        json={
            "sheet_width": 1000,
            "sheet_height": 500,
            "parts": [
                {"name": "Боковина", "width": 300, "height": 200, "quantity": 3},
                {"name": "Полка", "width": 200, "height": 100, "quantity": 2},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["placed_count"] > 0
    assert body["requested_count"] == 5

    jobs = client.get("/jobs")
    assert jobs.status_code == 200
    assert len(jobs.json()) == 1
