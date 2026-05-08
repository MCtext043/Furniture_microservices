from fastapi.testclient import TestClient


def _is_overlap(a: dict, b: dict) -> bool:
    ax1, ay1 = a["x"], a["y"]
    ax2, ay2 = ax1 + a["width"], ay1 + a["height"]
    bx1, by1 = b["x"], b["y"]
    bx2, by2 = bx1 + b["width"], by1 + b["height"]
    return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1


def _assert_no_overlap_per_sheet(sheets: list[dict]) -> None:
    for sheet in sheets:
        placements = sheet["placements"]
        for i in range(len(placements)):
            for j in range(i + 1, len(placements)):
                assert not _is_overlap(placements[i], placements[j]), (
                    f"Overlap on sheet {sheet['sheet_index']} between "
                    f"{placements[i]['name']} and {placements[j]['name']}"
                )


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
    assert body["total_sheets"] >= 1
    assert body["total_used_area"] > 0
    assert body["total_unused_area"] >= 0
    _assert_no_overlap_per_sheet(body["sheets"])

    jobs = cutting_client.get("/jobs")
    assert jobs.status_code == 200
    assert len(jobs.json()) == 1


def test_auto_transfer_to_next_sheet_and_area_accounting(cutting_client: TestClient):
    response = cutting_client.post(
        "/optimize",
        json={
            "sheet_width": 1000,
            "sheet_height": 500,
            "parts": [
                {"name": "Деталь A", "width": 700, "height": 300, "quantity": 3},
                {"name": "Деталь B", "width": 300, "height": 200, "quantity": 2},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["placed_count"] == 5
    assert body["requested_count"] == 5
    assert body["total_sheets"] == 3
    assert len(body["unplaced_parts"]) == 0

    sheet_area = 1000 * 500
    expected_total_area = sheet_area * body["total_sheets"]
    assert body["total_used_area"] + body["total_unused_area"] == expected_total_area
    _assert_no_overlap_per_sheet(body["sheets"])


def test_unplaced_parts_reported_for_oversized_details(cutting_client: TestClient):
    response = cutting_client.post(
        "/optimize",
        json={
            "sheet_width": 1000,
            "sheet_height": 500,
            "parts": [
                {"name": "Сверхдлинная", "width": 1200, "height": 200, "quantity": 2},
                {"name": "Нормальная", "width": 400, "height": 250, "quantity": 1},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["requested_count"] == 3
    assert body["placed_count"] == 1
    assert body["total_sheets"] == 1
    assert len(body["unplaced_parts"]) == 1
    assert body["unplaced_parts"][0]["name"] == "Сверхдлинная"
    assert body["unplaced_parts"][0]["quantity"] == 2
    _assert_no_overlap_per_sheet(body["sheets"])
