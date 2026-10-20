"""Queue one HTML reminder per order stage, counted in Russian working days."""

import logging
import os
from datetime import date, datetime, timedelta, timezone
from html import escape
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from common.ru_workdays import add_working_days, reminder_date

from .db import SessionLocal
from .models import CrmProductionOrder, CrmStageReminder, ShopSettings
from .order_email import RECIPIENT, send_email

log = logging.getLogger(__name__)
MOSCOW = ZoneInfo("Europe/Moscow")
STAGE_ORDER = (
    "черновой замер",
    "чистовой замер",
    "выбор цветов",
    "технолог",
    "распил-фасады-фурнитура",
    "доставлено",
    "собрано",
    "готово",
)
STAGE_ALIASES = {
    "готова": "готово",
    "конструктор": "технолог",
    "закупка": "распил-фасады-фурнитура",
    "сборка": "собрано",
}
DEFAULT_LEAD_DAYS = 2


def stage_index(status: str) -> int:
    canonical = STAGE_ALIASES.get(status, status)
    try:
        return STAGE_ORDER.index(canonical)
    except ValueError:
        return -1


def normalize_stage_workdays(raw: dict | None) -> dict[str, int]:
    from fastapi import HTTPException

    if not raw:
        return {}
    cleaned: dict[str, int] = {}
    for key, value in raw.items():
        if key not in STAGE_ORDER:
            raise HTTPException(status_code=400, detail=f"Неизвестный этап: {key}")
        days = int(value)
        if days < 1 or days > 366:
            raise HTTPException(status_code=400, detail="Срок этапа — от 1 до 366 рабочих дней")
        cleaned[key] = days
    return cleaned


def lead_days(session: Session) -> int:
    row = session.scalar(select(ShopSettings).order_by(ShopSettings.id).limit(1))
    if row is None or row.stage_alert_lead_days is None:
        return DEFAULT_LEAD_DAYS
    return int(row.stage_alert_lead_days)


def moscow_date(moment: datetime) -> date:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(MOSCOW).date()


def _ru_days(count: int) -> str:
    number = abs(int(count))
    tail = number % 100
    last = number % 10
    if 11 <= tail <= 14:
        word = "дней"
    elif last == 1:
        word = "день"
    elif 2 <= last <= 4:
        word = "дня"
    else:
        word = "дней"
    return f"{number} {word}"


def _when_phrase(days_left: int) -> str:
    if days_left <= 0:
        return "сегодня"
    return f"через {_ru_days(days_left)}"


def build_stage_reminder(order: CrmProductionOrder, stage: str, deadline: date, today: date) -> tuple[str, str, str]:
    days_left = (deadline - today).days
    when = _when_phrase(days_left)
    deadline_label = deadline.strftime("%d.%m.%Y")
    subject = f"Петров — заказ №{order.id}: «{stage}» {when}"
    text = (
        "ПЕТРОВ — СРОК ЭТАПА\n\n"
        f"Заказ №{order.id}: {order.title}\n"
        f"Клиент: {order.customer or 'Не указан'}\n"
        f"Сейчас: {order.status}\n"
        f"Нужно довести до этапа «{stage}» {when}.\n"
        f"Крайний срок: {deadline_label}.\n"
    )
    html = f"""<!doctype html>
<html lang="ru"><body style="margin:0;background:#efe8dc;color:#2a241c;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" style="max-width:640px;background:#fffaf3;border-radius:18px" cellspacing="0" cellpadding="0">
<tr><td style="padding:28px 32px;background:#273d32;color:#f4efe6;border-radius:18px 18px 0 0">
<div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px">ПЕТРОВ · МЕБЕЛЬ</div>
<div style="margin-top:18px;font-family:Arial,sans-serif;font-size:13px;opacity:.85">Напоминание по заказу</div>
<h1 style="margin:6px 0 0;font-size:32px;font-weight:normal">№{order.id}</h1>
</td></tr>
<tr><td style="padding:28px 32px">
<p style="margin:0 0 8px;font-size:22px">{escape(order.title)}</p>
<p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:14px;color:#677165">Клиент: {escape(order.customer or "Не указан")} · сейчас «{escape(order.status)}»</p>
<div style="padding:22px;background:#f6f1e7;border-radius:14px">
<div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#8a5a32">ДОВЕСТИ ДО ЭТАПА</div>
<div style="margin-top:8px;font-size:28px">{escape(stage)}</div>
<div style="margin-top:14px;font-family:Arial,sans-serif;font-size:18px">{escape(when)}</div>
<div style="margin-top:6px;font-family:Arial,sans-serif;font-size:14px;color:#677165">Крайний срок — {deadline_label}</div>
</div>
<p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#677165">Срок посчитан в рабочих днях по производственному календарю России. Письмо уходит один раз, на {escape(RECIPIENT)}.</p>
</td></tr></table>
</td></tr></table></body></html>"""
    return subject, text, html


def scan_stage_reminders(session: Session, today: date) -> int:
    """Queue reminders whose window opens today. Already queued stages are left untouched."""
    ahead = lead_days(session)
    existing = {
        (order_id, stage)
        for order_id, stage in session.execute(select(CrmStageReminder.order_id, CrmStageReminder.stage))
    }
    created = 0
    orders = list(session.scalars(select(CrmProductionOrder)))
    now = datetime.now(timezone.utc)
    for order in orders:
        workdays = order.stage_workdays or {}
        current = stage_index(order.status)
        started = moscow_date(order.created_at)
        for stage, days in workdays.items():
            if stage not in STAGE_ORDER or (order.id, stage) in existing:
                continue
            target = stage_index(stage)
            if target < 0 or current >= target:
                continue
            deadline = add_working_days(started, int(days))
            notify_on = reminder_date(deadline, ahead)
            if today < notify_on or today > deadline:
                continue
            subject, text, html = build_stage_reminder(order, stage, deadline, today)
            session.add(
                CrmStageReminder(
                    order_id=order.id,
                    stage=stage,
                    deadline_on=deadline,
                    subject=subject,
                    text_body=text,
                    html_body=html,
                    created_at=now,
                    next_attempt_at=now,
                )
            )
            created += 1
    return created


def scan_due_stage_reminders() -> int:
    with SessionLocal() as session:
        created = scan_stage_reminders(session, datetime.now(MOSCOW).date())
        session.commit()
        return created


def deliver_stage_reminders() -> bool:
    with SessionLocal() as session:
        now = datetime.now(timezone.utc)
        row = session.scalar(
            select(CrmStageReminder)
            .where(CrmStageReminder.sent_at.is_(None), CrmStageReminder.next_attempt_at <= now)
            .order_by(CrmStageReminder.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if row is None:
            return False
        row.attempts += 1
        domain = "petrovmebel.ru"
        try:
            from_addr = os.getenv("SMTP_FROM") or os.environ.get("SMTP_USER", "")
            if "@" in from_addr:
                domain = from_addr.split("@", 1)[1]
            send_email(row, message_id=f"<petrov-stage-{row.id}@{domain}>")
        except Exception as exc:
            log.error("Stage reminder %s delivery failed (%s); retry scheduled", row.id, type(exc).__name__)
            row.next_attempt_at = now + timedelta(seconds=min(3600, 30 * 2 ** min(row.attempts, 7)))
        else:
            row.sent_at = datetime.now(timezone.utc)
        session.commit()
        return True
