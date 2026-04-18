import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from crud.user import get_user_by_email, create_user, get_user_by_id
from crud.auth_account import get_auth_account, create_auth_account
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from core.config import settings
from core.exceptions import (
    email_taken,
    invalid_credentials,
    user_inactive,
    user_not_found,
    refresh_token_missing,
    token_invalid,
)


# ─── Локальная регистрация ───

async def register_user(db: AsyncSession, email: str, password: str):
    existing = await get_user_by_email(db, email)
    if existing:
        email_taken()

    hashed = hash_password(password)
    user = await create_user(db, email=email, hashed_password=hashed)
    await db.commit()
    await db.refresh(user)
    return user


# ─── Локальный вход ───

async def authenticate_user(db: AsyncSession, email: str, password: str):
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        invalid_credentials()

    if not user.is_active:
        user_inactive()

    access = create_access_token(user.id)       # ← ИСПРАВЛЕНО: int, не dict
    refresh = create_refresh_token(user.id)     # ← ИСПРАВЛЕНО
    return user, access, refresh


# ─── Обновление токенов ───

async def refresh_tokens(db: AsyncSession, token: str | None):
    if not token:
        refresh_token_missing()

    payload = decode_token(token)
    if not payload:
        token_invalid()

    # ── Проверяем что это именно refresh-токен ──
    if payload.get("type") != "refresh":
        token_invalid()

    user = await get_user_by_id(db, int(payload["sub"]))
    if not user:
        user_not_found()
    if not user.is_active:
        user_inactive()

    access = create_access_token(user.id)       # ← ИСПРАВЛЕНО
    refresh = create_refresh_token(user.id)     # ← ИСПРАВЛЕНО
    return access, refresh


# ─── OAuth (общая логика) ───

async def _oauth_get_or_create(
    db: AsyncSession,
    provider: str,
    provider_user_id: str,
    email: str | None,
):
    # 1. Ищем по OAuth-привязке в auth_accounts
    auth_acc = await get_auth_account(db, provider, provider_user_id)
    if auth_acc:
        user = auth_acc.user
        access = create_access_token(user.id)   # ← ИСПРАВЛЕНО
        refresh = create_refresh_token(user.id) # ← ИСПРАВЛЕНО
        return user, access, refresh

    # 2. Если не нашли привязку, но есть email — ищем пользователя по email
    user = None
    if email:
        user = await get_user_by_email(db, email)

    # 3. Если пользователя вообще нет — создаём нового
    if not user:
        user = await create_user(db, email=email)

    # 4. Создаём привязку OAuth-аккаунта к пользователю
    await create_auth_account(db, user.id, provider, provider_user_id)

    await db.commit()
    await db.refresh(user)

    access = create_access_token(user.id)       # ← ИСПРАВЛЕНО
    refresh = create_refresh_token(user.id)     # ← ИСПРАВЛЕНО
    return user, access, refresh


# ─── VK OAuth ───

async def oauth_vk_login(db: AsyncSession, code: str):
    async with httpx.AsyncClient() as client:
        token_resp = await client.get(
            "https://oauth.vk.com/access_token",
            params={
                "client_id": settings.VK_CLIENT_ID,
                "client_secret": settings.VK_CLIENT_SECRET,
                "redirect_uri": settings.VK_REDIRECT_URI,
                "code": code,
            },
        )
        data = token_resp.json()
        vk_id = str(data["user_id"])
        email = data.get("email")

    return await _oauth_get_or_create(db, "vk", vk_id, email)


# ─── Yandex OAuth ───

async def oauth_yandex_login(db: AsyncSession, code: str):
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth.yandex.ru/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.YANDEX_CLIENT_ID,
                "client_secret": settings.YANDEX_CLIENT_SECRET,
            },
        )
        token_data = token_resp.json()
        ya_access_token = token_data["access_token"]

        user_resp = await client.get(
            "https://login.yandex.ru/info",
            headers={"Authorization": f"OAuth {ya_access_token}"},
        )
        user_data = user_resp.json()

    yandex_id = str(user_data["id"])
    email = user_data.get("default_email")

    return await _oauth_get_or_create(db, "yandex", yandex_id, email)