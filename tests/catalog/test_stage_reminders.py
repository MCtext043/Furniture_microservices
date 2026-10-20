"""Stage deadlines in Russian working days and the advance email."""

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from services.catalog_service.app.models import CrmProductionOrder, CrmStageReminder
from services.catalog_service.app.stage_reminders import scan_stage_reminders


def _order(catalog_client: TestClient, workdays: dict, status: str = "черновой замер") -> dict:
    response = catalog_client.post(
        "/crm/orders",
        json={
            "title": "Кухня на срок",
            "customer": "Иванов",
            "status": status,
            "materials": [],
            "stage_workdays": workdays,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_order_stores_stage_workdays(catalog_client: TestClient):
    body = _order(catalog_client, {"технолог": 5, "готово": 12})
    assert body["stage_workdays"]["технолог"] == 5
    assert body["stage_workdays"]["готово"] == 12
    updated = catalog_client.patch(
        f"/crm/orders/{body['id']}",
        json={"stage_workdays": {"чистовой замер": 2}},
    )
    assert updated.status_code == 200
    assert updated.json()["stage_workdays"] == {"чистовой замер": 2}


def test_superadmin_lead_days_setting(catalog_client: TestClient):
    saved = catalog_client.put("/crm/stage-alert-settings", json={"lead_days": 4})
    assert saved.status_code == 200
    assert saved.json()["lead_days"] == 4
    assert catalog_client.get("/crm/stage-alert-settings").json()["lead_days"] == 4


def test_reminder_email_on_the_lead_day(catalog_client: TestClient, catalog_engine):
    catalog_client.put("/crm/stage-alert-settings", json={"lead_days": 2})
    order = _order(catalog_client, {"технолог": 3})
    Session = sessionmaker(bind=catalog_engine)
    with Session() as session:
        row = session.get(CrmProductionOrder, order["id"])
        row.created_at = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)
        session.commit()
    with Session() as session:
        created = scan_stage_reminders(session, date(2026, 10, 13))
        session.commit()
        assert created == 1
        mail = session.scalar(select(CrmStageReminder))
        assert mail.stage == "технолог"
        assert mail.deadline_on == date(2026, 10, 15)
        assert "Кухня на срок" in mail.html_body
        assert "технолог" in mail.html_body
        assert "через 2 дня" in mail.html_body
        assert "<html" in mail.html_body.lower()
        assert mail.sent_at is None
    with Session() as session:
        assert scan_stage_reminders(session, date(2026, 10, 13)) == 0


def test_no_reminder_before_the_window_or_after_stage_is_reached(catalog_client: TestClient, catalog_engine):
    catalog_client.put("/crm/stage-alert-settings", json={"lead_days": 2})
    waiting = _order(catalog_client, {"технолог": 3})
    done = _order(catalog_client, {"технолог": 3}, status="технолог")
    Session = sessionmaker(bind=catalog_engine)
    with Session() as session:
        for order_id in (waiting["id"], done["id"]):
            row = session.get(CrmProductionOrder, order_id)
            row.created_at = datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)
        session.commit()
    with Session() as session:
        assert scan_stage_reminders(session, date(2026, 10, 12)) == 0
        session.commit()
    with Session() as session:
        assert scan_stage_reminders(session, date(2026, 10, 13)) == 1
        session.commit()
        rows = list(session.scalars(select(CrmStageReminder)))
        assert len(rows) == 1
        assert rows[0].order_id == waiting["id"]
