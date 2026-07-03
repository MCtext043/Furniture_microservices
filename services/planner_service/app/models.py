from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

PRODUCTION_STATUSES = ("конструктор", "закупка", "сборка")


class RoomProject(Base):
    __tablename__ = "planner_projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    location: Mapped[str] = mapped_column(String(180), default="")
    user_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    room_width: Mapped[float] = mapped_column(Float, default=6000)
    room_length: Mapped[float] = mapped_column(Float, default=5000)
    room_height: Mapped[float] = mapped_column(Float, default=2800)
    price_standard: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    price_comfort: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    price_premium: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    bom_json: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FurniturePlacement(Base):
    __tablename__ = "planner_furniture"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("planner_projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    width: Mapped[float] = mapped_column(Float)
    depth: Mapped[float] = mapped_column(Float)
    height: Mapped[float] = mapped_column(Float)
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    z: Mapped[float] = mapped_column(Float, default=0.0)
    rotation_y: Mapped[float] = mapped_column(Float, default=0.0)
    furniture_type: Mapped[str] = mapped_column(String(32), default="cabinet")
    texture: Mapped[str] = mapped_column(String(64), default="wood_oak")
    custom_color: Mapped[str] = mapped_column(String(16), default="")
    drawers: Mapped[int] = mapped_column(Integer, default=0)
    handles: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[RoomProject] = relationship()
