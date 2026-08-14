from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from common.jwt_auth import AuthContext, ensure_planner_user, get_auth_context
from common.messaging import publish_event

from .db import get_session
from .models import FurniturePlacement, RoomProject
from .schemas import FurnitureCreate, FurnitureOut, ProjectCreate, ProjectOut, ProjectSubmitIn, ProjectUpdate, RoomState, SceneOut, SceneSaveIn


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
        schema_version=project.schema_version or 1,
        scene_revision=project.scene_revision or 0,
        room_finish_json=project.room_finish_json or {},
    )


def _identity(auth: AuthContext) -> str | None:
    return auth.claims.sub if auth.claims and auth.claims.sub else None


def _assert_owner(project: RoomProject, auth: AuthContext) -> None:
    identity = _identity(auth)
    if auth.enforced and (not identity or project.user_id != identity):
        raise HTTPException(status_code=403, detail="Project belongs to another user")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/projects", response_model=ProjectOut, status_code=201, dependencies=[Depends(ensure_planner_user)])
def create_project(payload: ProjectCreate, session: Session = Depends(get_session), auth: AuthContext = Depends(ensure_planner_user)) -> ProjectOut:
    values = payload.model_dump()
    if _identity(auth):
        values["user_id"] = _identity(auth)
    project = RoomProject(**values, updated_at=datetime.now(timezone.utc))
    session.add(project)
    session.commit()
    session.refresh(project)
    publish_event("planner.project.created", {"id": project.id, "name": project.name})
    return _project_out(project)


@app.get("/projects", response_model=list[ProjectOut])
def list_projects(session: Session = Depends(get_session), auth: AuthContext = Depends(get_auth_context)) -> list[ProjectOut]:
    stmt = select(RoomProject)
    if auth.enforced:
        if not _identity(auth):
            raise HTTPException(status_code=401, detail="Unauthorized")
        stmt = stmt.where(RoomProject.user_id == _identity(auth))
    rows = list(session.scalars(stmt.order_by(RoomProject.id.desc())))
    return [_project_out(row) for row in rows]


@app.get("/projects/user/{user_id}", response_model=list[ProjectOut])
def list_user_projects(user_id: str, session: Session = Depends(get_session), auth: AuthContext = Depends(get_auth_context)) -> list[ProjectOut]:
    if auth.enforced and _identity(auth) != user_id:
        raise HTTPException(status_code=403, detail="Cannot list another user's projects")
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
    auth: AuthContext = Depends(ensure_planner_user),
) -> FurniturePlacement:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, auth)
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
def list_furniture(project_id: int, session: Session = Depends(get_session), auth: AuthContext = Depends(get_auth_context)) -> list[FurniturePlacement]:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, auth)
    stmt = select(FurniturePlacement).where(FurniturePlacement.project_id == project_id)
    return list(session.scalars(stmt))


@app.patch("/projects/{project_id}", response_model=ProjectOut, dependencies=[Depends(ensure_planner_user)])
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(ensure_planner_user),
) -> ProjectOut:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, auth)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "user_id" and _identity(auth):
            continue
        setattr(project, field, value)
    project.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(project)
    return _project_out(project)


@app.post("/projects/{project_id}/submit", response_model=ProjectOut, dependencies=[Depends(ensure_planner_user)])
def submit_project(
    project_id: int,
    payload: ProjectSubmitIn | None = None,
    session: Session = Depends(get_session),
    auth: AuthContext = Depends(ensure_planner_user),
) -> ProjectOut:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, auth)
    if payload and payload.selected_tier:
        project.selected_tier = payload.selected_tier
    project.status = "submitted"
    project.submitted_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(project)
    publish_event("planner.project.submitted", {"id": project.id, "user_id": project.user_id})
    return _project_out(project)


def _placement_values(payload) -> dict:
    values = payload.model_dump()
    config = values.get("configuration_json") or {}
    appearance = values.get("appearance_json") or {}
    config.update({"width": values["width"], "depth": values["depth"], "height": values["height"], "drawers": values["drawers"], "handles": values["handles"]})
    appearance.update({"texture": values["texture"], "customColor": values["custom_color"]})
    values["configuration_json"] = config
    values["appearance_json"] = appearance
    values["updated_at"] = datetime.now(timezone.utc)
    return values


@app.put("/projects/{project_id}/scene", response_model=SceneOut, dependencies=[Depends(ensure_planner_user)])
def save_scene(project_id: int, payload: SceneSaveIn, session: Session = Depends(get_session), auth: AuthContext = Depends(ensure_planner_user)) -> SceneOut:
    """Atomically replace a scene using stable client ids and optimistic revision checking."""
    project = session.get(RoomProject, project_id, with_for_update=True)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, auth)
    if project.scene_revision != payload.expected_revision:
        raise HTTPException(status_code=409, detail={"message": "Scene revision conflict", "current_revision": project.scene_revision})
    client_ids = [item.client_id for item in payload.placements]
    if len(client_ids) != len(set(client_ids)):
        raise HTTPException(status_code=422, detail="Duplicate client_id in scene")

    existing = {row.client_id: row for row in session.scalars(select(FurniturePlacement).where(FurniturePlacement.project_id == project_id)) if row.client_id}
    incoming = set(client_ids)
    for client_id, row in existing.items():
        if client_id not in incoming:
            session.delete(row)
    saved = []
    for placement in payload.placements:
        row = existing.get(placement.client_id)
        values = _placement_values(placement)
        if row is None:
            row = FurniturePlacement(project_id=project_id, **values)
            session.add(row)
        else:
            for field, value in values.items():
                setattr(row, field, value)
        saved.append(row)

    project.schema_version = payload.schema_version
    project.scene_revision += 1
    project.room_width = payload.room.width
    project.room_length = payload.room.length
    project.room_height = payload.room.height
    project.room_finish_json = payload.room.finish
    project.updated_at = datetime.now(timezone.utc)
    if payload.bom_json is not None:
        project.bom_json = payload.bom_json
    session.commit()
    for row in saved:
        session.refresh(row)
    return SceneOut(schema_version=project.schema_version, revision=project.scene_revision, room=payload.room, placements=saved)


@app.get("/projects/{project_id}/scene", response_model=SceneOut)
def get_scene(project_id: int, session: Session = Depends(get_session), auth: AuthContext = Depends(get_auth_context)) -> SceneOut:
    project = session.get(RoomProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_owner(project, auth)
    rows = list(session.scalars(select(FurniturePlacement).where(FurniturePlacement.project_id == project_id).order_by(FurniturePlacement.id)))
    return SceneOut(
        schema_version=project.schema_version or 1,
        revision=project.scene_revision or 0,
        room=RoomState(width=project.room_width, length=project.room_length, height=project.room_height, finish=project.room_finish_json or {}),
        placements=rows,
    )
