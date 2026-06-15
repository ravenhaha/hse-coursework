"""CRUD-операции для пользователей.

Принципы:
    - Тонкий слой над БД: только запросы, без бизнес-логики.
    - Бизнес-правила (уникальность email, генерация display_name) — в services/.
    - Все функции делают flush, но НЕ commit — это ответственность сервиса.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


# ══════════════════════════════════════════
# READ
# ══════════════════════════════════════════
async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Возвращает пользователя по id или None."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Возвращает пользователя по email или None.

    Email сравнивается как есть — нормализацию (lowercase + strip)
    делает сервис ПЕРЕД вызовом этой функции.
    """
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


# ══════════════════════════════════════════
# CREATE
# ══════════════════════════════════════════
async def create_user(
    db: AsyncSession,
    *,
    email: str,
    display_name: str | None = None,
    avatar_path: str | None = None,
) -> User:
    """Создаёт пользователя и делает flush, чтобы получить id.

    Все аутентификационные данные (пароль, oauth-привязки) живут в auth_accounts.
    Здесь только «личность».

    Email на этом уровне НЕ валидируется на уникальность —
    проверка должна быть в сервисе (там можно красиво райзнуть 409).
    """
    user = User(
        email=email,
        display_name=display_name,
        avatar_path=avatar_path,
    )
    db.add(user)
    await db.flush()
    return user


# ══════════════════════════════════════════
# UPDATE
# ══════════════════════════════════════════
_UPDATABLE_USER_FIELDS: frozenset[str] = frozenset({
    "display_name",
    "avatar_path",
})


async def update_user(db: AsyncSession, user: User, **fields) -> User:
    """Обновляет разрешённые поля пользователя.

    Поля не из whitelist тихо игнорируются.
    Это защита от случайного `update_user(db, user, id=999)`.
    """
    for key, value in fields.items():
        if key in _UPDATABLE_USER_FIELDS:
            setattr(user, key, value)
    await db.flush()
    return user


# ══════════════════════════════════════════
# DELETE
# ══════════════════════════════════════════
async def delete_user(db: AsyncSession, user: User) -> None:
    """Удаляет пользователя.

    Каскадно зачищает связанные таблицы (auth_accounts, collections,
    materials через коллекции, tags) — настроено на уровне БД
    (ondelete='CASCADE' в FK).
    """
    await db.delete(user)
    await db.flush()