"""НКО ЭЛПЛАТ — СБП (динамический QR / платёжная ссылка).

Документация: createQr (qrcType=02), getPay, callback.
Ключи задаются через env; по умолчанию — тестовый контур.
"""

from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from typing import Any
from urllib import error, request
import json


FORBIDDEN_CHARS_RE = re.compile(r"[\\\"']")


def sanitize_elplat_text(value: str, max_len: int = 140) -> str:
    """Элплат запрещает \\ ' \" в текстовых полях."""
    cleaned = FORBIDDEN_CHARS_RE.sub(" ", value or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_len]


@dataclass(frozen=True)
class ElplatConfig:
    enabled: bool
    base_url: str
    login: str
    passwd: str
    org_id: str
    callback_url: str
    redirect_url: str
    qr_ttl_minutes: int

    @classmethod
    def from_env(cls) -> "ElplatConfig":
        enabled_raw = os.getenv("ELPLAT_ENABLED", "1").strip().lower()
        return cls(
            enabled=enabled_raw in {"1", "true", "yes", "on"},
            base_url=os.getenv("ELPLAT_BASE_URL", "http://sbpekvtest.el-plat.ru").rstrip("/"),
            login=os.getenv("ELPLAT_LOGIN", "evolenta"),
            passwd=os.getenv("ELPLAT_PASSWD", "58b39410314c551b81bd24fac1d817ab"),
            org_id=os.getenv("ELPLAT_ORG_ID", "430"),
            callback_url=os.getenv("ELPLAT_CALLBACK_URL", "").strip(),
            redirect_url=os.getenv("ELPLAT_REDIRECT_URL", "").strip()
            or os.getenv("PUBLIC_APP_URL", "").strip(),
            qr_ttl_minutes=max(5, min(129600, int(os.getenv("ELPLAT_QR_TTL_MINUTES", "60") or "60"))),
        )


def _md5_hex(raw: str) -> str:
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def hash_create_qr(
    *,
    login: str,
    passwd: str,
    callback: str,
    qrc_type: str,
    currency: str,
    org_id: str,
    amount: str,
    payment_purpose: str,
    email: str = "",
    redirect_url: str = "",
    subscription_purpose: str = "",
) -> str:
    """hashId для createQr: login+passwd+callback+qrcType+currency+orgId+amount+paymentPurpose+email+redirectUrl+subscriptionPurpose."""
    parts = [
        login,
        passwd,
        callback,
        qrc_type,
        currency,
        org_id,
        amount,
        payment_purpose,
        email,
        redirect_url,
        subscription_purpose,
    ]
    return _md5_hex("".join(parts))


def hash_get_pay(*, login: str, passwd: str, qrc_id: str) -> str:
    return _md5_hex(f"{login}{passwd}{qrc_id}")


def rub_to_kopecks(amount_rub: float) -> int:
    return int(round(float(amount_rub) * 100))


class ElplatError(RuntimeError):
    pass


def _post_json(base_url: str, payload: dict[str, Any], timeout: float = 25.0) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        base_url,
        data=body,
        method="POST",
        headers={
            # Элплат принимает строго application/json без charset=
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "Accept": "application/json",
        },
    )
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ElplatError(f"Элплат HTTP {exc.code}: {detail[:300]}") from exc
    except error.URLError as exc:
        raise ElplatError(f"Элплат недоступен: {exc.reason}") from exc
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ElplatError(f"Некорректный JSON от Элплат: {raw[:200]}") from exc
    if not isinstance(data, dict):
        raise ElplatError("Некорректный ответ Элплат")
    return data


def create_dynamic_qr(
    cfg: ElplatConfig,
    *,
    amount_kopecks: int,
    payment_purpose: str,
    email: str = "",
    callback_url: str | None = None,
) -> dict[str, Any]:
    """Динамический QR (qrcType=02) для сайта: возвращает qrData + qrcId."""
    if amount_kopecks < 100:
        raise ElplatError("Минимальная сумма оплаты через СБП — 1 рубль")
    callback = (callback_url or cfg.callback_url).strip()
    if not callback:
        # Для локального/тестового контура можно слать на официальный test.php Элплат
        callback = "http://sbpekvaring.el-plat.ru/test.php"
    purpose = sanitize_elplat_text(payment_purpose, 140)
    email_clean = sanitize_elplat_text(email, 120)
    redirect = sanitize_elplat_text(cfg.redirect_url, 255)
    amount = str(int(amount_kopecks))
    qrc_type = "02"
    currency = "RUB"
    hash_id = hash_create_qr(
        login=cfg.login,
        passwd=cfg.passwd,
        callback=callback,
        qrc_type=qrc_type,
        currency=currency,
        org_id=cfg.org_id,
        amount=amount,
        payment_purpose=purpose,
        email=email_clean,
        redirect_url=redirect,
        subscription_purpose="",
    )
    payload: dict[str, Any] = {
        "type": "createQr",
        "login": cfg.login,
        "callback": callback,
        "qrcType": qrc_type,
        "currency": currency,
        "orgId": str(cfg.org_id),
        "amount": amount,
        "paymentPurpose": purpose,
        "hashId": hash_id,
        "qrTtl": str(cfg.qr_ttl_minutes),
    }
    if email_clean:
        payload["email"] = email_clean
    if redirect:
        payload["redirectUrl"] = redirect
    data = _post_json(cfg.base_url, payload)
    info = data.get("info") or {}
    if not info.get("status"):
        raise ElplatError(str(info.get("descr") or data.get("comment") or "createQr неуспешен"))
    qr_data = str(info.get("qrData") or "").strip()
    qrc_id = str(info.get("qrcId") or "").strip()
    if not qr_data or not qrc_id:
        raise ElplatError("Элплат не вернул qrData/qrcId")
    return {"qr_data": qr_data, "qrc_id": qrc_id, "raw": data}


def get_pay_status(cfg: ElplatConfig, qrc_id: str) -> dict[str, Any]:
    """Резервный статус динамического QR (getPay)."""
    hash_id = hash_get_pay(login=cfg.login, passwd=cfg.passwd, qrc_id=qrc_id)
    payload = {
        "type": "getPay",
        "login": cfg.login,
        "qrcId": qrc_id,
        "hashId": hash_id,
    }
    data = _post_json(cfg.base_url, payload)
    info = data.get("info") or {}
    if not info.get("status"):
        raise ElplatError(str(info.get("descr") or "getPay неуспешен"))
    return {
        "trx_status": str(info.get("trxStatus") or ""),
        "ebl27": str(info.get("ebl27") or ""),
        "raw": data,
    }
