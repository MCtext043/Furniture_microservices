"""Elplat SBP payments: hash, create payment (mocked), callback."""

from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from services.catalog_service.app.elplat import hash_create_qr, hash_get_pay, rub_to_kopecks, sanitize_elplat_text


def test_hash_create_qr_matches_concat_order():
    # Documented order; value is deterministic for fixed inputs
    h = hash_create_qr(
        login="evolenta",
        passwd="58b39410314c551b81bd24fac1d817ab",
        callback="http://example.com/cb",
        qrc_type="02",
        currency="RUB",
        org_id="430",
        amount="13",
        payment_purpose="Тест",
        email="",
        redirect_url="",
        subscription_purpose="",
    )
    assert len(h) == 32
    assert h == hash_create_qr(
        login="evolenta",
        passwd="58b39410314c551b81bd24fac1d817ab",
        callback="http://example.com/cb",
        qrc_type="02",
        currency="RUB",
        org_id="430",
        amount="13",
        payment_purpose="Тест",
    )


def test_hash_get_pay_and_sanitize():
    assert len(hash_get_pay(login="a", passwd="b", qrc_id="AD1")) == 32
    assert "'" not in sanitize_elplat_text("foo'bar\"baz\\x")
    assert rub_to_kopecks(12.34) == 1234


def test_create_sbp_payment_and_callback(catalog_client: TestClient, monkeypatch):
    monkeypatch.setenv("ELPLAT_ENABLED", "1")
    monkeypatch.setenv("ELPLAT_CALLBACK_URL", "http://127.0.0.1/catalog/payments/sbp/callback")
    monkeypatch.setenv("ELPLAT_LOGIN", "evolenta")
    monkeypatch.setenv("ELPLAT_PASSWD", "secret")
    monkeypatch.setenv("ELPLAT_ORG_ID", "430")
    monkeypatch.setenv("ELPLAT_BASE_URL", "http://sbpekvtest.el-plat.ru")

    fake = {
        "qr_data": "https://qr.nspk.ru/ADTEST123?type=02&bank=100000000086&crc=AAAA",
        "qrc_id": "ADTEST123",
        "raw": {"code": 0, "info": {"status": True}},
    }
    with patch("services.catalog_service.app.payment_routes.create_dynamic_qr", return_value=fake):
        created = catalog_client.post(
            "/payments/sbp",
            json={
                "amount_rub": 100.5,
                "payment_purpose": "Оплата заказа",
                "user_id": "u1",
            },
        )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "pending"
    assert body["amount_kopecks"] == 10050
    assert body["qrc_id"] == "ADTEST123"
    assert body["payment_url"] == fake["qr_data"]
    assert body["qr_data"].startswith("https://qr.nspk.ru/")
    payment_id = body["id"]

    cb = catalog_client.post(
        "/payments/sbp/callback",
        json={
            "qrcId": "ADTEST123",
            "payStatus": 1,
            "amount": "10050",
            "allAmount": "10050",
            "ebl27": "A3251TEST",
            "paymentPurpose": f"Оплата заказа #{payment_id}",
        },
    )
    assert cb.status_code == 200
    assert cb.json() == {"status": True}

    got = catalog_client.get(f"/payments/sbp/{payment_id}")
    assert got.status_code == 200
    assert got.json()["status"] == "paid"
    assert got.json()["ebl27"] == "A3251TEST"


def test_refresh_marks_paid_via_getpay(catalog_client: TestClient, monkeypatch):
    monkeypatch.setenv("ELPLAT_CALLBACK_URL", "http://127.0.0.1/cb")
    fake_create = {
        "qr_data": "https://qr.nspk.ru/ADREFRESH",
        "qrc_id": "ADREFRESH",
        "raw": {},
    }
    with patch("services.catalog_service.app.payment_routes.create_dynamic_qr", return_value=fake_create):
        created = catalog_client.post("/payments/sbp", json={"amount_rub": 1, "payment_purpose": "t"}).json()
    with patch(
        "services.catalog_service.app.payment_routes.get_pay_status",
        return_value={"trx_status": "ACWP", "ebl27": "EBL27X", "raw": {}},
    ):
        refreshed = catalog_client.post(f"/payments/sbp/{created['id']}/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["status"] == "paid"
    assert refreshed.json()["ebl27"] == "EBL27X"
