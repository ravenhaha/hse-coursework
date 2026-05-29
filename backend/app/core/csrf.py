"""CSRF-защита через double-submit cookie pattern.

Как работает:
    1. На auth-эндпоинтах сервер кладёт `csrf_token` в cookie (не-httponly).
    2. Фронт читает cookie через JS и шлёт значение в заголовке `X-CSRF-Token`
       на каждый mutating-запрос (POST/PUT/PATCH/DELETE).
    3. Эта dependency сверяет cookie и заголовок: если не совпали → 403.

Почему это работает:
    - XSS-злоумышленник в чужом домене НЕ может прочитать cookie жертвы
      (Same-Origin Policy), а значит не может подделать заголовок.
    - Атакующий через CSRF-форму на чужом сайте может отправить cookie
      (браузер сам приклеит), НО не может выставить заголовок
      `X-CSRF-Token` — кросс-доменные заголовки требуют CORS-preflight.

Управляется флагом `settings.CSRF_ENABLED`:
    - В dev обычно False — проще тестировать через curl/Postman.
    - В prod ОБЯЗАТЕЛЬНО True.

Включается глобально на API-роутер в main.py:
    app.include_router(api_router, dependencies=[Depends(verify_csrf)])
"""

import secrets
from typing import Final

from fastapi import HTTPException, Request, status

from app.core.config import settings


# ─────────────────────────────────────────────────────────────────────────────
# Публичные константы (используются также в auth-эндпоинтах при выдаче cookie)
# ─────────────────────────────────────────────────────────────────────────────

CSRF_COOKIE_NAME: Final[str] = "csrf_token"
"""Имя cookie с CSRF-токеном. Cookie НЕ HttpOnly — JS должен её читать
для double-submit. Должно совпадать с тем, что выставляется в /auth/login."""

CSRF_HEADER_NAME: Final[str] = "X-CSRF-Token"
"""Имя заголовка, в котором фронт дублирует значение cookie на каждом
mutating-запросе. Кросс-доменно выставить такой заголовок без CORS-preflight
невозможно — на этом и держится защита."""


# ─────────────────────────────────────────────────────────────────────────────
# Внутренние whitelists
# ─────────────────────────────────────────────────────────────────────────────

# Safe-методы по RFC 7231: не должны менять состояние сервера, проверка не нужна.
_SAFE_METHODS: Final[frozenset[str]] = frozenset({"GET", "HEAD", "OPTIONS"})

# Эндпоинты, на которых cookie с CSRF ещё не выдан (или сценарий не подразумевает
# наличия активной сессии): требовать токен на них бессмысленно.
_EXEMPT_PATHS: Final[frozenset[str]] = frozenset({
    f"{settings.API_PREFIX}/auth/register",
    f"{settings.API_PREFIX}/auth/login",
    f"{settings.API_PREFIX}/auth/refresh",
    f"{settings.API_PREFIX}/auth/logout",
})

# OAuth-flow приходит редиректом со стороннего домена — у браузера ещё нет
# нашей cookie, проверять нечего. Сверяем по префиксу, т.к. эндпоинтов несколько
# (initiate, callback и т.п.).
_EXEMPT_PREFIXES: Final[tuple[str, ...]] = (
    f"{settings.API_PREFIX}/auth/vk",
    f"{settings.API_PREFIX}/auth/yandex",
)


# ─────────────────────────────────────────────────────────────────────────────
# Dependency
# ─────────────────────────────────────────────────────────────────────────────

async def verify_csrf(request: Request) -> None:
    """Проверяет CSRF-токен на mutating-запросах.

    Логика (с ранними return, чтобы не уходить в глубокую вложенность):
        1. Если CSRF выключен глобально → пропускаем.
        2. Если метод safe (GET/HEAD/OPTIONS) → пропускаем.
        3. Если путь в списке исключений → пропускаем.
        4. Иначе требуем совпадения cookie и заголовка.

    Сравнение токенов выполняется через `secrets.compare_digest` — это
    защищает от timing-атак (обычный `==` для строк прерывается на первом
    несовпадении и теоретически утекает позицию различия по таймингу).

    Raises:
        HTTPException 403 — токен отсутствует или не совпал.
    """
    if not settings.CSRF_ENABLED:
        return

    if request.method in _SAFE_METHODS:
        return

    path = request.url.path
    if path in _EXEMPT_PATHS:
        return
    if any(path.startswith(p) for p in _EXEMPT_PREFIXES):
        return

    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)

    if (
        not cookie_token
        or not header_token
        or not secrets.compare_digest(cookie_token, header_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        )