"""Production CRM: orders, warehouse stock, procurement shortages."""

from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from common.jwt_auth import ensure_catalog_writer

from .db import get_session
from .models import CrmMaterial, CrmOrderMaterial, CrmOrderPhoto, CrmProductionOrder, CrmWarehouseStock
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
    CrmOrderStatusUpdate,
    CrmProcurementLine,
    CrmSubmitProjectIn,
    CrmWarehouseStockOut,
    CrmWarehouseStockUpdate,
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
    )


def _add_order_lines(session: Session, order_id: int, materials: list) -> None:
    for line in materials:
        material = session.get(CrmMaterial, line.material_id)
        if not material:
            raise HTTPException(status_code=404, detail=f"Material {line.material_id} not found")
        session.add(
            CrmOrderMaterial(
                order_id=order_id,
                material_id=line.material_id,
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
        raise HTTPException(status_code=409, detail="Material already exists")
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
        raise HTTPException(status_code=404, detail="Material not found")
    if payload.name is not None:
        material.name = payload.name
    if payload.unit is not None:
        material.unit = payload.unit
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
        raise HTTPException(status_code=404, detail="Material not found")
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


@router.delete("/orders", dependencies=[Depends(ensure_catalog_writer)])
@crm_db_guard
def clear_orders(session: Session = Depends(get_session)) -> dict[str, str]:
    session.execute(delete(CrmOrderPhoto))
    session.execute(delete(CrmOrderMaterial))
    session.execute(delete(CrmProductionOrder))
    session.commit()
    return {"status": "cleared"}


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
    session.commit()
    session.refresh(order)
    return _order_out(session, order)


@router.post("/orders/submit-project", response_model=CrmOrderOut, status_code=201)
@crm_db_guard
def submit_project_order(payload: CrmSubmitProjectIn, session: Session = Depends(get_session)) -> CrmOrderOut:
    order = CrmProductionOrder(
        title=payload.title,
        customer=payload.customer,
        status="конструктор",
        notes=payload.notes,
        planner_project_id=payload.planner_project_id,
        user_id=payload.user_id,
        price_standard=payload.pricing.standard,
        price_comfort=payload.pricing.comfort,
        price_premium=payload.pricing.premium,
        selected_tier=payload.selected_tier,
    )
    session.add(order)
    session.flush()
    _add_order_lines(session, order.id, payload.materials)
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
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = payload.status
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
        raise HTTPException(status_code=404, detail="Order not found")
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
        raise HTTPException(status_code=404, detail="Order not found")
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


@router.get("/orders/{order_id}/procurement", response_model=CrmOrderProcurementOut)
@crm_db_guard
def order_procurement(order_id: int, session: Session = Depends(get_session)) -> CrmOrderProcurementOut:
    order = session.get(CrmProductionOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    stock = _stock_map(session)
    lines = _order_material_lines(session, order_id)
    procurement: list[CrmProcurementLine] = []
    for line in lines:
        required = float(line.required_qty)
        in_stock = stock.get(line.material_id, 0.0)
        _, _, to_buy = _procurement_lines(required, in_stock)
        procurement.append(
            CrmProcurementLine(
                material_id=line.material_id,
                material_name=line.material.name,
                unit=line.material.unit,
                required_qty=required,
                in_stock_qty=in_stock,
                to_buy_qty=to_buy,
            )
        )
    return CrmOrderProcurementOut(
        order_id=order.id,
        title=order.title,
        customer=order.customer,
        status=order.status,
        lines=procurement,
    )


@router.post("/seed-demo", dependencies=[Depends(ensure_catalog_writer)])
@crm_db_guard
def seed_crm_demo(session: Session = Depends(get_session)) -> dict[str, int]:
    """Demo materials, warehouse stock and a kitchen production order."""
    demo_materials = [
        ("Лист ДСП 16мм", "лист"),
        ("Саморез 4×16", "шт"),
        ("Петля Blum 110°", "шт"),
        ("Кромка ПВХ 2мм", "м"),
        ("Направляющая ящика 450", "шт"),
    ]
    by_name: dict[str, CrmMaterial] = {}
    for name, unit in demo_materials:
        row = session.scalar(select(CrmMaterial).where(CrmMaterial.name == name))
        if not row:
            row = CrmMaterial(name=name, unit=unit)
            session.add(row)
            session.flush()
        by_name[name] = row

    warehouse_seed = {
        "Лист ДСП 16мм": 60,
        "Саморез 4×16": 1350,
        "Петля Blum 110°": 30,
        "Кромка ПВХ 2мм": 120,
        "Направляющая ящика 450": 8,
    }
    for name, qty in warehouse_seed.items():
        mat = by_name[name]
        stock = session.get(CrmWarehouseStock, mat.id)
        if not stock:
            stock = CrmWarehouseStock(material_id=mat.id, quantity=qty)
            session.add(stock)
        else:
            stock.quantity = qty

    existing = session.scalar(
        select(CrmProductionOrder).where(CrmProductionOrder.title == "Кухня Nord — заказ #1042")
    )
    if not existing:
        order = CrmProductionOrder(
            title="Кухня Nord — заказ #1042",
            customer="Иванова М.",
            status="конструктор",
            notes="Гарнитур 3.2м, фасады матовые",
            price_standard=184900,
            price_comfort=218000,
            price_premium=265000,
        )
        session.add(order)
        session.flush()
        order_lines = [
            ("Лист ДСП 16мм", 98),
            ("Саморез 4×16", 3000),
            ("Петля Blum 110°", 30),
            ("Кромка ПВХ 2мм", 86),
            ("Направляющая ящика 450", 12),
        ]
        for name, qty in order_lines:
            session.add(
                CrmOrderMaterial(
                    order_id=order.id,
                    material_id=by_name[name].id,
                    required_qty=qty,
                )
            )

    session.commit()
    return {
        "materials": len(list(session.scalars(select(CrmMaterial)))),
        "orders": len(list(session.scalars(select(CrmProductionOrder)))),
    }
