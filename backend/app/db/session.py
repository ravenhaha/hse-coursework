"""Подключение к БД: async-движок SQLAlchemy и фабрика сессий для DI в FastAPI."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=not settings.IS_PRODUCTION,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI-зависимость: выдаёт асинхронную сессию БД.

    Поведение транзакции:
      - сервисный слой САМ управляет commit/rollback;
      - при необработанном исключении делаем rollback как safety net;
      - сессия закрывается автоматически через `async with`.

    Почему не делаем auto-commit здесь:
      - сервисы часто делают НЕСКОЛЬКО транзакций в одном запросе
        (например, OAuth: создать юзера → commit → потом ещё операции);
      - явный commit в сервисе нагляднее показывает границы транзакций;
      - после commit может потребоваться `db.refresh(obj)` — это удобно
        делать в сервисе.

    CRUD-слой использует `flush()` для получения server-generated полей
    (id, created_at), а commit делает сервис.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise