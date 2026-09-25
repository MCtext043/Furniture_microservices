from __future__ import annotations

import os
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import ExpiredSignatureError, PyJWTError

ALGORITHM = "HS256"


@dataclass
class TokenClaims:
    sub: str
    username: str
    roles: list[str]


@dataclass
class AuthContext:
    """JWT enforcement defaults to OFF when JWT_SECRET_KEY is unset (local tests / relaxed dev)."""

    enforced: bool
    claims: TokenClaims | None


def _decode_optional(authorization: str | None) -> TokenClaims | None:
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if not secret or not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        sub = str(payload.get("sub", ""))
        username = str(payload.get("username", ""))
        raw_roles = payload.get("roles", [])
        if isinstance(raw_roles, str):
            roles = [raw_roles]
        elif isinstance(raw_roles, list):
            roles = [str(r) for r in raw_roles]
        else:
            roles = []
        return TokenClaims(sub=sub, username=username, roles=roles)
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Сессия истекла. Войдите снова.") from exc
    except PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Недействительный токен. Войдите снова.") from exc


def get_auth_context(authorization: str | None = Header(default=None)) -> AuthContext:
    secret_present = bool(os.getenv("JWT_SECRET_KEY", "").strip())
    claims = _decode_optional(authorization)
    return AuthContext(enforced=secret_present, claims=claims)


def ensure_authenticated_when_enforced(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if not auth.enforced:
        return auth
    if auth.claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    return auth


def _role_set(claims: TokenClaims) -> set[str]:
    return set(claims.roles)


def is_superadmin(claims: TokenClaims) -> bool:
    roles = _role_set(claims)
    return "*" in roles or "superadmin" in roles


def _has_privileged_role(claims: TokenClaims, required: tuple[str, ...]) -> bool:
    roles = _role_set(claims)
    if "*" in roles or "superadmin" in roles or "admin" in roles:
        return True
    return bool(roles.intersection(set(required)))


def ensure_superadmin(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if not auth.enforced:
        return auth
    if auth.claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    if not is_superadmin(auth.claims):
        raise HTTPException(status_code=403, detail="Действие доступно только главному администратору")
    return auth


def ensure_can_delete(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
    """Hard delete of records is reserved for the bootstrap superadmin."""
    return ensure_superadmin(auth)


def ensure_catalog_writer(auth: AuthContext = Depends(get_auth_context)) -> None:
    if not auth.enforced:
        return
    claims = auth.claims
    if claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    if not _has_privileged_role(claims, ("catalog:write",)):
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения каталога")


def ensure_shop_user(auth: AuthContext = Depends(get_auth_context)) -> None:
    """Cart and wishlist for any signed-in customer."""
    if not auth.enforced:
        return
    claims = auth.claims
    if claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    if not _has_privileged_role(claims, ("user", "catalog:write")):
        raise HTTPException(status_code=403, detail="Недостаточно прав для корзины и избранного")


def ensure_planner_user(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
    """Room projects for customers and production staff."""
    if not auth.enforced:
        return auth
    claims = auth.claims
    if claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    if not _has_privileged_role(claims, ("user", "planner:write")):
        raise HTTPException(status_code=403, detail="Недостаточно прав для планировщика")
    return auth


def ensure_planner_writer(auth: AuthContext = Depends(get_auth_context)) -> None:
    if not auth.enforced:
        return
    claims = auth.claims
    if claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    if not _has_privileged_role(claims, ("planner:write",)):
        raise HTTPException(status_code=403, detail="Недостаточно прав для сохранения проекта")


def ensure_cutting_runner(auth: AuthContext = Depends(get_auth_context)) -> None:
    if not auth.enforced:
        return
    claims = auth.claims
    if claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    if not _has_privileged_role(claims, ("cutting:run",)):
        raise HTTPException(status_code=403, detail="Недостаточно прав для расчёта раскроя")


def ensure_assets_writer(auth: AuthContext = Depends(get_auth_context)) -> None:
    if not auth.enforced:
        return
    claims = auth.claims
    if claims is None:
        raise HTTPException(status_code=401, detail="Войдите в аккаунт")
    if not _has_privileged_role(claims, ("assets:write",)):
        raise HTTPException(status_code=403, detail="Недостаточно прав для загрузки файлов")
