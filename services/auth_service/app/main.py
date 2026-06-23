from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from common.jwt_auth import ALGORITHM

from .db import get_session
from .models import RoleDefinition, User
from .schemas import JwtPayload, LoginRequest, RegisterRequest, TokenResponse, UserOut

ACCESS_TTL_MINUTES = int(os.getenv("JWT_ACCESS_TTL_MINUTES", "60"))

app = FastAPI(
    title="Furniture Auth Service",
    description="JWT issuing and RBAC-backed user directory.",
    version="0.1.0",
)


def _secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="JWT_SECRET_KEY is not configured")
    return secret


def _hash_password(raw: str) -> str:
    from passlib.hash import bcrypt

    return bcrypt.hash(raw)


def _verify_password(raw: str, hashed: str) -> bool:
    from passlib.hash import bcrypt

    return bcrypt.verify(raw, hashed)


def _issue_access_token(user: User) -> TokenResponse:
    expires_in = ACCESS_TTL_MINUTES * 60
    expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    payload = {"sub": str(user.id), "username": user.username, "roles": user.roles, "exp": expiry}
    token = jwt.encode(payload, _secret(), algorithm=ALGORITHM)
    return TokenResponse(access_token=token, expires_in=expires_in)


@app.on_event("startup")
def on_startup() -> None:
    from .db import SessionLocal

    session = SessionLocal()
    try:
        bootstrap_role_catalog(session)
        bootstrap_admin(session)
    finally:
        session.close()


def bootstrap_admin(session: Session) -> None:
    username = os.getenv("AUTH_BOOTSTRAP_USERNAME", "").strip()
    raw_password = os.getenv("AUTH_BOOTSTRAP_PASSWORD", "").strip()
    if not username or not raw_password:
        return
    raw_roles_csv = os.getenv(
        "AUTH_BOOTSTRAP_ROLES",
        "admin,catalog:write,planner:write,cutting:run,assets:write",
    )
    roles_list = [r.strip() for r in raw_roles_csv.split(",") if r.strip()]
    password_hash = _hash_password(raw_password)

    existing = session.scalar(select(User).where(User.username == username))
    if existing:
        existing.password_hash = password_hash
        existing.roles = roles_list
        session.commit()
        return

    session.add(User(username=username, password_hash=password_hash, roles=roles_list))
    session.commit()


def bootstrap_role_catalog(session: Session) -> None:
    presets = (
        ("admin", "Administrator"),
        ("user", "Default user"),
        ("catalog:write", "Create/update catalog products"),
        ("planner:write", "Manage room projects"),
        ("cutting:run", "Run cutting optimization"),
        ("assets:write", "Upload 3D models and images"),
    )
    for code, desc in presets:
        row = session.scalar(select(RoleDefinition).where(RoleDefinition.code == code))
        if row is None:
            session.add(RoleDefinition(code=code, description=desc))
    session.commit()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/register", response_model=UserOut, status_code=201)
def register_user(payload: RegisterRequest, session: Session = Depends(get_session)) -> User:
    if session.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=409, detail="Username already taken")
    user = User(username=payload.username, password_hash=_hash_password(payload.password), roles=["user"])
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.post("/token", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    user = session.scalar(select(User).where(User.username == payload.username))
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return _issue_access_token(user)


@app.get("/me", response_model=JwtPayload)
def me(authorization: str | None = Header(default=None)) -> JwtPayload:
    """Decode bearer token (debug / gateway validation pattern)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        return JwtPayload(
            sub=str(claims.get("sub", "")),
            username=str(claims.get("username", "")),
            roles=list(claims.get("roles") or []),
        )
    except jwt.DecodeError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


@app.get("/roles")
def list_roles(session: Session = Depends(get_session)) -> list[dict[str, str | int]]:
    rows = list(session.scalars(select(RoleDefinition).order_by(RoleDefinition.code)))
    return [{"id": r.id, "code": r.code, "description": r.description} for r in rows]
