"""Shared CRM admin field keys, labels and default dictionary values."""

from __future__ import annotations

import re

# Fields that use editable option dictionaries in admin UI
CRM_DICT_FIELDS: dict[str, str] = {
    "color_corpus": "Цвет корпуса",
    "color_facade_1": "Цвет фасадов 1 ярус",
    "color_facade_2": "Цвет фасадов 2 ярус",
    "color_facade_3": "Цвет фасадов 3 ярус",
    "visible_parts": "Видимые части",
    "guides": "Направляющие",
    "hinges": "Петли",
    "mirror": "Зеркало",
    "countertop": "Столешница",
    "apron": "Фартук",
    "gola_profile": "Профиль гола",
    "plinth": "Цоколь",
    "false_panel": "Фальш панель",
    "light_inset": "Подсветка врезная",
    "light_overlay": "Подсветка накладная",
    "euro_cut": "Евро запил",
    "cutlery_tray": "Лоток для приборов",
    "vent_grille": "Решетка для вентиляции",
    "handles": "Ручки",
}

# Free-text / date / money fields (no dictionary)
CRM_ADMIN_SCALAR_FIELDS: dict[str, str] = {
    "customer_full_name": "ФИО",
    "signature_date": "Дата подписи",
    "delivery_date": "Дата сдачи",
    "price_admin": "Цена",
    "advance_paid": "Аванс внесенный",
    "balance_due": "Остаток",
    "email": "Почта",
    "phone": "Телефон",
    "install_address": "Адрес монтажа",
}

CRM_ADMIN_FIELD_KEYS = tuple(CRM_ADMIN_SCALAR_FIELDS) + tuple(CRM_DICT_FIELDS)

DEFAULT_FIELD_OPTIONS: dict[str, list[str]] = {
    "color_corpus": ["Белый", "Дуб сонома", "Венге", "Графит"],
    "color_facade_1": ["Белый глянец", "Белый матовый", "Дуб", "Чёрный"],
    "color_facade_2": ["Белый глянец", "Белый матовый", "Дуб", "Чёрный"],
    "color_facade_3": ["Белый глянец", "Белый матовый", "Дуб", "Чёрный"],
    "visible_parts": ["В цвет корпуса", "В цвет фасада", "Нет"],
    "guides": ["Шариф", "Blum", "Hettich", "Без направляющих"],
    "hinges": ["Blum", "Hettich", "GTV", "Без петель"],
    "mirror": ["Есть", "Нет"],
    "countertop": ["38 мм пластик", "Камень", "Дерево", "Нет"],
    "apron": ["Стекло", "Пластик", "Плитка", "Нет"],
    "gola_profile": ["Есть", "Нет"],
    "plinth": ["100 мм", "150 мм", "Нет"],
    "false_panel": ["Есть", "Нет"],
    "light_inset": ["Есть", "Нет"],
    "light_overlay": ["Есть", "Нет"],
    "euro_cut": ["Есть", "Нет"],
    "cutlery_tray": ["Есть", "Нет"],
    "vent_grille": ["Есть", "Нет"],
    "handles": ["Скоба", "Кнопка", "Профиль", "Без ручек"],
}

_RU_TO_LAT = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
})

RESERVED_FIELD_KEYS = set(CRM_DICT_FIELDS) | set(CRM_ADMIN_SCALAR_FIELDS) | {
    "title", "customer", "status", "notes", "materials", "stage_workdays", "custom_fields",
}


def slugify_field_key(label: str, taken: set[str]) -> str:
    folded = label.strip().lower().translate(_RU_TO_LAT)
    raw = re.sub(r"[^a-z0-9]+", "_", folded).strip("_")
    if not raw or not raw[0].isalpha():
        raw = f"field_{raw}".strip("_")
    raw = (raw or "field")[:60]
    key = raw
    number = 2
    while key in taken or key in RESERVED_FIELD_KEYS:
        suffix = f"_{number}"
        key = f"{raw[: 60 - len(suffix)]}{suffix}"
        number += 1
    return key
