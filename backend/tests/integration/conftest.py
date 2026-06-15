"""Фикстуры интеграционных тестов.

Поднимают:
    - тестовую БД (создаём схему перед тестом, дропаем после);
    - HTTP-клиент поверх ASGI с подменёнными зависимостями;
    - тестового пользователя в БД.

Обход защитных слоёв:
    - get_db        → подменяется на тестовую сессию;
    - get_current_user → подменяется на фикстурного юзера (минуем JWT/cookie);
    - CSRF          → отключаем флагом settings.CSRF_ENABLED = False.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Регистрируем ВСЕ модели в метаданных Base до create_all.
import app.models  # noqa: F401
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User

TEST_DATABASE_URL = (
    "postgresql+asyncpg://user:0000@127.0.0.1:5440/pencieve_test"
)


@pytest.fixture(autouse=True)
def _disable_csrf():
    """В интеграционных тестах CSRF не проверяем (как в dev)."""
    original = settings.CSRF_ENABLED
    settings.CSRF_ENABLED = False
    yield
    settings.CSRF_ENABLED = original


@pytest_asyncio.fixture
async def db_engine():
    """Движок тестовой БД: пересоздаём схему на каждый тест (изоляция)."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncSession:
    """Сессия для подготовки данных в тесте и для оверрайда get_db."""
    maker = async_sessionmaker(db_engine, class_=AsyncSession,
                               expire_on_commit=False)
    async with maker() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(db_session) -> User:
    """Создаёт реального пользователя в тестовой БД."""
    user = User(email="test@example.com", display_name="Тестовый")
    user.is_active = True
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def client(db_session, test_user) -> AsyncClient:
    """HTTP-клиент с подменёнными get_db и get_current_user."""

    async def _override_get_db():
        yield db_session

    async def _override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport,
                           base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
