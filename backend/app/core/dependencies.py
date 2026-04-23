from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from core.security import decode_token
from core.config import settings
from models.user import User
from core.exceptions import token_invalid, token_missing, user_not_found, user_inactive


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # 1. Берём токен ТОЛЬКО из httpOnly cookie
    token = request.cookies.get("access_token")

    if not token:
        token_missing()

    # 2. CSRF-проверка — только если включена
    if settings.CSRF_ENABLED and request.method in ("POST", "PUT", "DELETE", "PATCH"):
        csrf_cookie = request.cookies.get("csrf_token")
        csrf_header = request.headers.get("X-CSRF-Token")

        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            token_invalid()

    # 3. Декодируем JWT
    payload = decode_token(token)

    if not payload:
        token_invalid()

    if payload.get("type") != "access":
        token_invalid()

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        token_invalid()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        user_not_found()

    if not user.is_active:
        user_inactive()

    return user