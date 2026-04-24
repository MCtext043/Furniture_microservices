from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Base, engine, get_session
from .models import FurniturePlacement, RoomProject
from .schemas import FurnitureCreate, FurnitureOut, ProjectCreate, ProjectOut


app = FastAPI(
    title="Furniture Planner Service",
    description="Управление проектами помещений и размещением 3D-мебели.",
    version="0.1.0",
)

Base.metadata.create_all(bind=engine)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)) -> RoomProject:
    project = RoomProject(**payload.model_dump())
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@app.get("/projects", response_model=list[ProjectOut])
def list_projects(session: Session = Depends(get_session)) -> list[RoomProject]:
    return list(session.scalars(select(RoomProject).order_by(RoomProject.id.desc())))


@app.post("/projects/{project_id}/furniture", response_model=FurnitureOut, status_code=201)
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
    return furniture


@app.get("/projects/{project_id}/furniture", response_model=list[FurnitureOut])
def list_furniture(project_id: int, session: Session = Depends(get_session)) -> list[FurniturePlacement]:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    stmt = select(FurniturePlacement).where(FurniturePlacement.project_id == project_id)
    return list(session.scalars(stmt))
