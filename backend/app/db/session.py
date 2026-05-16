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
      - при успешном завершении запроса делает commit;
      - при любом исключении — rollback и пробрасывает дальше;
      - сессия закрывается автоматически через `async with`.

    Это позволяет CRUD-слою использовать только `flush()` —
    финальный коммит централизованно происходит здесь.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise