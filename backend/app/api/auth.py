"""Auth-роуты: регистрация, логин, refresh, logout, OAuth (VK / Yandex).

Контракт:
    - POST /register             → создаёт юзера + ставит cookies (автологин).
    - POST /login                → ставит cookies.
    - POST /refresh              → перевыпускает пару токенов.
    - POST /logout               → чистит cookies.
    - GET  /{vk|yandex}          → редирект на провайдера + ставит state-cookie.
    - GET  /{vk|yandex}/callback → проверяет state, обменивает code, ставит cookies.

Cookies:
    - access_token  (httponly, path=/)            — JWT для защищённых эндпоинтов.
    - refresh_token (httponly, path=/api/auth)    — узкий path: не утекает на
      каждый запрос, ходит только на refresh / logout.
    - csrf_token    (не-httponly, path=/)         — фронт читает и шлёт
      в заголовке X-CSRF-Token (double-submit, см. core/csrf.py).
      TTL = TTL refresh-токена, чтобы не протух раньше сессии и не
      ломать UX «вернулся через час → первый запрос упал с 403».
    - oauth_state   (httponly, path=/api/auth,    — короткоживущая, для защиты
                     max_age=600)                   OAuth-flow от Login CSRF.

Rate limiting:
    На register / login / refresh навешан slowapi-лимит по IP — защита от
    брутфорса паролей и перебора. Лимитер берётся из core/limiter.py
    (вынесен в отдельный модуль, чтобы не было циклического импорта с main).
"""

import secrets
from typing import Annotated, Final

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse, Response

from app.core.config import settings
from app.core.csrf import CSRF_COOKIE_NAME
from app.core.dependencies import (
    ACCESS_COOKIE_NAME,
    DB,
    REFRESH_COOKIE_NAME,
    RefreshToken,
)
from app.core.limiter import limiter
from app.core.security import generate_csrf_token
from app.models.user import User
from app.schemas.user import UserLogin, UserRegister, UserResponse
from app.services.auth import (
    build_vk_authorize_url,
    build_yandex_authorize_url,
    login_user,
    oauth_vk_login,
    oauth_yandex_login,
    refresh_tokens,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ─────────────────────────────────────────────────────────────────────────────
# Константы модуля
# ─────────────────────────────────────────────────────────────────────────────

OAUTH_STATE_COOKIE_NAME: Final[str] = "oauth_state"
"""Cookie с криптослучайным state-токеном для защиты OAuth-flow от Login CSRF.
Ставится на /auth/{provider}, проверяется на /auth/{provider}/callback."""

OAUTH_STATE_MAX_AGE: Final[int] = 600  # 10 минут: пользователю хватит дойти до VK/Я.

OAUTH_STATE_BYTES: Final[int] = 32     # 256 бит энтропии — больше чем нужно.


# ─────────────────────────────────────────────────────────────────────────────
# Cookie helpers
# ─────────────────────────────────────────────────────────────────────────────

def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    """Ставит тройку cookies: access / refresh / csrf.

    Все параметры безопасности (secure, samesite, max_age) берутся из settings —
    в dev там одно, в prod другое (см. core/config.py).

    CSRF-cookie живёт столько же, сколько refresh-токен — это спасает от
    сценария: «юзер закрыл вкладку на 30 минут → вернулся → access протух,
    но refresh жив → первый же мутирующий запрос падает с 403, потому что
    CSRF тоже протух раньше времени». Сам по себе CSRF-токен без access-cookie
    бесполезен, так что увеличивать его TTL безопасно.
    """
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        max_age=settings.ACCESS_COOKIE_MAX_AGE,
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
        max_age=settings.REFRESH_COOKIE_MAX_AGE,
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=generate_csrf_token(),
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        max_age=settings.REFRESH_COOKIE_MAX_AGE,
    )


def clear_auth_cookies(response: Response) -> None:
    """Удаляет все auth-cookies.

    Публичный хелпер — переиспользуется в users.delete_me.
    Также чистим oauth_state на случай, если юзер начал OAuth-flow,
    но не дошёл до callback и решил выйти.
    """
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")
    response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)


def _auth_response(
    message: str,
    user: User,
    access_token: str,
    refresh_token: str,
    status_code: int = 200,
) -> JSONResponse:
    """Стандартный JSON-ответ с auth-cookies: сообщение + сериализованный юзер."""
    response = JSONResponse(
        status_code=status_code,
        content={
            "message": message,
            "user": UserResponse.model_validate(user).model_dump(mode="json"),
        },
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return response


def _oauth_redirect_response(
    access_token: str,
    refresh_token: str,
) -> RedirectResponse:
    """Редирект на фронт после успешного OAuth + auth-cookies.

    Также удаляет одноразовую oauth_state-cookie — она больше не нужна.
    """
    response = RedirectResponse(
        url=f"{settings.FRONTEND_URL}/workspace",
        status_code=302,
    )
    _set_auth_cookies(response, access_token, refresh_token)
    response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
    return response


def _set_oauth_state_cookie(response: Response, state: str) -> None:
    """Кладёт short-lived state-cookie для проверки в callback."""
    response.set_cookie(
        key=OAUTH_STATE_COOKIE_NAME,
        value=state,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path=settings.REFRESH_COOKIE_PATH,
        max_age=OAUTH_STATE_MAX_AGE,
    )


def _verify_oauth_state(request: Request, state_from_query: str) -> None:
    """Сверяет state из query с cookie. Райзит 403 при несовпадении.

    Защита от OAuth Login CSRF: без state атакующий мог бы подсунуть жертве
    ссылку на callback с кодом своего аккаунта и залогинить её в чужой профиль
    (OAuth 2.0 Security BCP, раздел 4.7).

    Сравнение через secrets.compare_digest — защита от timing-атак.
    """
    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
    if (
        not cookie_state
        or not state_from_query
        or not secrets.compare_digest(cookie_state, state_from_query)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OAuth state mismatch — possible CSRF attempt",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Регистрация / Логин / Refresh / Logout
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
@limiter.limit("3/minute")
async def register(
    request: Request,
    data: UserRegister,
    db: DB,
) -> JSONResponse:
    """Регистрация + автологин.

    В отличие от классической схемы «зарегистрировался → залогинься заново»,
    мы сразу выдаём cookies. UX лучше, а безопасность не страдает: юзер
    только что в этом же запросе подтвердил, что знает пароль.

    Лимит 3/минуту с одного IP — чтобы нельзя было массово создавать аккаунты.
    Параметр request обязателен для slowapi (по нему берётся IP клиента).
    """
    user, access_token, refresh_token = await register_user(db, data)
    return _auth_response(
        "Регистрация успешна",
        user,
        access_token,
        refresh_token,
        status_code=201,
    )


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: UserLogin,
    db: DB,
) -> JSONResponse:
    """Логин по email+паролю → ставит cookies.

    Лимит 5/минуту с одного IP — защита от перебора пароля (брутфорса).
    Параметр request обязателен для slowapi.
    """
    user, access_token, refresh_token = await login_user(db, data)
    return _auth_response("Успешный вход", user, access_token, refresh_token)


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    db: DB,
    token: RefreshToken,
) -> JSONResponse:
    """Перевыпуск пары токенов по валидному refresh-cookie.

    Возвращает только сообщение — обновлённый юзер фронту тут не нужен;
    если нужен → дёрнет GET /users/me.

    Лимит 10/минуту — refresh дёргается чаще логина (по истечении access),
    но всё равно не должен спамиться. Параметр request обязателен для slowapi.
    """
    _user, access_token, new_refresh = await refresh_tokens(db, token)
    response = JSONResponse(content={"message": "Токен обновлён"})
    _set_auth_cookies(response, access_token, new_refresh)
    return response


@router.post("/logout")
async def logout() -> JSONResponse:
    """Чистит cookies. Stateless — сами JWT не отзываем (на это будет blacklist в будущем)."""
    response = JSONResponse(content={"message": "Вы вышли из системы"})
    clear_auth_cookies(response)
    return response


# ─────────────────────────────────────────────────────────────────────────────
# OAuth: VK
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/vk")
async def vk_redirect() -> RedirectResponse:
    """Редирект на страницу авторизации VK + установка state-cookie.

    state — криптослучайная строка, которую мы потом потребуем обратно
    в callback. Защита от OAuth Login CSRF.
    """
    state = secrets.token_urlsafe(OAUTH_STATE_BYTES)
    response = RedirectResponse(url=build_vk_authorize_url(state))
    _set_oauth_state_cookie(response, state)
    return response


@router.get("/vk/callback")
async def vk_callback(
    request: Request,
    db: DB,
    code: Annotated[str, Query()],
    state: Annotated[str, Query()],
) -> RedirectResponse:
    """Callback от VK: проверяет state, обменивает code на токены, ставит cookies."""
    _verify_oauth_state(request, state)
    _user, access_token, refresh_token = await oauth_vk_login(db, code)
    return _oauth_redirect_response(access_token, refresh_token)


# ─────────────────────────────────────────────────────────────────────────────
# OAuth: Yandex
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/yandex")
async def yandex_redirect() -> RedirectResponse:
    """Редирект на страницу авторизации Яндекс + установка state-cookie."""
    state = secrets.token_urlsafe(OAUTH_STATE_BYTES)
    response = RedirectResponse(url=build_yandex_authorize_url(state))
    _set_oauth_state_cookie(response, state)
    return response


@router.get("/yandex/callback")
async def yandex_callback(
    request: Request,
    db: DB,
    code: Annotated[str, Query()],
    state: Annotated[str, Query()],
) -> RedirectResponse:
    """Callback от Яндекса: проверяет state, обменивает code на токены, ставит cookies."""
    _verify_oauth_state(request, state)
    _user, access_token, refresh_token = await oauth_yandex_login(db, code)
    return _oauth_redirect_response(access_token, refresh_token)
