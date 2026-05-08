"""
Pytest общая конфигурация: API-тесты работают только с PostgreSQL.

Перед запуском должен быть доступен сервер Postgres (локально или из Docker Compose).
При необходимости создаётся БД из TEST_DATABASE_URL (по умолчанию furniture_test).
"""

from __future__ import annotations

import os
import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.engine.url import URL
from sqlalchemy.orm import sessionmaker


def pytest_configure(config: pytest.Config) -> None:
    default_url = "postgresql+psycopg2://furniture:furniture@127.0.0.1:5432/furniture_test"
    os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL") or default_url


def _sanitize_db_name(dbname: str) -> None:
    if not re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_]*", dbname):
        raise ValueError(f"Unsafe database name: {dbname}")


def _ensure_postgres_database(url: URL) -> None:
    if url.drivername.split("+")[0] != "postgresql":
        return
    dbname = url.database
    if not dbname:
        return
    _sanitize_db_name(dbname)
    admin_url: URL = url.set(database="postgres")
    adm = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with adm.connect() as conn:
            row = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :d"),
                {"d": dbname},
            ).fetchone()
            if row is None:
                conn.execute(text(f'CREATE DATABASE "{dbname}"'))
    finally:
        adm.dispose()


def pytest_sessionstart(session: pytest.Session) -> None:
    url_text = os.environ.get("DATABASE_URL", "")
    try:
        u = make_url(url_text)
    except Exception:
        pytest.exit(f"Некорректный DATABASE_URL: {url_text!r}", returncode=1)

    if u.drivername.split("+")[0] != "postgresql":
        pytest.exit(
            "Тесты работают только с PostgreSQL. Задайте TEST_DATABASE_URL (postgresql+psycopg2://...)",
            returncode=1,
        )
    try:
        _ensure_postgres_database(u)
    except Exception as exc:
        pytest.exit(
            f"Не удалось подключиться к PostgreSQL или создать БД '{u.database}': {exc}\n"
            "Поднимите сервер (например docker compose up postgres).",
            returncode=1,
        )


_TRUNCATE_CATALOG = text(
    """
    TRUNCATE TABLE
      catalog_cart_items,
      catalog_wishlist_items,
      catalog_product_reviews,
      catalog_products,
      catalog_categories
    RESTART IDENTITY CASCADE
    """
)
_TRUNCATE_CUTTING = text("TRUNCATE TABLE cutting_jobs RESTART IDENTITY CASCADE")
_TRUNCATE_PLANNER = text(
    "TRUNCATE TABLE planner_furniture, planner_projects RESTART IDENTITY CASCADE"
)


@pytest.fixture(scope="module")
def catalog_engine():
    from services.catalog_service.app.db import Base
    from services.catalog_service.app import models as _catalog_models  # noqa: F401

    engine = create_engine(os.environ["DATABASE_URL"], future=True, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def catalog_client(catalog_engine):
    from services.catalog_service.app.db import get_session
    from services.catalog_service.app.main import app as catalog_app

    with catalog_engine.begin() as conn:
        conn.execute(_TRUNCATE_CATALOG)

    TestingSessionLocal = sessionmaker(bind=catalog_engine, autoflush=False, autocommit=False)

    def override_get_session():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    catalog_app.dependency_overrides[get_session] = override_get_session
    yield TestClient(catalog_app)
    catalog_app.dependency_overrides.pop(get_session, None)


@pytest.fixture(scope="module")
def cutting_engine():
    from services.cutting_service.app.db import Base
    from services.cutting_service.app import models as _cutting_models  # noqa: F401

    engine = create_engine(os.environ["DATABASE_URL"], future=True, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def cutting_client(cutting_engine):
    from services.cutting_service.app.db import get_session
    from services.cutting_service.app.main import app as cutting_app

    with cutting_engine.begin() as conn:
        conn.execute(_TRUNCATE_CUTTING)

    TestingSessionLocal = sessionmaker(bind=cutting_engine, autoflush=False, autocommit=False)

    def override_get_session():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    cutting_app.dependency_overrides[get_session] = override_get_session
    yield TestClient(cutting_app)
    cutting_app.dependency_overrides.pop(get_session, None)


@pytest.fixture(scope="module")
def planner_engine():
    from services.planner_service.app.db import Base
    from services.planner_service.app import models as _planner_models  # noqa: F401

    engine = create_engine(os.environ["DATABASE_URL"], future=True, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def planner_client(planner_engine):
    from services.planner_service.app.db import get_session
    from services.planner_service.app.main import app as planner_app

    with planner_engine.begin() as conn:
        conn.execute(_TRUNCATE_PLANNER)

    TestingSessionLocal = sessionmaker(bind=planner_engine, autoflush=False, autocommit=False)

    def override_get_session():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    planner_app.dependency_overrides[get_session] = override_get_session
    yield TestClient(planner_app)
    planner_app.dependency_overrides.pop(get_session, None)
