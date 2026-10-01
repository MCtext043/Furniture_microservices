"""JWT RBAC helpers for granular staff permissions."""

from common.jwt_auth import (
    TokenClaims,
    _has_privileged_role,
    ensure_can_delete,
    ensure_catalog_writer,
    ensure_crm_order_delete,
    ensure_crm_order_writer,
    ensure_crm_status,
    AuthContext,
)
from fastapi import HTTPException
import pytest


def _claims(*roles: str) -> TokenClaims:
    return TokenClaims(sub="1", username="u", roles=list(roles))


def test_bare_admin_does_not_grant_catalog_write():
    assert not _has_privileged_role(_claims("admin"), ("catalog:write",))


def test_superadmin_bypasses_required_roles():
    assert _has_privileged_role(_claims("superadmin"), ("catalog:write",))
    assert _has_privileged_role(_claims("*"), ("records:delete",))


def test_explicit_role_grants_access():
    assert _has_privileged_role(_claims("admin", "catalog:write"), ("catalog:write",))
    assert _has_privileged_role(
        _claims("admin", "crm:orders:write"),
        ("crm:orders:write", "catalog:write"),
    )


def test_ensure_helpers_when_enforced():
    denied = AuthContext(enforced=True, claims=_claims("admin"))
    with pytest.raises(HTTPException) as exc:
        ensure_catalog_writer(denied)
    assert exc.value.status_code == 403

    writer = AuthContext(enforced=True, claims=_claims("admin", "crm:orders:write"))
    ensure_crm_order_writer(writer)

    status_only = AuthContext(enforced=True, claims=_claims("admin", "crm:orders:status"))
    ensure_crm_status(status_only)
    with pytest.raises(HTTPException):
        ensure_crm_order_writer(status_only)

    deleter = AuthContext(enforced=True, claims=_claims("admin", "crm:orders:delete"))
    ensure_crm_order_delete(deleter)
    with pytest.raises(HTTPException):
        ensure_can_delete(deleter)

    records = AuthContext(enforced=True, claims=_claims("admin", "records:delete"))
    ensure_can_delete(records)
    ensure_crm_order_delete(records)
