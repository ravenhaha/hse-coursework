"""Фабрики моков для unit-тестов сервисного слоя."""

from unittest.mock import AsyncMock, MagicMock


def mock_db_session() -> AsyncMock:
    """Мок AsyncSession.

    commit/refresh/flush/rollback — корутины-заглушки.
    Сервисный слой их вызывает, но в unit-тестах нам важна
    только логика, а не реальная запись.
    """
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.flush = AsyncMock()
    db.rollback = AsyncMock()
    return db
