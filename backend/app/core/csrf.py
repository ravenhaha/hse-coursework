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

from fastapi import HTTPException, Request, status

from app.core.config import settings

_SAFE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})

_EXEMPT_PATHS: frozenset[str] = frozenset({
    f"{settings.API_PREFIX}/auth/register",
    f"{settings.API_PREFIX}/auth/login",
    f"{settings.API_PREFIX}/auth/refresh",
    f"{settings.API_PREFIX}/auth/logout",
})

_EXEMPT_PREFIXES: tuple[str, ...] = (
    f"{settings.API_PREFIX}/auth/vk",
    f"{settings.API_PREFIX}/auth/yandex",
)


async def verify_csrf(request: Request) -> None:
    """Проверяет CSRF-токен на mutating-запросах.

    Логика:
        1. Если CSRF выключен глобально → пропускаем.
        2. Если метод safe (GET/HEAD/OPTIONS) → пропускаем.
        3. Если путь в списке исключений → пропускаем.
        4. Иначе требуем совпадения cookie `csrf_token` и заголовка `X-CSRF-Token`.

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

    cookie_token = request.cookies.get("csrf_token")
    header_token = request.headers.get("X-CSRF-Token")

    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing or invalid",
        )