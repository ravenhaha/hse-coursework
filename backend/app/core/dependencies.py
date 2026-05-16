"""FastAPI-зависимости приложения.

Здесь собраны переиспользуемые `Depends(...)`-функции:
- получение текущего пользователя из cookie + JWT
- проверка CSRF-токена для небезопасных методов
- получение опционального пользователя (для эндпоинтов, где auth не обязателен)
- Annotated-алиасы для краткости в роутах

Логика типов токенов:
    - access-токен  → защищённые ручки (CurrentUser);
    - refresh-токен → только POST /auth/refresh (RefreshToken).
    Подмена одного другим блокируется на уровне decode_*_token —
    эти функции отказывают, если type не совпал.
"""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    refresh_token_missing,
    token_invalid,
    token_missing,
    user_inactive,
    user_not_found,
)
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User


# Методы, которые НЕ изменяют состояние → CSRF не нужен.
_SAFE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})


# ══════════════════════════════════════════
# Внутренние хелперы (не для импорта снаружи)
# ══════════════════════════════════════════

def _extract_access_token(request: Request) -> str:
    """Достаёт access_token из cookie. Райзит 401, если его нет."""
    token = request.cookies.get("access_token")
    if not token:
        token_missing()
    return token


def _user_id_from_access_token(token: str) -> int:
    """Декодирует access-токен и возвращает user_id.

    Райзит 401 при любых проблемах:
        - невалидная подпись / истёк срок;
        - тип токена != "access" (например, прислали refresh);
        - отсутствует или нечисловой sub.
    """
    payload = decode_access_token(token)
    if payload is None:
        # decode_access_token уже отсёк случаи "неверный тип" и "битый JWT".
        token_invalid()

    sub = payload.get("sub")
    if sub is None:
        token_invalid()

    try:
        return int(sub)
    except (TypeError, ValueError):
        token_invalid()


def _check_csrf(request: Request) -> None:
    """Проверяет совпадение CSRF-токена в cookie и заголовке X-CSRF-Token.

    Включается флагом settings.CSRF_ENABLED.
    Пропускает безопасные методы (GET/HEAD/OPTIONS).

    Сравнение — обычное == (не constant-time): CSRF-токен публичный
    (он в cookie клиента), timing-атака на нём бессмысленна.
    """
    if not settings.CSRF_ENABLED:
        return
    if request.method in _SAFE_METHODS:
        return

    cookie_token = request.cookies.get("csrf_token")
    header_token = request.headers.get("X-CSRF-Token")

    if not cookie_token or not header_token or cookie_token != header_token:
        # 401, а не 403 — чтобы фронт мог общим обработчиком на 401
        # дёрнуть /auth/refresh и заодно перевыдать csrf-cookie.
        token_invalid()


async def _load_active_user(db: AsyncSession, user_id: int) -> User:
    """Берёт пользователя из БД и проверяет, что он активен.

    Разделяем 404 (нет такого) и 403 (есть, но заблокирован) —
    это помогает фронту корректно показать сообщение.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        user_not_found()
    if not user.is_active:
        user_inactive()

    return user


# ══════════════════════════════════════════
# Публичные dependencies
# ══════════════════════════════════════════

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Главный гард: возвращает авторизованного пользователя или райзит 401/403/404.

    Порядок проверок:
        1. CSRF (для не-GET запросов, если включён)
        2. Наличие access_token в cookie
        3. Валидность подписи, срока и типа JWT
        4. Существование и активность юзера в БД
    """
    _check_csrf(request)
    token = _extract_access_token(request)
    user_id = _user_id_from_access_token(token)
    return await _load_active_user(db, user_id)


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """То же, что get_current_user, но возвращает None вместо 401.

    Подходит для эндпоинтов, где контент разный для гостя и юзера
    (например, главная страница).

    Намеренно НЕ проверяет CSRF: optional-юзер используется в GET-ручках,
    а на GET CSRF и так не нужен.
    """
    token = request.cookies.get("access_token")
    if not token:
        return None

    payload = decode_access_token(token)
    if payload is None:
        return None

    sub = payload.get("sub")
    if sub is None:
        return None

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        return None
    return user


def get_refresh_token(request: Request) -> str:
    """Достаёт refresh_token из cookie. Райзит 401, если его нет.

    Используется только в POST /auth/refresh. Сам токен валидируется
    дальше в services.auth.refresh_tokens (через decode_refresh_token).
    """
    token = request.cookies.get("refresh_token")
    if not token:
        refresh_token_missing()
    return token


# ══════════════════════════════════════════
# Annotated-алиасы (сахар для роутов)
# ══════════════════════════════════════════

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
RefreshToken = Annotated[str, Depends(get_refresh_token)]