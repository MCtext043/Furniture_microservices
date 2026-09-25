"""Transactional staff invitation / email confirmation."""

from __future__ import annotations

from email.message import EmailMessage
from html import escape
import logging
import os
import smtplib
import ssl

log = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_USER", "").strip() and os.getenv("SMTP_PASSWORD", "").strip())


def send_staff_email(*, to_addr: str, subject: str, text_body: str, html_body: str) -> None:
    if not smtp_configured():
        raise RuntimeError("SMTP is not configured")
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM") or os.environ["SMTP_USER"]
    message["To"] = to_addr
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    security = os.getenv("SMTP_SECURITY", "ssl")
    if security not in {"ssl", "starttls"}:
        raise ValueError("SMTP_SECURITY must be ssl or starttls")
    client = smtplib.SMTP_SSL if security == "ssl" else smtplib.SMTP
    kwargs = {"context": ssl.create_default_context()} if security == "ssl" else {}
    with client(
        os.getenv("SMTP_HOST", "smtp.yandex.ru"),
        int(os.getenv("SMTP_PORT", "465" if security == "ssl" else "587")),
        timeout=20,
        **kwargs,
    ) as smtp:
        if security == "starttls":
            smtp.starttls(context=ssl.create_default_context())
        smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


def verification_bodies(username: str, verify_url: str) -> tuple[str, str]:
    text = (
        f"ПЕТРОВ — подтверждение почты администратора\n\n"
        f"Логин: {username}\n"
        f"Откройте ссылку, чтобы подтвердить почту:\n{verify_url}\n"
    )
    html = (
        '<!doctype html><html lang="ru"><body style="font-family:Arial,sans-serif;color:#2b251d">'
        "<h1>Подтверждение почты</h1>"
        f"<p>Логин: <strong>{escape(username)}</strong></p>"
        f'<p><a href="{escape(verify_url)}">Подтвердить почту</a></p>'
        "</body></html>"
    )
    return text, html
