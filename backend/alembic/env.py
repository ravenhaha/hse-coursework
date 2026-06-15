"""Alembic environment configuration."""

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.db.base import Base

# Импорт всех моделей — нужен, чтобы Base.metadata знала о всех таблицах
# для autogenerate. НЕ удалять, даже если кажется "неиспользуемым".
from app.models.user import User  # noqa: F401
from app.models.auth_account import AuthAccount  # noqa: F401
from app.models.collection import Collection  # noqa: F401
from app.models.material import Material  # noqa: F401
from app.models.tag import Tag  # noqa: F401
from app.models.material_tag import MaterialTag  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ─────────────────────────────────────────────────────────────────────────────
# Фильтр объектов для autogenerate
# ─────────────────────────────────────────────────────────────────────────────

# Индексы, которые создаются ВРУЧНУЮ в миграциях (функциональные индексы,
# которые SQLAlchemy не умеет нормально объявлять в моделях).
#
# Без этого фильтра autogenerate каждый раз будет предлагать их удалить,
# потому что в моделях их нет → расхождение «БД vs metadata».
#
# При добавлении нового ручного индекса — допиши его имя сюда.
MANUAL_INDEXES: set[str] = {
    "uq_tags_user_lower_name",  # UNIQUE на (user_id, lower(tag_name))
}


def include_object(object, name, type_, reflected, compare_to):
    """Решает, включать ли объект в сравнение autogenerate.

    Возвращает False — объект игнорируется (не будет ни drop, ни create).
    """
    if type_ == "index" and name in MANUAL_INDEXES:
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Запуск миграций
# ─────────────────────────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """Запуск миграций в offline-режиме (без подключения к БД)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
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
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()