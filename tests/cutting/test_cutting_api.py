from fastapi.testclient import TestClient


def test_optimize_sheet_and_save_job(cutting_client: TestClient):
    response = cutting_client.post(
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

    jobs = cutting_client.get("/jobs")
    assert jobs.status_code == 200
    assert len(jobs.json()) == 1
