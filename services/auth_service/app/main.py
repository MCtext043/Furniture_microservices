from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from common.http_security import SlidingWindowLimiter
from common.jwt_auth import ALGORITHM, ensure_superadmin

from .db import get_session
from .mail import send_staff_email, smtp_configured, verification_bodies
from .models import EmailToken, RoleDefinition, User
from .schemas import (
    AdminCreate,
    AdminUpdate,
    JwtPayload,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

ACCESS_TTL_MINUTES = int(os.getenv("JWT_ACCESS_TTL_MINUTES", "60"))
STAFF_ROLES = ["admin", "catalog:write", "planner:write", "cutting:run", "assets:write"]
SUPER_ROLES = ["superadmin", *STAFF_ROLES]
LOGIN_LIMITER = SlidingWindowLimiter(max_events=8, window_seconds=60)

app = FastAPI(
    title="Furniture Auth Service",
    description="JWT issuing and RBAC-backed user directory.",
    version="0.1.0",
)


def _secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Сервер авторизации не настроен")
    return secret


def _hash_password(raw: str) -> str:
    from passlib.hash import bcrypt

    return bcrypt.hash(raw)


def _verify_password(raw: str, hashed: str) -> bool:
    from passlib.hash import bcrypt

    return bcrypt.verify(raw, hashed)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _issue_access_token(user: User) -> TokenResponse:
    expires_in = ACCESS_TTL_MINUTES * 60
    expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    payload = {"sub": str(user.id), "username": user.username, "roles": user.roles, "exp": expiry}
    token = jwt.encode(payload, _secret(), algorithm=ALGORITHM)
    return TokenResponse(access_token=token, expires_in=expires_in)


def _is_staff(user: User) -> bool:
    roles = set(user.roles or [])
    return bool(roles.intersection({"admin", "superadmin", "*"}))


def _bootstrap_username() -> str:
    return os.getenv("AUTH_BOOTSTRAP_USERNAME", "").strip()


def _public_base() -> str:
    return os.getenv("PUBLIC_APP_URL", "").rstrip("/")


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        roles=list(user.roles or []),
        email=user.email,
        email_verified=bool(user.email_verified),
    )


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
    username = _bootstrap_username()
    raw_password = os.getenv("AUTH_BOOTSTRAP_PASSWORD", "").strip()
    if not username or not raw_password:
        return
    raw_roles_csv = os.getenv(
        "AUTH_BOOTSTRAP_ROLES",
        "superadmin,admin,catalog:write,planner:write,cutting:run,assets:write",
    )
    roles_list = [r.strip() for r in raw_roles_csv.split(",") if r.strip()]
    if "superadmin" not in roles_list:
        roles_list = ["superadmin", *roles_list]
    password_hash = _hash_password(raw_password)

    existing = session.scalar(select(User).where(User.username == username))
    if existing:
        existing.password_hash = password_hash
        existing.roles = roles_list
        existing.email_verified = True
        session.commit()
        return

    session.add(
        User(
            username=username,
            password_hash=password_hash,
            roles=roles_list,
            email_verified=True,
        )
    )
    session.commit()


def bootstrap_role_catalog(session: Session) -> None:
    presets = (
        ("superadmin", "Главный администратор"),
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
        raise HTTPException(status_code=409, detail="Это имя пользователя уже занято")
    user = User(
        username=payload.username,
        password_hash=_hash_password(payload.password),
        roles=["user"],
        email_verified=False,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@app.post("/token", response_model=TokenResponse)
def login(request: Request, payload: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    if not LOGIN_LIMITER.allow(f"{client_ip}:{payload.username.lower()}"):
        raise HTTPException(status_code=429, detail="Слишком много попыток. Подождите минуту.")
    user = session.scalar(select(User).where(User.username == payload.username))
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if user.email and not user.email_verified and _is_staff(user):
        raise HTTPException(status_code=403, detail="Подтвердите почту, прежде чем войти как администратор")
    return _issue_access_token(user)


@app.get("/me", response_model=JwtPayload)
def me(authorization: str | None = Header(default=None)) -> JwtPayload:
    """Decode bearer token (debug / gateway validation pattern)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        return JwtPayload(
            sub=str(claims.get("sub", "")),
            username=str(claims.get("username", "")),
            roles=list(claims.get("roles") or []),
        )
    except jwt.DecodeError as exc:
        raise HTTPException(status_code=401, detail="Недействительный токен. Войдите снова.") from exc


@app.get("/roles")
def list_roles(session: Session = Depends(get_session)) -> list[dict[str, str | int]]:
    rows = list(session.scalars(select(RoleDefinition).order_by(RoleDefinition.code)))
    return [{"id": r.id, "code": r.code, "description": r.description} for r in rows]


def _issue_email_token(session: Session, user: User) -> str:
    raw = secrets.token_urlsafe(32)
    session.add(
        EmailToken(
            user_id=user.id,
            purpose="verify_email",
            token_hash=_hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
        )
    )
    session.flush()
    return raw


def _send_verification(session: Session, user: User) -> str:
    if not user.email:
        return "no-email"
    raw = _issue_email_token(session, user)
    base = _public_base()
    verify_url = f"{base}/auth/verify-email?token={raw}" if base else f"/auth/verify-email?token={raw}"
    text, html = verification_bodies(user.username, verify_url)
    if smtp_configured():
        send_staff_email(
            to_addr=user.email,
            subject="Петров — подтверждение почты администратора",
            text_body=text,
            html_body=html,
        )
        return "sent"
    return "queued-local"


@app.get("/admins", response_model=list[UserOut], dependencies=[Depends(ensure_superadmin)])
def list_admins(session: Session = Depends(get_session)) -> list[UserOut]:
    rows = list(session.scalars(select(User).order_by(User.id)))
    return [_user_out(user) for user in rows if _is_staff(user)]


@app.post("/admins", response_model=UserOut, status_code=201, dependencies=[Depends(ensure_superadmin)])
def create_admin(payload: AdminCreate, session: Session = Depends(get_session)) -> UserOut:
    if session.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=409, detail="Это имя пользователя уже занято")
    if payload.email:
        clash = session.scalar(select(User).where(User.email == payload.email))
        if clash:
            raise HTTPException(status_code=409, detail="Эта почта уже используется")
    send_mail = bool(payload.email) and smtp_configured()
    user = User(
        username=payload.username,
        password_hash=_hash_password(payload.password),
        roles=list(STAFF_ROLES),
        email=payload.email,
        email_verified=not send_mail,
    )
    session.add(user)
    session.flush()
    if send_mail:
        try:
            _send_verification(session, user)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Администратор создан, но письмо не отправлено. Проверьте SMTP.") from exc
    session.commit()
    session.refresh(user)
    return _user_out(user)


@app.patch("/admins/{user_id}", response_model=UserOut, dependencies=[Depends(ensure_superadmin)])
def update_admin(user_id: int, payload: AdminUpdate, session: Session = Depends(get_session)) -> UserOut:
    user = session.get(User, user_id)
    if not user or not _is_staff(user):
        raise HTTPException(status_code=404, detail="Администратор не найден")
    if payload.username and payload.username != user.username:
        if session.scalar(select(User).where(User.username == payload.username)):
            raise HTTPException(status_code=409, detail="Это имя пользователя уже занято")
        user.username = payload.username
    if payload.password:
        user.password_hash = _hash_password(payload.password)
    if payload.email is not None and payload.email != user.email:
        clash = session.scalar(select(User).where(User.email == payload.email, User.id != user.id))
        if clash:
            raise HTTPException(status_code=409, detail="Эта почта уже используется")
        user.email = payload.email
        user.email_verified = False
        try:
            _send_verification(session, user)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Почта обновлена, но письмо не отправлено.") from exc
    session.commit()
    session.refresh(user)
    return _user_out(user)


@app.delete("/admins/{user_id}", dependencies=[Depends(ensure_superadmin)])
def delete_admin(user_id: int, session: Session = Depends(get_session)) -> dict[str, str]:
    user = session.get(User, user_id)
    if not user or not _is_staff(user):
        raise HTTPException(status_code=404, detail="Администратор не найден")
    if "superadmin" in (user.roles or []) or user.username == _bootstrap_username():
        raise HTTPException(status_code=403, detail="Главного администратора удалить нельзя")
    session.delete(user)
    session.commit()
    return {"status": "deleted"}


@app.post("/admins/{user_id}/resend-verification", dependencies=[Depends(ensure_superadmin)])
def resend_verification(user_id: int, session: Session = Depends(get_session)) -> dict[str, str]:
    user = session.get(User, user_id)
    if not user or not user.email:
        raise HTTPException(status_code=404, detail="У администратора нет почты")
    try:
        status = _send_verification(session, user)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Не удалось отправить письмо") from exc
    session.commit()
    return {"status": status}


@app.get("/verify-email")
def verify_email(token: str = Query(min_length=8), session: Session = Depends(get_session)) -> HTMLResponse:
    hashed = _hash_token(token)
    row = session.scalar(select(EmailToken).where(EmailToken.token_hash == hashed, EmailToken.purpose == "verify_email"))
    if not row or row.consumed_at is not None:
        raise HTTPException(status_code=400, detail="Ссылка недействительна")
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Срок ссылки истёк")
    user = session.get(User, row.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.email_verified = True
    row.consumed_at = datetime.now(timezone.utc)
    session.commit()
    return HTMLResponse(
        "<!doctype html><html lang='ru'><body style='font-family:Arial,sans-serif;padding:2rem'>"
        "<h1>Почта подтверждена</h1><p>Можно войти в панель администратора.</p></body></html>"
    )
