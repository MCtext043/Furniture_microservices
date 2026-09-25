"""Production CRM: orders, warehouse stock, procurement shortages."""

from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from common.jwt_auth import ensure_can_delete, ensure_catalog_writer

from .db import get_session
from .order_email import enqueue_order_email
from .models import (
    CrmMaterial,
    CrmOrderMaterial,
    CrmOrderPhoto,
    CrmOrderProcurement,
    CrmOrderReceipt,
    CrmProductionOrder,
    CrmWarehouseStock,
)
from .schemas import (
    CrmMaterialCreate,
    CrmMaterialOut,
    CrmMaterialUpdate,
    CrmOrderCreate,
    CrmOrderMaterialLine,
    CrmOrderOut,
    CrmOrderPhotoCreate,
    CrmOrderPhotoOut,
    CrmOrderProcurementOut,
    CrmOrderReceiptCreate,
    CrmOrderReceiptOut,
    CrmOrderStatusUpdate,
    CrmProcurementLine,
    CrmProcurementLineUpdateIn,
    CrmSubmitProjectIn,
    CrmWarehouseStockOut,
    CrmWarehouseStockUpdate,
    CrmOrderMaterialLineIn,
)

router = APIRouter(prefix="/crm", tags=["crm"])

CRM_MIGRATION_HINT = (
    "Таблицы CRM не созданы. Выполните миграции: "
    "docker compose run --rm migrate (или полный деплой без -Fast)."
)

F = TypeVar("F", bound=Callable)


def crm_db_guard(func: F) -> F:
    @wraps(func)
    def wrapper(*args, **kwargs):
        session = kwargs.get("session")
        try:
            return func(*args, **kwargs)
        except (ProgrammingError, OperationalError) as exc:
            if session is not None:
                session.rollback()
            raise HTTPException(status_code=503, detail=CRM_MIGRATION_HINT) from exc

    return wrapper  # type: ignore[return-value]


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _get_or_create_material(
    session: Session,
    *,
    material_id: int | None = None,
    name: str | None = None,
    unit: str | None = None,
) -> CrmMaterial:
    if material_id:
        material = session.get(CrmMaterial, material_id)
        if not material:
            raise HTTPException(status_code=404, detail=f"Материал {material_id} не найден")
        return material
    clean_name = (name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Укажите материал")
    material = session.scalar(select(CrmMaterial).where(CrmMaterial.name == clean_name))
    if material:
        return material
    material = CrmMaterial(name=clean_name, unit=unit or "шт", purchase_price_rub=0)
    session.add(material)
    session.flush()
    session.add(CrmWarehouseStock(material_id=material.id, quantity=0))
    return material


def _order_material_lines(session: Session, order_id: int) -> list[CrmOrderMaterial]:
    return list(
        session.scalars(
            select(CrmOrderMaterial)
            .options(joinedload(CrmOrderMaterial.material))
            .where(CrmOrderMaterial.order_id == order_id)
        ).unique()
    )


def _stock_map(session: Session) -> dict[int, float]:
    rows = session.scalars(select(CrmWarehouseStock)).all()
    return {row.material_id: float(row.quantity) for row in rows}


def _procurement_lines(required: float, stock: float) -> tuple[float, float, float]:
    in_stock = stock
    to_buy = max(0.0, required - stock)
    return required, in_stock, to_buy


def _order_out(session: Session, order: CrmProductionOrder) -> CrmOrderOut:
    lines = _order_material_lines(session, order.id)
    return CrmOrderOut(
        id=order.id,
        title=order.title,
        customer=order.customer,
        status=order.status,
        notes=order.notes,
        planner_project_id=order.planner_project_id,
        user_id=order.user_id,
        price_standard=float(order.price_standard) if order.price_standard is not None else None,
        price_comfort=float(order.price_comfort) if order.price_comfort is not None else None,
        price_premium=float(order.price_premium) if order.price_premium is not None else None,
        selected_tier=order.selected_tier or "standard",
        materials=[
            CrmOrderMaterialLine(
                material_id=line.material_id,
                material_name=line.material.name,
                unit=line.material.unit,
                required_qty=float(line.required_qty),
            )
            for line in lines
        ],
        created_at=_iso(order.created_at),
        status_changed_at=_iso(order.status_changed_at),
    )


def _add_order_lines(session: Session, order_id: int, materials: list) -> None:
    for line in materials:
        material = _get_or_create_material(
            session,
            material_id=getattr(line, "material_id", None),
            name=getattr(line, "material_name", None),
            unit=getattr(line, "unit", None),
        )
        session.add(
            CrmOrderMaterial(
                order_id=order_id,
                material_id=material.id,
                required_qty=line.required_qty,
            )
        )


@router.get("/materials", response_model=list[CrmMaterialOut])
@crm_db_guard
def list_materials(session: Session = Depends(get_session)) -> list[CrmMaterial]:
    return list(session.scalars(select(CrmMaterial).order_by(CrmMaterial.name)))


@router.post("/materials", response_model=CrmMaterialOut, status_code=201, dependencies=[Depends(ensure_catalog_writer)])
@crm_db_guard
def create_material(payload: CrmMaterialCreate, session: Session = Depends(get_session)) -> CrmMaterial:
    existing = session.scalar(select(CrmMaterial).where(CrmMaterial.name == payload.name))
    if existing:
        raise HTTPException(status_code=409, detail="Такой материал уже есть")
    material = CrmMaterial(**payload.model_dump())
    session.add(material)
    session.flush()
    session.add(CrmWarehouseStock(material_id=material.id, quantity=0))
    session.commit()
    session.refresh(material)
    return material


@router.patch("/materials/{material_id}", response_model=CrmMaterialOut, dependencies=[Depends(ensure_catalog_writer)])
@crm_db_guard
def update_material(
    material_id: int,
    payload: CrmMaterialUpdate,
    session: Session = Depends(get_session),
) -> CrmMaterial:
    material = session.get(CrmMaterial, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")
    if payload.name is not None:
        material.name = payload.name
    if payload.unit is not None:
        material.unit = payload.unit
    if payload.purchase_price_rub is not None:
        material.purchase_price_rub = payload.purchase_price_rub
    session.commit()
    session.refresh(material)
    return material


@router.get("/warehouse", response_model=list[CrmWarehouseStockOut])
@crm_db_guard
def list_warehouse(session: Session = Depends(get_session)) -> list[CrmWarehouseStockOut]:
    rows = session.scalars(
        select(CrmWarehouseStock).join(CrmMaterial).order_by(CrmMaterial.name)
    ).all()
    return [
        CrmWarehouseStockOut(
            material_id=row.material_id,
            material_name=row.material.name,
            unit=row.material.unit,
            quantity=float(row.quantity),
        )
        for row in rows
    ]


@router.put("/warehouse/{material_id}", response_model=CrmWarehouseStockOut, dependencies=[Depends(ensure_catalog_writer)])
@crm_db_guard
def update_warehouse_stock(
    material_id: int,
    payload: CrmWarehouseStockUpdate,
    session: Session = Depends(get_session),
) -> CrmWarehouseStockOut:
    material = session.get(CrmMaterial, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")
    row = session.get(CrmWarehouseStock, material_id)
    if not row:
        row = CrmWarehouseStock(material_id=material_id, quantity=payload.quantity)
        session.add(row)
    else:
        row.quantity = payload.quantity
    session.commit()
    session.refresh(row)
    return CrmWarehouseStockOut(
        material_id=row.material_id,
        material_name=material.name,
        unit=material.unit,
        quantity=float(row.quantity),
    )


@router.get("/orders", response_model=list[CrmOrderOut])
@crm_db_guard
def list_orders(session: Session = Depends(get_session)) -> list[CrmOrderOut]:
    orders = list(session.scalars(select(CrmProductionOrder).order_by(CrmProductionOrder.id.desc())))
    return [_order_out(session, order) for order in orders]


@router.get("/orders/user/{user_id}", response_model=list[CrmOrderOut])
@crm_db_guard
def list_user_orders(user_id: str, session: Session = Depends(get_session)) -> list[CrmOrderOut]:
    orders = list(
        session.scalars(
            select(CrmProductionOrder)
            .where(CrmProductionOrder.user_id == user_id)
            .order_by(CrmProductionOrder.id.desc())
        )
    )
    return [_order_out(session, order) for order in orders]


@router.delete("/orders/{order_id}", dependencies=[Depends(ensure_can_delete)])
@crm_db_guard
def delete_order(
    order_id: int,
    session: Session = Depends(get_session),
) -> dict[str, str]:
    """Удалить один заказ CRM по ID."""
    # Проверяем, существует ли заказ
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Каскадное удаление связанных данных
    session.execute(delete(CrmOrderPhoto).where(CrmOrderPhoto.order_id == order_id))
    session.execute(delete(CrmOrderReceipt).where(CrmOrderReceipt.order_id == order_id))
    session.execute(delete(CrmOrderMaterial).where(CrmOrderMaterial.order_id == order_id))
    session.execute(delete(CrmOrderProcurement).where(CrmOrderProcurement.order_id == order_id))
    
    # Удаляем сам заказ
    session.delete(order)
    session.commit()
    
    return {"status": "deleted", "order_id": str(order_id)}



@router.post("/orders", response_model=CrmOrderOut, status_code=201, dependencies=[Depends(ensure_catalog_writer)])
@crm_db_guard
def create_order(payload: CrmOrderCreate, session: Session = Depends(get_session)) -> CrmOrderOut:
    order = CrmProductionOrder(
        title=payload.title,
        customer=payload.customer,
        status=payload.status,
        notes=payload.notes,
    )
    session.add(order)
    session.flush()
    _add_order_lines(session, order.id, payload.materials)
    session.flush()
    enqueue_order_email(session, _order_out(session, order))
    session.commit()
    session.refresh(order)
    return _order_out(session, order)


@router.post("/orders/submit-project", response_model=CrmOrderOut, status_code=201)
@crm_db_guard
def submit_project_order(payload: CrmSubmitProjectIn, session: Session = Depends(get_session)) -> CrmOrderOut:
    now = datetime.now(timezone.utc)
    material_lines = list(payload.materials)
    if not material_lines and payload.cutting is not None:
        material_lines = [
            CrmOrderMaterialLineIn(
                material_name="Лист ДСП 16мм",
                unit="лист",
                required_qty=payload.cutting.total_sheets,
            )
        ]
    if not material_lines:
        raise HTTPException(status_code=400, detail="Нельзя отправить проект без раскроя или списка материалов")
    order = CrmProductionOrder(
        title=payload.title,
        customer=payload.customer,
        status="черновой замер",
        notes=payload.notes,
        planner_project_id=payload.planner_project_id,
        user_id=payload.user_id,
        price_standard=payload.pricing.standard,
        price_comfort=payload.pricing.comfort,
        price_premium=payload.pricing.premium,
        selected_tier=payload.selected_tier,
        created_at=now,
        status_changed_at=now,
    )
    session.add(order)
    session.flush()
    _add_order_lines(session, order.id, material_lines)
    session.flush()
    enqueue_order_email(session, _order_out(session, order), payload.customer_phone, payload.customer_email)
    session.commit()
    session.refresh(order)
    return _order_out(session, order)


@router.patch("/orders/{order_id}/status", response_model=CrmOrderOut, dependencies=[Depends(ensure_catalog_writer)])
@crm_db_guard
def update_order_status(
    order_id: int,
    payload: CrmOrderStatusUpdate,
    session: Session = Depends(get_session),
) -> CrmOrderOut:
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    order.status = payload.status
    order.status_changed_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(order)
    return _order_out(session, order)


@router.post(
    "/orders/{order_id}/photos",
    response_model=CrmOrderPhotoOut,
    status_code=201,
    dependencies=[Depends(ensure_catalog_writer)],
)
@crm_db_guard
def add_order_photo(
    order_id: int,
    payload: CrmOrderPhotoCreate,
    session: Session = Depends(get_session),
) -> CrmOrderPhotoOut:
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    photo = CrmOrderPhoto(
        order_id=order_id,
        object_key=payload.object_key,
        caption=payload.caption,
        created_at=datetime.now(timezone.utc),
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return CrmOrderPhotoOut(
        id=photo.id,
        order_id=photo.order_id,
        object_key=photo.object_key,
        caption=photo.caption,
        created_at=photo.created_at.isoformat(),
    )


@router.get("/orders/{order_id}/photos", response_model=list[CrmOrderPhotoOut])
@crm_db_guard
def list_order_photos(order_id: int, session: Session = Depends(get_session)) -> list[CrmOrderPhotoOut]:
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    photos = list(
        session.scalars(
            select(CrmOrderPhoto).where(CrmOrderPhoto.order_id == order_id).order_by(CrmOrderPhoto.id)
        )
    )
    return [
        CrmOrderPhotoOut(
            id=photo.id,
            order_id=photo.order_id,
            object_key=photo.object_key,
            caption=photo.caption,
            created_at=photo.created_at.isoformat(),
        )
        for photo in photos
    ]


@router.post(
    "/orders/{order_id}/receipts",
    response_model=CrmOrderReceiptOut,
    status_code=201,
    dependencies=[Depends(ensure_catalog_writer)],
)
@crm_db_guard
def add_order_receipt(
    order_id: int,
    payload: CrmOrderReceiptCreate,
    session: Session = Depends(get_session),
) -> CrmOrderReceiptOut:
    """Один админ фотографирует чек закупки; другой позже видит его в списке чеков заказа."""
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    receipt = CrmOrderReceipt(
        order_id=order_id,
        object_key=payload.object_key,
        note=payload.note,
        amount_rub=payload.amount_rub,
        uploaded_by=payload.uploaded_by,
        created_at=datetime.now(timezone.utc),
    )
    session.add(receipt)
    session.commit()
    session.refresh(receipt)
    return CrmOrderReceiptOut(
        id=receipt.id,
        order_id=receipt.order_id,
        object_key=receipt.object_key,
        note=receipt.note,
        amount_rub=float(receipt.amount_rub) if receipt.amount_rub is not None else None,
        uploaded_by=receipt.uploaded_by,
        created_at=receipt.created_at.isoformat(),
    )


@router.get("/orders/{order_id}/receipts", response_model=list[CrmOrderReceiptOut])
@crm_db_guard
def list_order_receipts(order_id: int, session: Session = Depends(get_session)) -> list[CrmOrderReceiptOut]:
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    receipts = list(
        session.scalars(
            select(CrmOrderReceipt).where(CrmOrderReceipt.order_id == order_id).order_by(CrmOrderReceipt.id.desc())
        )
    )
    return [
        CrmOrderReceiptOut(
            id=receipt.id,
            order_id=receipt.order_id,
            object_key=receipt.object_key,
            note=receipt.note,
            amount_rub=float(receipt.amount_rub) if receipt.amount_rub is not None else None,
            uploaded_by=receipt.uploaded_by,
            created_at=receipt.created_at.isoformat(),
        )
        for receipt in receipts
    ]


@router.get("/orders/{order_id}/procurement", response_model=CrmOrderProcurementOut)
@crm_db_guard
def order_procurement(order_id: int, session: Session = Depends(get_session)) -> CrmOrderProcurementOut:
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    overrides = list(
        session.scalars(select(CrmOrderProcurement).where(CrmOrderProcurement.order_id == order_id))
    )
    overrides_by_material = {row.material_id: row for row in overrides}
    stock = _stock_map(session)
    lines = _order_material_lines(session, order_id)
    procurement: list[CrmProcurementLine] = []
    procurement_sum = 0.0
    purchased_sum = 0.0
    for line in lines:
        required = float(line.required_qty)
        in_stock = stock.get(line.material_id, 0.0)
        _, _, to_buy_base = _procurement_lines(required, in_stock)
        override = overrides_by_material.get(line.material_id)
        to_buy = float(override.to_buy_qty) if (override and override.to_buy_qty is not None) else float(to_buy_base)
        unit_price = 0.0
        if override and override.unit_price_rub is not None:
            unit_price = float(override.unit_price_rub)
        else:
            unit_price = float(getattr(line.material, "purchase_price_rub", 0) or 0)
        purchased_qty = float(override.purchased_qty) if override else 0.0
        is_purchased = bool(override.is_purchased) if override else False
        purchased_qty_effective = max(0.0, purchased_qty)
        if is_purchased and purchased_qty_effective < to_buy:
            purchased_qty_effective = to_buy
        line_total = to_buy * unit_price
        purchased_total = purchased_qty_effective * unit_price
        overspend_qty = max(0.0, purchased_qty_effective - to_buy)
        overspend_rub = overspend_qty * unit_price
        procurement_sum += line_total
        purchased_sum += purchased_total
        procurement.append(
            CrmProcurementLine(
                material_id=line.material_id,
                material_name=line.material.name,
                unit=line.material.unit,
                required_qty=required,
                in_stock_qty=in_stock,
                to_buy_qty_base=float(to_buy_base),
                to_buy_qty=to_buy,
                unit_price_rub=unit_price,
                line_total_rub=line_total,
                purchased_qty=purchased_qty_effective,
                purchased_total_rub=purchased_total,
                overspend_qty=overspend_qty,
                overspend_rub=overspend_rub,
                is_purchased=is_purchased,
            )
        )
    progress = (purchased_sum / procurement_sum * 100.0) if procurement_sum > 0 else 0.0
    overspend_sum = sum(line.overspend_rub for line in procurement)
    return CrmOrderProcurementOut(
        order_id=order.id,
        title=order.title,
        customer=order.customer,
        status=order.status,
        lines=procurement,
        procurement_sum_rub=procurement_sum,
        purchased_sum_rub=purchased_sum,
        overspend_sum_rub=overspend_sum,
        progress_percent=progress,
    )


@router.put(
    "/orders/{order_id}/procurement",
    response_model=CrmOrderProcurementOut,
    dependencies=[Depends(ensure_catalog_writer)],
)
@crm_db_guard
def update_order_procurement(
    order_id: int,
    payload: list[CrmProcurementLineUpdateIn],
    session: Session = Depends(get_session),
) -> CrmOrderProcurementOut:
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    existing = list(
        session.scalars(select(CrmOrderProcurement).where(CrmOrderProcurement.order_id == order_id))
    )
    by_material = {row.material_id: row for row in existing}

    for line in payload:
        material = None
        if line.material_id:
            material = session.get(CrmMaterial, line.material_id)
        if not material and line.material_name:
            material = session.scalar(select(CrmMaterial).where(CrmMaterial.name == line.material_name))
        if not material:
            if not line.material_name:
                raise HTTPException(status_code=400, detail="Укажите название материала")
            material = CrmMaterial(
                name=line.material_name,
                unit=line.unit or "шт",
                purchase_price_rub=line.unit_price_rub or 0,
            )
            session.add(material)
            session.flush()
            session.add(CrmWarehouseStock(material_id=material.id, quantity=0))
        if line.material_name and line.material_name != material.name:
            clash = session.scalar(select(CrmMaterial).where(CrmMaterial.name == line.material_name))
            if clash and clash.id != material.id:
                raise HTTPException(status_code=409, detail=f"Материал «{line.material_name}» уже есть")
            material.name = line.material_name
        if line.unit:
            material.unit = line.unit
        if line.unit_price_rub is not None:
            material.purchase_price_rub = line.unit_price_rub

        order_line = session.scalar(
            select(CrmOrderMaterial).where(
                CrmOrderMaterial.order_id == order_id,
                CrmOrderMaterial.material_id == material.id,
            )
        )
        required = line.required_qty if line.required_qty is not None else (line.to_buy_qty if line.to_buy_qty is not None else 1)
        if not order_line:
            session.add(
                CrmOrderMaterial(
                    order_id=order_id,
                    material_id=material.id,
                    required_qty=required or 1,
                )
            )
        elif line.required_qty is not None:
            order_line.required_qty = line.required_qty

        row = by_material.get(material.id)
        if not row:
            row = CrmOrderProcurement(order_id=order_id, material_id=material.id)
            session.add(row)
            by_material[material.id] = row

        if line.to_buy_qty is not None:
            row.to_buy_qty = line.to_buy_qty
        if line.unit_price_rub is not None:
            row.unit_price_rub = line.unit_price_rub
        if line.purchased_qty is not None:
            row.purchased_qty = line.purchased_qty
        if line.is_purchased is not None:
            row.is_purchased = line.is_purchased

    session.commit()
    # Return the updated computed view using the same logic as GET.
    return order_procurement(order_id=order_id, session=session)


@router.get("/calendar", response_model=list[CrmOrderOut])
@crm_db_guard
def calendar_orders(session: Session = Depends(get_session)) -> list[CrmOrderOut]:
    orders = list(session.scalars(select(CrmProductionOrder).order_by(CrmProductionOrder.status_changed_at.desc())))
    return [_order_out(session, order) for order in orders]


@router.post("/seed-demo", dependencies=[Depends(ensure_can_delete)])
@crm_db_guard
def seed_crm_demo(session: Session = Depends(get_session)) -> dict[str, str]:
    del session
    raise HTTPException(
        status_code=410,
        detail="Демо-данные CRM отключены. Создайте материалы и заказы из реальных 3D-проектов.",
    )
