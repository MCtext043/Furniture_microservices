import os
from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context

from services.auth_service.app.db import Base as AuthBase
from services.catalog_service.app.db import Base as CatalogBase
from services.cutting_service.app.db import Base as CuttingBase
from services.planner_service.app.db import Base as PlannerBase

from services.auth_service.app import models as _auth_models  # noqa: F401
from services.catalog_service.app import models as _catalog_models  # noqa: F401
from services.cutting_service.app import models as _cutting_models  # noqa: F401
from services.planner_service.app import models as _planner_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = (
    CatalogBase.metadata,
    CuttingBase.metadata,
    PlannerBase.metadata,
    AuthBase.metadata,
)


def get_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://furniture:furniture@localhost:5432/furniture",
    )


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(get_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
