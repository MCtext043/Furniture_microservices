from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class CuttingJob(Base):
    __tablename__ = "cutting_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    sheet_width: Mapped[int] = mapped_column(Integer)
    sheet_height: Mapped[int] = mapped_column(Integer)
    parts_count: Mapped[int] = mapped_column(Integer)
    placed_count: Mapped[int] = mapped_column(Integer)
    utilization_percent: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
