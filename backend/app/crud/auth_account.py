"""CRUD-операции для способов аутентификации (auth_accounts).

В этой таблице живут все способы входа пользователя:
    - email + password_hash  (provider_auth='email')
    - VK / Yandex            (provider_auth='vk' / 'yandex', password_hash=NULL)

Тонкий слой: только запросы, без бизнес-логики.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth_account import AuthAccount, AuthProvider


# ══════════════════════════════════════════
# READ
# ══════════════════════════════════════════
async def get_auth_account(
    db: AsyncSession,
    provider: str | AuthProvider,
    provider_user_id: str,
) -> AuthAccount | None:
    """Ищет привязку по паре (провайдер, id у провайдера).

    Используется при логине через OAuth: «есть ли у нас уже такой VK-юзер?».
    Сразу подгружаем связанного юзера через selectinload — это избавляет
    сервис от лишнего запроса get_user_by_id(auth.user_id).
    """
    stmt = (
        select(AuthAccount)
        .where(
            AuthAccount.provider_auth == str(provider),
            AuthAccount.provider_user_id == provider_user_id,
        )
        .options(selectinload(AuthAccount.user))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_email_account(
    db: AsyncSession, email: str,
) -> AuthAccount | None:
    """Достаёт email-аккаунт пользователя (provider_auth='email').

    Используется при логине: достаём password_hash для проверки пароля.
    Email сравнивается КАК ЕСТЬ — нормализацию делает сервис.
    Сразу подгружаем связанного юзера через selectinload — это избавляет
    сервис от лишнего запроса get_user_by_id(auth.user_id) после успешной
    проверки пароля.
    """
    stmt = (
        select(AuthAccount)
        .where(
            AuthAccount.provider_auth == AuthProvider.EMAIL.value,
            AuthAccount.provider_user_id == email,
        )
        .options(selectinload(AuthAccount.user))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_auth_accounts(
    db: AsyncSession, user_id: int,
) -> list[AuthAccount]:
    """Все способы входа конкретного юзера.

    Зарезервировано для будущей страницы «Подключённые аккаунты» в профиле.
    """
    stmt = select(AuthAccount).where(AuthAccount.user_id == user_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ══════════════════════════════════════════
# CREATE
# ══════════════════════════════════════════
async def create_auth_account(
    db: AsyncSession,
    *,
    user_id: int,
    provider: str | AuthProvider,
    provider_user_id: str,
    password_hash: str | None = None,
) -> AuthAccount:
    """Создаёт привязку «юзер ↔ способ входа».

    Для email-регистрации: provider='email', provider_user_id=<email>,
    password_hash=<argon2>.

    Для OAuth: provider='vk'/'yandex', provider_user_id=<id у провайдера>,
    password_hash=None.

    Уникальность пары (provider, provider_user_id) гарантирует БД —
    тут на это не полагаемся, проверка должна быть в сервисе.
    """
    account = AuthAccount(
        user_id=user_id,
        provider_auth=str(provider),
        provider_user_id=provider_user_id,
        password_hash=password_hash,
    )
    db.add(account)
    await db.flush()
    return account


# ══════════════════════════════════════════
# UPDATE
# ══════════════════════════════════════════
async def update_password_hash(
    db: AsyncSession,
    account: AuthAccount,
    new_password_hash: str,
) -> AuthAccount:
    """Обновляет password_hash у email-аккаунта.

    Сценарии:
        - смена пароля юзером;
        - автоматический ре-хеш при логине, если параметры argon2 устарели
          (см. core.security.needs_rehash).
    """
    account.password_hash = new_password_hash
    await db.flush()
    return account


# ══════════════════════════════════════════
# DELETE
# ══════════════════════════════════════════
async def delete_auth_account(
    db: AsyncSession, account: AuthAccount,
) -> None:
    """Удаляет одну привязку (например, юзер отвязал VK от аккаунта).

    Удаление SAMOG юзера → каскадом снесёт все его auth_accounts автоматически.
    Эта функция нужна только для частичной отвязки.
    """
    await db.delete(account)
    await db.flush()