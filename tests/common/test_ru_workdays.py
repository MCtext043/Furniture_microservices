"""Russian production calendar: weekends, holidays, and government transfers."""

from datetime import date

from common.ru_workdays import add_working_days, is_working_day, reminder_date


def test_new_year_2026_transfers():
    assert not is_working_day(date(2026, 1, 9))
    assert not is_working_day(date(2026, 1, 11))
    assert is_working_day(date(2026, 1, 12))
    assert not is_working_day(date(2026, 12, 31))


def test_march_and_may_2026():
    assert not is_working_day(date(2026, 3, 8))
    assert not is_working_day(date(2026, 3, 9))
    assert is_working_day(date(2026, 3, 10))
    assert not is_working_day(date(2026, 5, 1))
    assert not is_working_day(date(2026, 5, 11))
    assert is_working_day(date(2026, 5, 12))


def test_2027_transfers_follow_the_decree():
    assert not is_working_day(date(2027, 1, 2))
    assert not is_working_day(date(2027, 1, 10))
    assert is_working_day(date(2027, 1, 11))
    assert is_working_day(date(2027, 2, 20))
    assert not is_working_day(date(2027, 2, 22))
    assert not is_working_day(date(2027, 11, 5))
    assert not is_working_day(date(2027, 12, 31))


def test_add_working_days_skips_weekend():
    friday = date(2026, 10, 9)
    assert add_working_days(friday, 1) == date(2026, 10, 12)
    assert add_working_days(friday, 3) == date(2026, 10, 14)


def test_add_working_days_crosses_2027_new_year():
    assert add_working_days(date(2026, 12, 30), 1) == date(2027, 1, 11)


def test_womens_day_2026_pushes_the_next_monday():
    assert add_working_days(date(2026, 3, 6), 1) == date(2026, 3, 10)


def test_reminder_moves_off_a_weekend():
    deadline = date(2026, 10, 14)
    assert reminder_date(deadline, 3) == date(2026, 10, 9)
    assert reminder_date(deadline, 0) == deadline
