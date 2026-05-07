from fastapi import Depends, FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from common.jwt_auth import ensure_cutting_runner
from common.messaging import publish_event

from .db import get_session
from .models import CuttingJob
from .optimizer import optimize_sheet
from .schemas import CuttingJobOut, CuttingRequest, CuttingResponse


app = FastAPI(
    title="Furniture Cutting Service",
    description="Оптимизация раскроя деталей на листах ДСП.",
    version="0.1.0",
)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/optimize", response_model=CuttingResponse, dependencies=[Depends(ensure_cutting_runner)])
def optimize(payload: CuttingRequest, session: Session = Depends(get_session)) -> CuttingResponse:
    placements = optimize_sheet(payload.sheet_width, payload.sheet_height, payload.parts)
    requested_count = sum(part.quantity for part in payload.parts)
    used_area = sum(item.width * item.height for item in placements)
    sheet_area = payload.sheet_width * payload.sheet_height
    utilization = round((used_area / sheet_area) * 100, 2) if sheet_area else 0

    job = CuttingJob(
        sheet_width=payload.sheet_width,
        sheet_height=payload.sheet_height,
        parts_count=requested_count,
        placed_count=len(placements),
        utilization_percent=int(utilization),
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    publish_event(
        "cutting.job.completed",
        {
            "job_id": job.id,
            "placed_count": job.placed_count,
            "utilization_percent": job.utilization_percent,
        },
    )

    return CuttingResponse(
        placed_count=len(placements),
        requested_count=requested_count,
        utilization_percent=utilization,
        placements=placements,
    )


@app.get("/jobs", response_model=list[CuttingJobOut])
def list_jobs(session: Session = Depends(get_session)) -> list[CuttingJob]:
    return list(session.scalars(select(CuttingJob).order_by(CuttingJob.id.desc()).limit(100)))
