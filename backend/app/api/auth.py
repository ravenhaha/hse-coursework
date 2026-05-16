"""Auth-роуты: регистрация, логин, refresh, logout, OAuth (VK / Yandex).

Контракт:
    - POST /register  → создаёт юзера + ставит cookies (автологин).
    - POST /login     → ставит cookies.
    - POST /refresh   → перевыпускает пару токенов.
    - POST /logout    → чистит cookies.
    - GET  /{vk|yandex}            → редирект на провайдера.
    - GET  /{vk|yandex}/callback   → обрабатывает code и ставит cookies.

Cookies:
    - access_token  (httponly, path=/)
    - refresh_token (httponly, path=/api/auth) — узкий path,
      чтобы не утекать на каждый запрос.
    - csrf_token    (не-httponly, path=/) — фронт читает и шлёт
      в заголовке X-CSRF-Token.
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, RedirectResponse, Response

from app.core.config import settings
from app.core.dependencies import DB, RefreshToken
from app.core.security import generate_csrf_token
from app.models.user import User
from app.schemas.user import UserLogin, UserRegister, UserResponse
from app.services.auth import (
    login_user,
    oauth_vk_login,
    oauth_yandex_login,
    refresh_tokens,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ══════════════════════════════════════════
# Cookie helpers
# ══════════════════════════════════════════
REFRESH_COOKIE_PATH = settings.REFRESH_COOKIE_PATH


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    """Ставит тройку cookies: access / refresh / csrf.

    Все параметры (secure, samesite, max_age) берутся из settings —
    в dev там одно, в prod другое (см. core/config.py).
    """
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        max_age=settings.ACCESS_COOKIE_MAX_AGE,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path=REFRESH_COOKIE_PATH,
        max_age=settings.REFRESH_COOKIE_MAX_AGE,
    )
    response.set_cookie(
        key="csrf_token",
        value=generate_csrf_token(),
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
        max_age=settings.ACCESS_COOKIE_MAX_AGE,
    )


def clear_auth_cookies(response: Response) -> None:
    """Удаляет все auth-cookies. Публичный хелпер — переиспользуется в users.delete_me."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path=REFRESH_COOKIE_PATH)
    response.delete_cookie("csrf_token", path="/")


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
    """Редирект на фронт после успешного OAuth + cookies."""
    response = RedirectResponse(
        url=f"{settings.FRONTEND_URL}/workspace",
        status_code=302,
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return response


# ══════════════════════════════════════════
# Регистрация / Логин / Refresh / Logout
# ══════════════════════════════════════════

@router.post("/register", status_code=201)
async def register(data: UserRegister, db: DB):
    """Регистрация + автологин.

    В отличие от классической схемы «зарегистрировался → залогинься заново»,
    мы сразу выдаём cookies. UX лучше, а безопасность та же:
    юзер уже подтвердил, что знает пароль.
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
async def login(data: UserLogin, db: DB):
    """Логин по email+паролю → ставит cookies."""
    user, access_token, refresh_token = await login_user(db, data)
    return _auth_response("Успешный вход", user, access_token, refresh_token)


@router.post("/refresh")
async def refresh(db: DB, token: RefreshToken):
    """Перевыпуск пары токенов по валидному refresh-cookie.

    Возвращает только сообщение — фронту обновлённый юзер тут не нужен,
    если нужен → дёрнет GET /users/me.
    """
    user, access_token, new_refresh = await refresh_tokens(db, token)
    response = JSONResponse(content={"message": "Токен обновлён"})
    _set_auth_cookies(response, access_token, new_refresh)
    return response


@router.post("/logout")
async def logout():
    """Чистит cookies. Stateless — сами JWT не отзываем (на это будет blacklist в будущем)."""
    response = JSONResponse(content={"message": "Вы вышли из системы"})
    clear_auth_cookies(response)
    return response


# ══════════════════════════════════════════
# OAuth: VK
# ══════════════════════════════════════════

@router.get("/vk")
async def vk_redirect():
    """Редирект на страницу авторизации VK."""
    url = (
        "https://oauth.vk.com/authorize"
        f"?client_id={settings.VK_CLIENT_ID}"
        f"&redirect_uri={settings.VK_REDIRECT_URI}"
        "&display=popup"
        "&response_type=code"
    )
    return RedirectResponse(url)


@router.get("/vk/callback")
async def vk_callback(db: DB, code: str = Query(...)):
    """Callback от VK: обмениваем code на токены, логиним юзера, редиректим на фронт."""
    _user, access_token, refresh_token = await oauth_vk_login(db, code)
    return _oauth_redirect_response(access_token, refresh_token)


# ══════════════════════════════════════════
# OAuth: Yandex
# ══════════════════════════════════════════

@router.get("/yandex")
async def yandex_redirect():
    """Редирект на страницу авторизации Яндекс."""
    url = (
        "https://oauth.yandex.ru/authorize"
        f"?client_id={settings.YANDEX_CLIENT_ID}"
        f"&redirect_uri={settings.YANDEX_REDIRECT_URI}"
        "&response_type=code"
    )
    return RedirectResponse(url)


@router.get("/yandex/callback")
async def yandex_callback(db: DB, code: str = Query(...)):
    """Callback от Яндекса: обмениваем code на токены, логиним юзера, редиректим на фронт."""
    _user, access_token, refresh_token = await oauth_yandex_login(db, code)
    return _oauth_redirect_response(access_token, refresh_token)