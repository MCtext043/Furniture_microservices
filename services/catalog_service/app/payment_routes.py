"""Shop SBP payments via НКО ЭЛПЛАТ."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_session
from .elplat import (
    ElplatConfig,
    ElplatError,
    create_dynamic_qr,
    get_pay_status,
    rub_to_kopecks,
    sanitize_elplat_text,
)
from .models import ShopSbpPayment

router = APIRouter(prefix="/payments/sbp", tags=["payments"])


class SbpPaymentCreateIn(BaseModel):
    amount_rub: float = Field(gt=0, le=10_000_000)
    payment_purpose: str = Field(default="Оплата заказа мебели", max_length=140)
    email: str = Field(default="", max_length=120)
    user_id: str = Field(default="", max_length=64)
    customer_name: str = Field(default="", max_length=120)


class SbpPaymentOut(BaseModel):
    id: int
    status: str
    amount_rub: float
    amount_kopecks: int
    payment_purpose: str
    qrc_id: str | None = None
    qr_data: str | None = None
    payment_url: str | None = None
    ebl27: str | None = None
    created_at: str | None = None
    paid_at: str | None = None
    elplat_enabled: bool = True


class SbpCallbackAck(BaseModel):
    status: bool = True


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _payment_out(row: ShopSbpPayment, *, enabled: bool = True) -> SbpPaymentOut:
    return SbpPaymentOut(
        id=row.id,
        status=row.status,
        amount_rub=float(row.amount_rub),
        amount_kopecks=int(row.amount_kopecks),
        payment_purpose=row.payment_purpose,
        qrc_id=row.qrc_id or None,
        qr_data=row.qr_data or None,
        payment_url=row.qr_data or None,
        ebl27=row.ebl27 or None,
        created_at=_iso(row.created_at),
        paid_at=_iso(row.paid_at),
        elplat_enabled=enabled,
    )


def _mark_paid(row: ShopSbpPayment, *, ebl27: str = "", pay_phone: str = "", raw: dict | None = None) -> None:
    if row.status == "paid":
        return
    row.status = "paid"
    row.paid_at = datetime.now(timezone.utc)
    if ebl27:
        row.ebl27 = ebl27[:64]
    if pay_phone:
        row.pay_phone = pay_phone[:32]
    if raw is not None:
        row.callback_payload = json.dumps(raw, ensure_ascii=False)[:8000]


@router.get("/config")
def sbp_config() -> dict:
    cfg = ElplatConfig.from_env()
    return {
        "enabled": cfg.enabled,
        "org_id_set": bool(cfg.org_id),
        "callback_configured": bool(cfg.callback_url),
        "test_mode": "test" in cfg.base_url.lower() or cfg.login == "evolenta",
    }


@router.post("", response_model=SbpPaymentOut, status_code=201)
def create_sbp_payment(payload: SbpPaymentCreateIn, session: Session = Depends(get_session)) -> SbpPaymentOut:
    cfg = ElplatConfig.from_env()
    if not cfg.enabled:
        raise HTTPException(status_code=503, detail="Оплата СБП временно отключена (ELPLAT_ENABLED=0)")

    purpose = sanitize_elplat_text(payload.payment_purpose or "Оплата заказа мебели", 140)
    if not purpose:
        purpose = "Оплата заказа мебели"
    kopecks = rub_to_kopecks(payload.amount_rub)
    if kopecks < 100:
        raise HTTPException(status_code=400, detail="Минимальная сумма оплаты через СБП — 1 ₽")
    now = datetime.now(timezone.utc)
    row = ShopSbpPayment(
        user_id=payload.user_id or None,
        customer_name=sanitize_elplat_text(payload.customer_name, 120),
        email=sanitize_elplat_text(payload.email, 120),
        amount_rub=round(float(payload.amount_rub), 2),
        amount_kopecks=kopecks,
        payment_purpose=purpose,
        status="pending",
        created_at=now,
        updated_at=now,
    )
    session.add(row)
    session.flush()

    # Уникальное назначение с id платежа — удобно в callback
    purpose_with_id = sanitize_elplat_text(f"{purpose} #{row.id}", 140)
    row.payment_purpose = purpose_with_id

    try:
        created = create_dynamic_qr(
            cfg,
            amount_kopecks=kopecks,
            payment_purpose=purpose_with_id,
            email=row.email or "",
        )
    except ElplatError as exc:
        row.status = "failed"
        row.updated_at = datetime.now(timezone.utc)
        session.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    row.qrc_id = created["qrc_id"]
    row.qr_data = created["qr_data"]
    row.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(row)
    return _payment_out(row, enabled=True)


@router.get("/{payment_id}", response_model=SbpPaymentOut)
def get_sbp_payment(payment_id: int, session: Session = Depends(get_session)) -> SbpPaymentOut:
    row = session.get(ShopSbpPayment, payment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Платёж не найден")
    return _payment_out(row, enabled=ElplatConfig.from_env().enabled)


@router.post("/{payment_id}/refresh", response_model=SbpPaymentOut)
def refresh_sbp_payment(payment_id: int, session: Session = Depends(get_session)) -> SbpPaymentOut:
    """Резервный опрос getPay, если callback не дошёл."""
    row = session.get(ShopSbpPayment, payment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Платёж не найден")
    if row.status == "paid":
        return _payment_out(row)
    if not row.qrc_id:
        raise HTTPException(status_code=400, detail="У платежа нет qrcId")
    cfg = ElplatConfig.from_env()
    try:
        status = get_pay_status(cfg, row.qrc_id)
    except ElplatError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    trx = status.get("trx_status") or ""
    row.trx_status = trx
    row.updated_at = datetime.now(timezone.utc)
    if trx == "ACWP":
        _mark_paid(row, ebl27=status.get("ebl27") or "")
    elif trx == "RJCT":
        row.status = "failed"
    session.commit()
    session.refresh(row)
    return _payment_out(row)


@router.post("/callback", response_model=SbpCallbackAck)
async def elplat_callback(request: Request, session: Session = Depends(get_session)) -> SbpCallbackAck:
    """Callback от Элплат. Ответ всегда {"status":true} при успешной обработке тела."""
    try:
        payload = await request.json()
    except Exception:
        # Элплат ждёт status:true только при успехе; при битом теле вернём false
        return SbpCallbackAck(status=False)
    if not isinstance(payload, dict):
        return SbpCallbackAck(status=False)

    qrc_id = str(payload.get("qrcId") or "").strip()
    pay_status = payload.get("payStatus")
    row = None
    if qrc_id:
        row = session.scalar(select(ShopSbpPayment).where(ShopSbpPayment.qrc_id == qrc_id))
    if row is None:
        # Fallback: ищем по "#id" в назначении
        purpose = str(payload.get("paymentPurpose") or "")
        if "#" in purpose:
            tail = purpose.rsplit("#", 1)[-1].strip()
            if tail.isdigit():
                row = session.get(ShopSbpPayment, int(tail))

    if row is not None:
        row.callback_payload = json.dumps(payload, ensure_ascii=False)[:8000]
        row.updated_at = datetime.now(timezone.utc)
        if str(pay_status) == "1" or pay_status == 1:
            _mark_paid(
                row,
                ebl27=str(payload.get("ebl27") or ""),
                pay_phone=str(payload.get("payPhone") or ""),
                raw=payload,
            )
        elif row.status != "paid":
            row.status = "failed"
            row.trx_status = str(pay_status)
        session.commit()

    return SbpCallbackAck(status=True)
