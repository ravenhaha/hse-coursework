"""Alembic environment configuration."""

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# Добавляем backend/ в sys.path, чтобы работали импорты `from app.xxx`
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Импортируем настройки и Base ПОСЛЕ правки sys.path
from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402

# Импортируем все модели, чтобы они зарегистрировались в Base.metadata
from app.models.user import User  # noqa: E402, F401
from app.models.auth_account import AuthAccount  # noqa: E402, F401
from app.models.collection import Collection  # noqa: E402, F401
from app.models.material import Material  # noqa: E402, F401
from app.models.tag import Tag  # noqa: E402, F401
from app.models.material_tag import MaterialTag  # noqa: E402, F401

config = context.config

# Для Alembic нужен СИНХРОННЫЙ URL.
# settings.DATABASE_URL уже синхронный (postgresql+psycopg://...),
# так что просто берём его как есть.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Запуск миграций в offline-режиме (без подключения к БД)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Запуск миграций в online-режиме (с подключением к БД)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()