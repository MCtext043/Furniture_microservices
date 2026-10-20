"""Russian production calendar for a five-day week.

2025–2027 follow the government transfer decrees. Later years use the Labour
Code default: a holiday on a weekend moves the day off to the next working day.
A shortened pre-holiday day still counts as a working day.
"""

from datetime import date, timedelta

STATUTORY = (
    (1, 1),
    (1, 2),
    (1, 3),
    (1, 4),
    (1, 5),
    (1, 6),
    (1, 7),
    (1, 8),
    (2, 23),
    (3, 8),
    (5, 1),
    (5, 9),
    (6, 12),
    (11, 4),
)

# Plain weekends the decree turns into working days.
FORCED_WORKING = {
    date(2025, 11, 1),
    date(2027, 2, 20),
}

# Destination of a transfer, when that date is not already a weekend.
EXTRA_DAYS_OFF = {
    date(2025, 5, 2),
    date(2025, 5, 8),
    date(2025, 6, 13),
    date(2025, 11, 3),
    date(2025, 12, 31),
    date(2026, 1, 9),
    date(2026, 12, 31),
    date(2027, 2, 22),
    date(2027, 11, 5),
    date(2027, 12, 31),
}

# Weekend days whose rest was moved by a decree, so they must not be moved again.
MOVED_SOURCES = {
    2025: {
        date(2025, 1, 4),
        date(2025, 1, 5),
        date(2025, 2, 23),
        date(2025, 3, 8),
        date(2025, 11, 1),
    },
    2026: {date(2026, 1, 3), date(2026, 1, 4)},
    2027: {date(2027, 1, 2), date(2027, 1, 3), date(2027, 2, 20)},
}

_AUTO_OFF: dict[int, set[date]] = {}


def _automatic_transfers(year: int) -> set[date]:
    cached = _AUTO_OFF.get(year)
    if cached is not None:
        return cached
    moved = MOVED_SOURCES.get(year, set())
    extras: set[date] = set()
    for month, day in STATUTORY:
        holiday = date(year, month, day)
        if holiday.weekday() < 5 or holiday in moved:
            continue
        nxt = holiday + timedelta(days=1)
        while (
            nxt.weekday() >= 5
            or (nxt.month, nxt.day) in STATUTORY
            or nxt in EXTRA_DAYS_OFF
            or nxt in extras
        ):
            nxt += timedelta(days=1)
        extras.add(nxt)
    _AUTO_OFF[year] = extras
    return extras


def is_working_day(day: date) -> bool:
    if day in FORCED_WORKING:
        return True
    if day.weekday() >= 5 or (day.month, day.day) in STATUTORY or day in EXTRA_DAYS_OFF:
        return False
    return day not in _automatic_transfers(day.year)


def add_working_days(start: date, days: int) -> date:
    """The date that is `days` working days after `start`. The start day itself is not counted."""
    if days < 1:
        raise ValueError("working-day offset must be at least 1")
    current = start
    left = days
    while left:
        current += timedelta(days=1)
        if is_working_day(current):
            left -= 1
    return current


def reminder_date(deadline: date, lead_days: int) -> date:
    """Calendar days before the deadline, rolled back to the previous working day."""
    if lead_days < 0:
        raise ValueError("lead days cannot be negative")
    raw = deadline - timedelta(days=lead_days)
    while not is_working_day(raw):
        raw -= timedelta(days=1)
    return raw
