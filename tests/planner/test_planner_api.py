import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from services.planner_service.app.db import Base, get_session
from services.planner_service.app.main import app


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


def test_create_project_and_add_furniture():
    client = _client()
    project = client.post("/projects", json={"name": "Кухня-гостиная", "location": "Москва"})
    assert project.status_code == 201
    project_id = project.json()["id"]

    furniture = client.post(
        f"/projects/{project_id}/furniture",
        json={
            "name": "Угловой шкаф",
            "width": 1.2,
            "depth": 0.6,
            "height": 2.4,
            "x": 0.0,
            "y": 0.0,
            "z": 0.0,
            "rotation_y": 90.0,
        },
    )
    assert furniture.status_code == 201

    listed = client.get(f"/projects/{project_id}/furniture")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
