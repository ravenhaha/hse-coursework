from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from models.auth_account import AuthAccount


async def get_auth_account(
    db: AsyncSession,
    provider: str,
    provider_user_id: str,
) -> AuthAccount | None:
    """Ищет привязку OAuth по провайдеру и ID пользователя у провайдера."""
    stmt = (
        select(AuthAccount)
        .where(
            AuthAccount.provider_auth == provider,
            AuthAccount.provider_user_id == provider_user_id,
        )
        .options(joinedload(AuthAccount.user))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_auth_account(
    db: AsyncSession,
    user_id: int,
    provider: str,
    provider_user_id: str,
) -> AuthAccount:
    auth_account = AuthAccount(
        user_id=user_id,
        provider_auth=provider,
        provider_user_id=provider_user_id,
    )
    db.add(auth_account)
    await db.flush()
    return auth_account