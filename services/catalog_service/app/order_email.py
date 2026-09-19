"""Transactional email outbox; delivery runs outside the checkout request."""
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from html import escape
import logging
import os
import smtplib
import ssl
from threading import Event, Thread

from sqlalchemy import select

from .db import SessionLocal
from .models import OrderEmail

log = logging.getLogger(__name__)
RECIPIENT = "petrov_mebel@mail.ru"
TIERS = {"standard": "Стандарт", "comfort": "Комфорт", "premium": "Премиум"}


def enqueue_order_email(session, order, phone="", email=""):
    now = datetime.now(timezone.utc)
    details = [
        ("Заказ", f"№{order.id} · {order.title}"),
        ("Дата (UTC)", now.strftime("%d.%m.%Y %H:%M")),
        ("Клиент", order.customer or "Не указан"),
        ("Телефон", phone or "Не указан"),
        ("Email", email or "Не указан"),
        ("Статус", order.status),
    ]
    if order.planner_project_id is not None:
        details.append(("Проект", str(order.planner_project_id)))
    details.append(("Комплектация", TIERS.get(order.selected_tier, "Стандарт")))
    price = getattr(order, f"price_{order.selected_tier}", None)
    if price is not None:
        details.append(("Ориентировочная стоимость", f"{price:,.2f} ₽".replace(",", " ")))
    text = "ПЕТРОВ — НОВЫЙ ЗАКАЗ\n\n" + "\n".join(f"{label}: {value}" for label, value in details)
    rows = "".join(f'<tr><td style="padding:10px;color:#677165;width:38%">{escape(label)}</td><td style="padding:10px;font-weight:600">{escape(value)}</td></tr>' for label, value in details)
    material_rows = ""
    text += "\n\nМАТЕРИАЛЫ\n"
    for line in order.materials:
        text += f"{line.material_name}: {line.required_qty:g} {line.unit}\n"
        material_rows += f'<tr><td style="padding:10px;border-bottom:1px solid #e6e8e2">{escape(line.material_name)}</td><td style="padding:10px;border-bottom:1px solid #e6e8e2;text-align:right">{line.required_qty:g} {escape(line.unit)}</td></tr>'
    text += f"\nПРИМЕЧАНИЯ\n{order.notes or 'Нет'}\n"
    html = f'''<!doctype html><html lang="ru"><body style="margin:0;background:#f2f3ed;font-family:Arial,sans-serif;color:#253028">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" style="max-width:640px;background:white;border-radius:16px" cellspacing="0" cellpadding="0">
    <tr><td style="padding:28px;background:#273d32;color:white;border-radius:16px 16px 0 0"><div style="font-size:14px;letter-spacing:3px">ПЕТРОВ · МЕБЕЛЬ</div><h1 style="margin:12px 0 0;font-size:26px">Новый заказ №{order.id}</h1></td></tr>
    <tr><td style="padding:20px"><table width="100%" cellspacing="0">{rows}</table>
    <h2 style="font-size:18px;margin-top:28px">Материалы</h2><table width="100%" cellspacing="0"><tr><th style="text-align:left;padding:10px;background:#f2f3ed">Наименование</th><th style="text-align:right;padding:10px;background:#f2f3ed">Количество</th></tr>{material_rows}</table>
    <h2 style="font-size:18px;margin-top:28px">Примечания и параметры</h2><div style="padding:16px;background:#f2f3ed;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere">{escape(order.notes or 'Нет')}</div>
    <p style="font-size:12px;color:#677165;margin-top:24px">Заказ сохранён в CRM. Стоимость проекта предварительная и требует согласования.</p></td></tr></table>
    </td></tr></table></body></html>'''
    session.add(OrderEmail(order_id=order.id, subject=f"Петров — новый заказ №{order.id}", text_body=text, html_body=html, created_at=now, next_attempt_at=now))


def send_email(row):
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM") or os.environ["SMTP_USER"]
    message["To"] = RECIPIENT
    message["Subject"] = row.subject
    message["Message-ID"] = f"<petrov-order-{row.order_id}@{message['From'].split('@')[-1]}>"
    message.set_content(row.text_body)
    message.add_alternative(row.html_body, subtype="html")
    security = os.getenv("SMTP_SECURITY", "ssl")
    if security not in {"ssl", "starttls"}:
        raise ValueError("SMTP_SECURITY must be ssl or starttls")
    client = smtplib.SMTP_SSL if security == "ssl" else smtplib.SMTP
    kwargs = {"context": ssl.create_default_context()} if security == "ssl" else {}
    with client(os.getenv("SMTP_HOST", "smtp.yandex.ru"), int(os.getenv("SMTP_PORT", "465" if security == "ssl" else "587")), timeout=20, **kwargs) as smtp:
        if security == "starttls":
            smtp.starttls(context=ssl.create_default_context())
        smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


def deliver_pending():
    # Row locks prevent simultaneous workers from sending the same queued email.
    with SessionLocal() as session:
        now = datetime.now(timezone.utc)
        row = session.scalar(select(OrderEmail).where(OrderEmail.sent_at.is_(None), OrderEmail.next_attempt_at <= now).order_by(OrderEmail.id).limit(1).with_for_update(skip_locked=True))
        if row is None:
            return False
        row.attempts += 1
        try:
            send_email(row)
        except Exception as exc:
            # Do not log credentials or message contents.
            log.error("Order email %s delivery failed (%s); retry scheduled", row.order_id, type(exc).__name__)
            row.next_attempt_at = now + timedelta(seconds=min(3600, 30 * 2 ** min(row.attempts, 7)))
        else:
            row.sent_at = datetime.now(timezone.utc)
        session.commit()
        return True


def _worker(stop):
    while not stop.is_set():
        try:
            if deliver_pending():
                continue
        except Exception:
            log.exception("Order email outbox unavailable")
        stop.wait(10)


@asynccontextmanager
async def email_lifespan(app):
    stop = Event()
    thread = None
    if os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"):
        thread = Thread(target=_worker, args=(stop,), daemon=True, name="order-email")
        thread.start()
    else:
        log.warning("SMTP credentials missing: order emails remain queued until SMTP is configured")
    try:
        yield
    finally:
        stop.set()
        if thread:
            thread.join(timeout=1)
