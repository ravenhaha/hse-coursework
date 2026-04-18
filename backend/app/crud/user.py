from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(User.user_email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    email: str | None = None,
    hashed_password: str | None = None,
    display_name: str = "",
    avatar_url: str | None = None,
) -> User:
    user = User(
        user_email=email,
        hashed_password=hashed_password,
        display_name=display_name or (email.split("@")[0] if email else "User"),
        avatar_url=avatar_url,
    )
    db.add(user)
    await db.flush()
    return user