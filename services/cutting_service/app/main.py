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
    placements, unplaced_parts, total_sheets = optimize_sheet(payload.sheet_width, payload.sheet_height, payload.parts)
    requested_count = sum(part.quantity for part in payload.parts)
    used_area = sum(item.width * item.height for item in placements)
    sheet_area = payload.sheet_width * payload.sheet_height
    all_sheets_area = sheet_area * total_sheets
    total_unused_area = max(all_sheets_area - used_area, 0)
    utilization = round((used_area / all_sheets_area) * 100, 2) if all_sheets_area else 0

    sheet_rows = []
    for idx in range(total_sheets):
        per_sheet = [p for p in placements if p.sheet_index == idx]
        per_sheet_area = sum(item.width * item.height for item in per_sheet)
        per_sheet_unused = max(sheet_area - per_sheet_area, 0)
        per_sheet_util = round((per_sheet_area / sheet_area) * 100, 2) if sheet_area else 0
        sheet_rows.append(
            {
                "sheet_index": idx,
                "placements": per_sheet,
                "utilized_area": per_sheet_area,
                "unused_area": per_sheet_unused,
                "utilization_percent": per_sheet_util,
            }
        )

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
        total_used_area=used_area,
        total_unused_area=total_unused_area,
        total_sheets=total_sheets,
        sheets=sheet_rows,
        unplaced_parts=unplaced_parts,
        placements=placements,
    )


@app.get("/jobs", response_model=list[CuttingJobOut])
def list_jobs(session: Session = Depends(get_session)) -> list[CuttingJob]:
    return list(session.scalars(select(CuttingJob).order_by(CuttingJob.id.desc()).limit(100)))
