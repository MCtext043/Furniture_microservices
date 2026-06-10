from fastapi.testclient import TestClient


def test_create_project_and_add_furniture(planner_client: TestClient):
    project = planner_client.post("/projects", json={"name": "Кухня-гостиная", "location": "Москва"})
    assert project.status_code == 201
    project_id = project.json()["id"]

    furniture = planner_client.post(
        f"/projects/{project_id}/furniture",
        json={
            "name": "Угловой шкаф",
            "width": 1200,
            "depth": 600,
            "height": 2400,
            "x": 0.0,
            "y": 0.0,
            "z": 0.0,
            "rotation_y": 90.0,
        },
    )
    assert furniture.status_code == 201

    listed = planner_client.get(f"/projects/{project_id}/furniture")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
