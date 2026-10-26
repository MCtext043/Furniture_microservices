"""Assignable staff permissions for flexible RBAC (superadmin configures per admin)."""

from __future__ import annotations

ASSIGNABLE_PERMISSIONS: tuple[dict[str, str], ...] = (
    {
        "code": "calendar:read",
        "label": "Календарь монтажей: просмотр",
        "group": "Производство",
    },
    {
        "code": "crm:assembler_price:read",
        "label": "CRM: просмотр цены для сборщика",
        "group": "Производство",
    },
    {
        "code": "catalog:write",
        "label": "Каталог: создание и редактирование товаров",
        "group": "Каталог",
    },
    {
        "code": "planner:write",
        "label": "3D-планировщик: проекты и сохранение",
        "group": "Планировщик",
    },
    {
        "code": "cutting:run",
        "label": "Раскрой: расчёт и задания",
        "group": "Раскрой",
    },
    {
        "code": "assets:write",
        "label": "Загрузка файлов, фото и 3D-моделей",
        "group": "Файлы",
    },
    {
        "code": "crm:orders:write",
        "label": "CRM: создание и редактирование заказов, закупки, фото, чеки",
        "group": "CRM",
    },
    {
        "code": "crm:orders:status",
        "label": "CRM: смена статусов заказов",
        "group": "CRM",
    },
    {
        "code": "crm:orders:delete",
        "label": "CRM: удаление заказов",
        "group": "CRM",
    },
    {
        "code": "crm:dicts:write",
        "label": "CRM: справочники полей заказов",
        "group": "CRM",
    },
    {
        "code": "records:delete",
        "label": "Удаление записей (товары, категории, раскрои, справочники)",
        "group": "Удаление",
    },
)

ASSIGNABLE_CODES: frozenset[str] = frozenset(p["code"] for p in ASSIGNABLE_PERMISSIONS)

# Default for new staff when roles omitted: full ops except hard deletes.
DEFAULT_STAFF_PERMISSION_CODES: tuple[str, ...] = (
    "catalog:write",
    "planner:write",
    "cutting:run",
    "assets:write",
    "crm:orders:write",
    "crm:orders:status",
    "crm:dicts:write",
)

ASSEMBLER_ROLE = "assembler"
ROLE_PRESETS: dict[str, tuple[str, ...]] = {
    ASSEMBLER_ROLE: ("calendar:read", "crm:assembler_price:read", "assets:write"),
}

# Base staff identity — always present; does not grant write/delete by itself.
STAFF_BASE_ROLE = "admin"

FORBIDDEN_STAFF_ROLES: frozenset[str] = frozenset({"superadmin", "*", "user"})


def normalize_staff_roles(requested: list[str] | None) -> list[str]:
    """Build staff role list: always include admin, filter to assignable codes only."""
    if requested is None:
        codes = list(DEFAULT_STAFF_PERMISSION_CODES)
    else:
        requested_set = set(requested)
        preset_codes = []
        for preset, preset_roles in ROLE_PRESETS.items():
            if preset in requested_set:
                preset_codes.extend(preset_roles)
        codes = [
            c for c in [*preset_codes, *requested]
            if c in ASSIGNABLE_CODES and c not in FORBIDDEN_STAFF_ROLES
        ]
    ordered = [STAFF_BASE_ROLE, *codes]
    seen: set[str] = set()
    out: list[str] = []
    for role in ordered:
        if role not in seen:
            seen.add(role)
            out.append(role)
    return out


def permission_catalog() -> list[dict[str, str]]:
    return [dict(item) for item in ASSIGNABLE_PERMISSIONS]
