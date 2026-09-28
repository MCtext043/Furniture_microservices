"""Shared CRM admin field keys, labels and default dictionary values."""

from __future__ import annotations

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
