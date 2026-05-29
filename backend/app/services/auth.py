"""Сервис аутентификации.

Сценарии:
    1. Локальная регистрация email+password:
        - создаём User;
        - создаём AuthAccount(provider='email', password_hash=...);
        - создаём дефолтные теги;
        - сразу выдаём пару токенов (автологин);
        - всё в ОДНОЙ транзакции.

    2. Локальный логин email+password:
        - находим AuthAccount по email (с подгруженным User через selectinload);
        - сверяем пароль;
        - обновляем last_login_at;
        - если хеш устарел — ре-хешируем;
        - выдаём пару токенов.

    3. OAuth-вход (VK / Yandex):
        - обмениваем code на access_token провайдера;
        - получаем профиль юзера;
        - get_or_create_oauth_user → User + AuthAccount;
        - обновляем last_login_at;
        - выдаём НАШУ пару токенов.

    4. Refresh: проверяем refresh-токен → выдаём новую пару.

Принципы:
    - Email везде нормализуется (lowercase + strip).
    - Пароль проверяется через argon2 в core.security.
    - Транзакционность: либо вся регистрация прошла, либо ничего.
    - OAuth-токены провайдера НЕ храним — берём профиль и забываем.
"""

from datetime import datetime, timezone
from typing import NoReturn
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    email_taken,
    invalid_credentials,
    token_invalid,
    user_inactive,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.crud.auth_account import (
    create_auth_account,
    get_auth_account,
    get_email_account,
    update_password_hash,
)
from app.crud.user import create_user, get_user_by_email, get_user_by_id
from app.models.auth_account import AuthAccount, AuthProvider
from app.models.user import User
from app.schemas.user import UserLogin, UserRegister
from app.services.defaults import create_default_tags_for_user


# ─────────────────────────────────────────────────────────────────────────────
# Утилиты
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_email(email: str) -> str:
    """Email → lowercase + strip.

    Делаем ОДНУ нормализацию на границе сервиса. После этого CRUD
    работает с уже нормализованным значением и не заботится об этом.
    """
    return email.strip().lower()


def _default_display_name(email: str) -> str:
    """Дефолтное имя из email: 'ivan@hse.ru' → 'ivan'.

    Используется, если юзер не задал имя сам (OAuth не прислал, и т.п.).
    Ограничиваем длиной поля display_name в БД (100).
    """
    local_part = email.split("@", 1)[0]
    return local_part[:100] or "user"


def _issue_token_pair(user: User) -> tuple[str, str]:
    """Создаёт пару (access, refresh) для пользователя.

    sub = user.id. Email в токен НЕ кладём — чтобы при смене email
    старые токены оставались валидными.
    """
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    return access, refresh


def _touch_last_login(auth: AuthAccount) -> None:
    """Обновляет метку времени последнего успешного входа через провайдер.

    Сам flush/commit оставляем вызывающему — он лучше знает границы
    транзакции. Метку обновляем явно (а не через onupdate колонки),
    иначе она бы менялась при любом UPDATE строки (например, смена пароля).
    """
    auth.last_login_at = datetime.now(timezone.utc)


def _oauth_error(detail: str) -> NoReturn:
    """Единый формат ошибки для OAuth-сбоев."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"OAuth: {detail}",
    )


# ─────────────────────────────────────────────────────────────────────────────
# URL-builder для OAuth-провайдеров
# ─────────────────────────────────────────────────────────────────────────────

def build_vk_authorize_url(state: str) -> str:
    """Собирает URL страницы авторизации VK с обязательным state.

    state — короткоживущая случайная строка, защита от OAuth Login CSRF
    (см. OAuth 2.0 Security BCP, раздел 4.7). Проверяется в callback.
    """
    params = {
        "client_id": settings.VK_CLIENT_ID,
        "redirect_uri": settings.VK_REDIRECT_URI,
        "display": "popup",
        "response_type": "code",
        "state": state,
    }
    return f"https://oauth.vk.com/authorize?{urlencode(params)}"


def build_yandex_authorize_url(state: str) -> str:
    """Собирает URL страницы авторизации Yandex с обязательным state."""
    params = {
        "client_id": settings.YANDEX_CLIENT_ID,
        "redirect_uri": settings.YANDEX_REDIRECT_URI,
        "response_type": "code",
        "state": state,
    }
    return f"https://oauth.yandex.ru/authorize?{urlencode(params)}"


# ─────────────────────────────────────────────────────────────────────────────
# 1. Регистрация (email + password) с автологином
# ─────────────────────────────────────────────────────────────────────────────

async def register_user(
    db: AsyncSession, payload: UserRegister,
) -> tuple[User, str, str]:
    """Регистрирует пользователя и СРАЗУ выдаёт пару токенов.

    Возвращает (user, access_token, refresh_token).
    Все БД-операции (user + auth_account + default tags) — в одной транзакции.
    """
    email = _normalize_email(payload.email)

    existing = await get_user_by_email(db, email)
    if existing:
        email_taken()

    try:
        user = await create_user(
            db,
            email=email,
            display_name=_default_display_name(email),
        )

        password_hash_value = hash_password(payload.password)
        await create_auth_account(
            db,
            user_id=user.id,
            provider=AuthProvider.EMAIL,
            provider_user_id=email,
            password_hash=password_hash_value,
        )

        await create_default_tags_for_user(db, user.id)

        await db.commit()
        await db.refresh(user)
    except Exception:
        await db.rollback()
        raise

    access, refresh = _issue_token_pair(user)
    return user, access, refresh


# ─────────────────────────────────────────────────────────────────────────────
# 2. Логин (email + password)
# ─────────────────────────────────────────────────────────────────────────────

async def login_user(
    db: AsyncSession, payload: UserLogin,
) -> tuple[User, str, str]:
    """Логин по email+паролю. Возвращает (user, access, refresh).

    Безопасность:
        - Один и тот же ответ при «нет такого email» и «неверный пароль» —
          защита от user enumeration (invalid_credentials → 401).
        - Re-hash пароля, если параметры argon2 в коде стали строже.
        - Обновляем last_login_at при успехе — для аудита.

    Оптимизация: get_email_account уже подгружает связанного User через
    selectinload, отдельный get_user_by_id не нужен — экономим один SQL.
    """
    email = _normalize_email(payload.email)

    auth = await get_email_account(db, email)
    if not auth or not auth.password_hash:
        invalid_credentials()

    if not verify_password(payload.password, auth.password_hash):
        invalid_credentials()

    user = auth.user  # уже подгружен через selectinload
    if not user:
        # Теоретически невозможно (FK с CASCADE), но защищаемся.
        invalid_credentials()
    if not user.is_active:
        user_inactive()

    # Обновления (last_login_at + опциональный rehash) объединены в одну
    # транзакцию — один commit вместо двух.
    _touch_last_login(auth)

    if needs_rehash(auth.password_hash):
        new_hash = hash_password(payload.password)
        await update_password_hash(db, auth, new_hash)

    await db.commit()
    await db.refresh(user)

    access, refresh = _issue_token_pair(user)
    return user, access, refresh


# ─────────────────────────────────────────────────────────────────────────────
# 3. Refresh
# ─────────────────────────────────────────────────────────────────────────────

async def refresh_tokens(
    db: AsyncSession, refresh_token: str,
) -> tuple[User, str, str]:
    """Проверяет refresh-токен и выдаёт новую пару.

    Сценарии отказа (все → 401):
        - токен невалиден / просрочен;
        - токен не типа refresh (защита от подмены access→refresh);
        - в токене нет sub или он не int;
        - юзера больше нет.
    Если юзер заблокирован → 403 (user_inactive).
    """
    payload = decode_refresh_token(refresh_token)
    if not payload:
        token_invalid()

    sub = payload.get("sub") if payload else None
    if sub is None:  # 0 — валидный id, поэтому именно is None
        token_invalid()

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        token_invalid()
        raise  # unreachable, но защищает от регрессии если token_invalid поменяется

    user = await get_user_by_id(db, user_id)
    if not user:
        token_invalid()
    if not user.is_active:
        user_inactive()

    access, refresh = _issue_token_pair(user)
    return user, access, refresh


# ─────────────────────────────────────────────────────────────────────────────
# 4. OAuth — общий «найти или создать»
# ─────────────────────────────────────────────────────────────────────────────

async def get_or_create_oauth_user(
    db: AsyncSession,
    *,
    provider: AuthProvider,
    provider_user_id: str,
    email: str | None,
    display_name: str | None = None,
) -> tuple[User, str, str]:
    """Универсальный обработчик OAuth-логина.

    Логика поиска (по приоритету):
        1. Привязка (provider, provider_user_id) уже есть → это он.
           Обновляем last_login_at.
        2. Есть юзер с таким email → линкуем новую auth-привязку.
        3. Создаём нового юзера + auth-привязку + дефолтные теги.

    Если провайдер не вернул email (бывает у VK без скоупа email) —
    создаём синтетический "vk_<id>@oauth.local". Юзер сможет потом
    задать настоящий email в профиле.

    Оптимизация: get_auth_account возвращает AuthAccount с уже
    подгруженным User (selectinload) — отдельный get_user_by_id не нужен.
    """
    # Сценарий 1: уже существующая привязка.
    existing_auth = await get_auth_account(db, provider, provider_user_id)
    if existing_auth:
        user = existing_auth.user
        if not user:
            token_invalid()
        if not user.is_active:
            user_inactive()

        _touch_last_login(existing_auth)
        await db.commit()
        await db.refresh(user)

        access, refresh = _issue_token_pair(user)
        return user, access, refresh

    # Сценарий 2: есть юзер с таким email — линкуем новую привязку.
    if email:
        email = _normalize_email(email)
        existing_user = await get_user_by_email(db, email)
        if existing_user:
            if not existing_user.is_active:
                user_inactive()
            try:
                new_auth = await create_auth_account(
                    db,
                    user_id=existing_user.id,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    password_hash=None,
                )
                _touch_last_login(new_auth)
                await db.commit()
                await db.refresh(existing_user)
            except Exception:
                await db.rollback()
                raise

            access, refresh = _issue_token_pair(existing_user)
            return existing_user, access, refresh
    else:
        # OAuth-провайдер не дал email — генерим синтетический.
        email = f"{provider.value}_{provider_user_id}@oauth.invalid"

    # Сценарий 3: создаём нового юзера + привязку + дефолтные теги.
    try:
        new_user = await create_user(
            db,
            email=email,
            display_name=display_name or _default_display_name(email),
        )
        new_auth = await create_auth_account(
            db,
            user_id=new_user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            password_hash=None,
        )
        _touch_last_login(new_auth)
        await create_default_tags_for_user(db, new_user.id)

        await db.commit()
        await db.refresh(new_user)
    except Exception:
        await db.rollback()
        raise

    access, refresh = _issue_token_pair(new_user)
    return new_user, access, refresh


# ─────────────────────────────────────────────────────────────────────────────
# 5. OAuth: Yandex
# ─────────────────────────────────────────────────────────────────────────────

_YANDEX_TOKEN_URL = "https://oauth.yandex.ru/token"
_YANDEX_USERINFO_URL = "https://login.yandex.ru/info"


async def oauth_yandex_login(
    db: AsyncSession, code: str,
) -> tuple[User, str, str]:
    """Полный цикл Yandex OAuth.

    Шаги:
        1. Меняем code на access_token Яндекса (POST на token-endpoint).
        2. Берём профиль (GET /info с Authorization: OAuth <token>).
        3. Передаём в get_or_create_oauth_user.

    Все сетевые сбои → 400 "OAuth: ...", чтобы фронт мог показать ошибку.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            token_resp = await client.post(
                _YANDEX_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": settings.YANDEX_CLIENT_ID,
                    "client_secret": settings.YANDEX_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        except httpx.HTTPError as e:
            _oauth_error(f"не удалось связаться с Яндексом: {e}")

        if token_resp.status_code != 200:
            _oauth_error(f"Яндекс отказал в токене ({token_resp.status_code})")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            _oauth_error("Яндекс не вернул access_token")

        try:
            info_resp = await client.get(
                _YANDEX_USERINFO_URL,
                headers={"Authorization": f"OAuth {access_token}"},
                params={"format": "json"},
            )
        except httpx.HTTPError as e:
            _oauth_error(f"не удалось получить профиль: {e}")

        if info_resp.status_code != 200:
            _oauth_error(f"Яндекс отказал в профиле ({info_resp.status_code})")

        info = info_resp.json()

    provider_user_id = str(info.get("id") or "")
    if not provider_user_id:
        _oauth_error("Яндекс не вернул id пользователя")

    email = info.get("default_email") or (info.get("emails") or [None])[0]
    display_name = info.get("real_name") or info.get("display_name") or info.get("login")

    return await get_or_create_oauth_user(
        db,
        provider=AuthProvider.YANDEX,
        provider_user_id=provider_user_id,
        email=email,
        display_name=display_name,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. OAuth: VK
# ─────────────────────────────────────────────────────────────────────────────

_VK_TOKEN_URL = "https://oauth.vk.com/access_token"
_VK_USERS_GET_URL = "https://api.vk.com/method/users.get"
_VK_API_VERSION = "5.199"


async def oauth_vk_login(
    db: AsyncSession, code: str,
) -> tuple[User, str, str]:
    """Полный цикл VK OAuth.

    Шаги:
        1. Меняем code на access_token + email (VK возвращает email в ответе
           токена, а НЕ в users.get — это особенность VK API).
        2. Берём профиль через users.get (получаем имя/фамилию).
        3. Передаём в get_or_create_oauth_user.

    ⚠️ Требуется VK_CLIENT_SECRET в settings. Пока его нет — функция
    отвечает 501 Not Implemented с понятным сообщением.
    """
    if not getattr(settings, "VK_CLIENT_SECRET", None):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="VK OAuth ещё не настроен: отсутствует VK_CLIENT_SECRET",
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            token_resp = await client.get(
                _VK_TOKEN_URL,
                params={
                    "client_id": settings.VK_CLIENT_ID,
                    "client_secret": settings.VK_CLIENT_SECRET,
                    "redirect_uri": settings.VK_REDIRECT_URI,
                    "code": code,
                },
            )
        except httpx.HTTPError as e:
            _oauth_error(f"не удалось связаться с VK: {e}")

        if token_resp.status_code != 200:
            _oauth_error(f"VK отказал в токене ({token_resp.status_code})")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        vk_user_id = token_data.get("user_id")
        email = token_data.get("email")

        if not access_token or not vk_user_id:
            _oauth_error("VK не вернул access_token или user_id")

        try:
            users_resp = await client.get(
                _VK_USERS_GET_URL,
                params={
                    "user_ids": vk_user_id,
                    "fields": "first_name,last_name",
                    "access_token": access_token,
                    "v": _VK_API_VERSION,
                },
            )
        except httpx.HTTPError as e:
            _oauth_error(f"не удалось получить профиль VK: {e}")

        if users_resp.status_code != 200:
            _oauth_error(f"VK отказал в профиле ({users_resp.status_code})")

        users_data = users_resp.json()

    response = users_data.get("response") or []
    if not response:
        _oauth_error("VK вернул пустой профиль")

    profile = response[0]
    first = profile.get("first_name") or ""
    last = profile.get("last_name") or ""
    display_name = f"{first} {last}".strip() or None

    return await get_or_create_oauth_user(
        db,
        provider=AuthProvider.VK,
        provider_user_id=str(vk_user_id),
        email=email,
        display_name=display_name,
    )