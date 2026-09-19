from datetime import datetime, timezone
from unittest.mock import MagicMock

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from services.catalog_service.app import order_email
from services.catalog_service.app.models import OrderEmail
from .test_crm_workflow import _seed_material


def _submit(client):
    material_id = _seed_material(client, "Дуб <натуральный>")
    response = client.post("/crm/orders/submit-project", json={
        "planner_project_id": 42, "title": "Кухня", "customer": "Иван <script>",
        "customer_phone": "+7 999 123-45-67", "customer_email": "ivan@example.com",
        "user_id": "7", "pricing": {"standard": 100000, "comfort": 150000, "premium": 200000},
        "selected_tier": "comfort", "notes": "Комната 6000×5000 мм\n<test>",
        "materials": [{"material_id": material_id, "required_qty": 12}],
    })
    assert response.status_code == 201
    return response.json()["id"]


def test_submission_queues_formatted_email(catalog_client, catalog_engine):
    order_id = _submit(catalog_client)
    with sessionmaker(bind=catalog_engine)() as session:
        row = session.scalar(select(OrderEmail))
        assert row.order_id == order_id
        assert row.sent_at is None
        assert "+7 999 123-45-67" in row.html_body
        assert "ivan@example.com" in row.html_body
        assert "150 000.00 ₽" in row.html_body
        assert "Комфорт" in row.html_body
        assert "Иван &lt;script&gt;" in row.html_body
        assert "Дуб &lt;натуральный&gt;" in row.html_body
        assert "<script>" not in row.html_body
        assert "Комната 6000×5000 мм" in row.text_body


def test_failed_delivery_retries_without_losing_order(catalog_client, catalog_engine, monkeypatch):
    _submit(catalog_client)
    monkeypatch.setattr(order_email, "SessionLocal", sessionmaker(bind=catalog_engine))
    send = MagicMock(side_effect=ConnectionError("offline"))
    monkeypatch.setattr(order_email, "send_email", send)
    assert order_email.deliver_pending()
    with sessionmaker(bind=catalog_engine)() as session:
        row = session.scalar(select(OrderEmail))
        assert row.attempts == 1
        assert row.sent_at is None
        assert row.next_attempt_at > row.created_at
        row.next_attempt_at = datetime.now(timezone.utc)
        session.commit()
    send.side_effect = None
    assert order_email.deliver_pending()
    assert not order_email.deliver_pending()
    assert send.call_count == 2
    with sessionmaker(bind=catalog_engine)() as session:
        assert session.scalar(select(OrderEmail)).sent_at is not None


def test_smtp_sends_html_and_plain_text(catalog_client, catalog_engine, monkeypatch):
    _submit(catalog_client)
    monkeypatch.setenv("SMTP_USER", "sender@yandex.ru")
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_PORT", raising=False)
    monkeypatch.setenv("SMTP_PASSWORD", "test-app-password")
    monkeypatch.setenv("SMTP_SECURITY", "ssl")
    monkeypatch.delenv("SMTP_FROM", raising=False)
    smtp = MagicMock()
    monkeypatch.setattr(order_email.smtplib, "SMTP_SSL", smtp)
    with sessionmaker(bind=catalog_engine)() as session:
        order_email.send_email(session.scalar(select(OrderEmail)))
    connection = smtp.return_value.__enter__.return_value
    assert smtp.call_args.args == ("smtp.yandex.ru", 465)
    connection.login.assert_called_once_with("sender@yandex.ru", "test-app-password")
    message = connection.send_message.call_args.args[0]
    assert message["To"] == "petrov_mebel@mail.ru"
    assert message["From"] == "sender@yandex.ru"
    assert message.get_body(preferencelist=("html",)) is not None
    assert message.get_body(preferencelist=("plain",)) is not None


def test_invalid_order_does_not_queue_email(catalog_client, catalog_engine):
    response = catalog_client.post("/crm/orders", json={
        "title": "Шкаф", "materials": [{"material_id": 999999, "required_qty": 1}],
    })
    assert response.status_code == 404
    with sessionmaker(bind=catalog_engine)() as session:
        assert session.scalar(select(OrderEmail)) is None
