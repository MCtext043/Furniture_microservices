from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from common.jwt_auth import ensure_planner_user
from common.messaging import publish_event

from .db import get_session
from .models import FurniturePlacement, RoomProject
from .schemas import FurnitureCreate, FurnitureOut, ProjectCreate, ProjectOut, ProjectSubmitIn, ProjectUpdate


app = FastAPI(
    title="Furniture Planner Service",
    description="Управление проектами помещений и размещением 3D-мебели.",
    version="0.2.0",
)


def _project_out(project: RoomProject) -> ProjectOut:
    submitted = project.submitted_at.isoformat() if project.submitted_at else None
    return ProjectOut(
        id=project.id,
        name=project.name,
        location=project.location,
        user_id=project.user_id,
        room_width=float(project.room_width),
        room_length=float(project.room_length),
        room_height=float(project.room_height),
        price_standard=float(project.price_standard) if project.price_standard is not None else None,
        price_comfort=float(project.price_comfort) if project.price_comfort is not None else None,
        price_premium=float(project.price_premium) if project.price_premium is not None else None,
        bom_json=project.bom_json or "",
        selected_tier=project.selected_tier or "standard",
        status=project.status,
        submitted_at=submitted,
    )


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/projects", response_model=ProjectOut, status_code=201, dependencies=[Depends(ensure_planner_user)])
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)) -> ProjectOut:
    project = RoomProject(**payload.model_dump())
    session.add(project)
    session.commit()
    session.refresh(project)
    publish_event("planner.project.created", {"id": project.id, "name": project.name})
    return _project_out(project)


@app.get("/projects", response_model=list[ProjectOut])
def list_projects(session: Session = Depends(get_session)) -> list[ProjectOut]:
    rows = list(session.scalars(select(RoomProject).order_by(RoomProject.id.desc())))
    return [_project_out(row) for row in rows]


@app.get("/projects/user/{user_id}", response_model=list[ProjectOut])
def list_user_projects(user_id: str, session: Session = Depends(get_session)) -> list[ProjectOut]:
    rows = list(
        session.scalars(
            select(RoomProject).where(RoomProject.user_id == user_id).order_by(RoomProject.id.desc())
        )
    )
    return [_project_out(row) for row in rows]


@app.post(
    "/projects/{project_id}/furniture",
    response_model=FurnitureOut,
    status_code=201,
    dependencies=[Depends(ensure_planner_user)],
)
def add_furniture(
    project_id: int,
    payload: FurnitureCreate,
    session: Session = Depends(get_session),
) -> FurniturePlacement:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    furniture = FurniturePlacement(project_id=project_id, **payload.model_dump())
    session.add(furniture)
    session.commit()
    session.refresh(furniture)
    publish_event(
        "planner.furniture.placed",
        {"project_id": project_id, "furniture_id": furniture.id, "name": furniture.name},
    )
    return furniture


@app.get("/projects/{project_id}/furniture", response_model=list[FurnitureOut])
def list_furniture(project_id: int, session: Session = Depends(get_session)) -> list[FurniturePlacement]:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    stmt = select(FurniturePlacement).where(FurniturePlacement.project_id == project_id)
    return list(session.scalars(stmt))


@app.patch("/projects/{project_id}", response_model=ProjectOut, dependencies=[Depends(ensure_planner_user)])
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    session: Session = Depends(get_session),
) -> ProjectOut:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    session.commit()
    session.refresh(project)
    return _project_out(project)


@app.post("/projects/{project_id}/submit", response_model=ProjectOut, dependencies=[Depends(ensure_planner_user)])
def submit_project(
    project_id: int,
    payload: ProjectSubmitIn | None = None,
    session: Session = Depends(get_session),
) -> ProjectOut:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload and payload.selected_tier:
        project.selected_tier = payload.selected_tier
    project.status = "submitted"
    project.submitted_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(project)
    publish_event("planner.project.submitted", {"id": project.id, "user_id": project.user_id})
    return _project_out(project)
