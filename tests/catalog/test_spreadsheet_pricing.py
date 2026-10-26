from fastapi.testclient import TestClient


def test_pricing_settings_are_editable_by_admin(catalog_client: TestClient):
    response = catalog_client.get("/settings/pricing")
    assert response.status_code == 200
    config = response.json()
    assert config["packaging"] == 1000
    assert config["delivery"] == 3000
    assert len(config["tiers"]) == 4
    config["packaging"] = 1200
    config["tiers"][3]["prices"]["hinges"] = 555
    saved = catalog_client.put("/settings/pricing", json=config)
    assert saved.status_code == 200
    assert saved.json()["packaging"] == 1200
    assert saved.json()["tiers"][3]["prices"]["hinges"] == 555
