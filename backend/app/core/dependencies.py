"""FastAPI-зависимости приложения.

Здесь собраны переиспользуемые `Depends(...)`-функции:
- получение текущего пользователя из cookie + JWT;
- получение опционального пользователя (для эндпоинтов, где auth не обязателен);
- извлечение refresh-токена для эндпоинта /auth/refresh;
- Annotated-алиасы для краткости в роутах.

Логика типов токенов:
    - access-токен  → защищённые ручки (CurrentUser);
    - refresh-токен → только POST /auth/refresh (RefreshToken).
    Подмена одного другим блокируется на уровне decode_*_token —
    эти функции отказывают, если claim `type` не совпал.

CSRF-защита здесь НЕ проверяется намеренно: за неё отвечает отдельная
dependency `verify_csrf` из app.core.csrf, подключённая глобально к API-роутеру.
Аутентификация (кто ты) и CSRF (откуда пришёл запрос) — разные слои,
смешивать их в одной зависимости — антипаттерн.
"""

from typing import Annotated, Final

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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


# ─────────────────────────────────────────────────────────────────────────────
# Имена cookie (используются также в auth-эндпоинтах при выдаче токенов)
# ─────────────────────────────────────────────────────────────────────────────

ACCESS_COOKIE_NAME: Final[str] = "access_token"
REFRESH_COOKIE_NAME: Final[str] = "refresh_token"


# ─────────────────────────────────────────────────────────────────────────────
# Внутренние хелперы (не для импорта снаружи)
# ─────────────────────────────────────────────────────────────────────────────

def _extract_access_token(request: Request) -> str:
    """Достаёт access_token из cookie. Райзит 401, если его нет."""
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        token_missing()
    return token


def _user_id_from_access_token(token: str) -> int:
    """Декодирует access-токен и возвращает user_id.

    Райзит 401 при любых проблемах:
        - невалидная подпись / истёк срок;
        - тип токена != "access" (например, прислали refresh);
        - отсутствует или нечисловой sub.

    Финальный `raise AssertionError` — defensive coding: формально
    после token_invalid() поток не должен сюда дойти (она NoReturn),
    но если когда-нибудь её поведение изменят — лучше упасть с явной
    ошибкой, чем тихо вернуть None и получить баг ниже по стеку.
    """
    payload = decode_access_token(token)
    if payload is None:
        token_invalid()

    sub = payload.get("sub") if payload else None
    if sub is None:
        token_invalid()

    try:
        return int(sub)
    except (TypeError, ValueError):
        token_invalid()
    
    raise AssertionError("unreachable: token_invalid() must raise")


async def _load_active_user(db: AsyncSession, user_id: int) -> User:
    """Берёт пользователя из БД и проверяет, что он активен.

    Разделяем 404 (нет такого) и 403 (есть, но заблокирован) —
    это помогает фронту корректно показать сообщение. User enumeration
    здесь не возникает: user_id берётся из подписанного JWT, который мы
    сами выдали → перебирать произвольные id невозможно.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        user_not_found()
    if not user.is_active:
        user_inactive()

    return user


# ─────────────────────────────────────────────────────────────────────────────
# Публичные dependencies
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Главный гард: возвращает авторизованного пользователя или райзит 401/403/404.

    Порядок проверок:
        1. Наличие access_token в cookie    → 401, если нет.
        2. Валидность подписи, срока и типа → 401, если что-то не так.
        3. Существование юзера в БД         → 404, если нет.
        4. Активность юзера                 → 403, если заблокирован.

    CSRF здесь намеренно не проверяется — см. модульный docstring.
    """
    token = _extract_access_token(request)
    user_id = _user_id_from_access_token(token)
    return await _load_active_user(db, user_id)


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Возвращает текущего пользователя, либо None — если запрос анонимен
    или токен невалиден.

    Подходит для эндпоинтов, где контент разный для гостя и юзера.

    Реализована поверх get_current_user через перехват HTTPException:
    логика декодирования и загрузки не дублируется. Любая ошибка
    аутентификации (нет токена, истёк, юзер заблокирован, не найден)
    превращается в None.
    """
    if not request.cookies.get(ACCESS_COOKIE_NAME):
        return None
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


def get_refresh_token(request: Request) -> str:
    """Достаёт refresh_token из cookie. Райзит 401, если его нет.

    Используется только в POST /auth/refresh. Сам токен валидируется
    дальше в services.auth.refresh_tokens (через decode_refresh_token).
    """
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        refresh_token_missing()
    return token


# ─────────────────────────────────────────────────────────────────────────────
# Annotated-алиасы (сахар для роутов)
# ─────────────────────────────────────────────────────────────────────────────

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
RefreshToken = Annotated[str, Depends(get_refresh_token)]