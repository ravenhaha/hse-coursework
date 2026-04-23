from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from schemas.user import UserRegister, UserLogin, UserResponse
from db.session import get_db
from models.user import User
from services.auth import (
    register_user,
    authenticate_user,
    refresh_tokens,
    oauth_vk_login,
    oauth_yandex_login,
)
from core.dependencies import get_current_user
from core.config import settings
from core.security import generate_csrf_token

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_auth_cookies(
    response: JSONResponse,
    access_token: str,
    refresh_token: str,
) -> None:
    """Ставим все куки с явными path — никаких проблем localhost vs 127.0.0.1."""

    # access_token — httpOnly, доступен всему API
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,   # False на localhost, True в проде
        samesite="lax",
        path="/",                         # ← доступен ВСЕМ эндпоинтам
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    # refresh_token — httpOnly, только для /api/auth
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/api/auth",                 # ← только auth-эндпоинты
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    # CSRF — НЕ httpOnly (фронт читает и шлёт в заголовке)
    csrf = generate_csrf_token()
    response.set_cookie(
        key="csrf_token",
        value=csrf,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",                         # ← доступен фронту
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def _auth_response(
    message: str,
    user: User,
    access_token: str,
    refresh_token: str,
) -> JSONResponse:
    user_data = UserResponse.model_validate(user).model_dump()
    response = JSONResponse(content={
        "message": message,
        "user": user_data,
    })
    _set_auth_cookies(response, access_token, refresh_token)
    return response


# ─── Регистрация ───
@router.post("/register", response_model=UserResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    user = await register_user(db, email=data.email, password=data.password)
    return user


# ─── Вход ───
@router.post("/login")
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user, access_token, refresh_token = await authenticate_user(
        db, data.email, data.password,
    )
    return _auth_response("Успешный вход", user, access_token, refresh_token)


# ─── Обновление токена ───
@router.post("/refresh")
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    access_token, new_refresh = await refresh_tokens(db, token)

    response = JSONResponse(content={"message": "Токен обновлён"})
    _set_auth_cookies(response, access_token, new_refresh)
    return response


# ─── Выход ───
@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "Вы вышли из системы"})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")
    response.delete_cookie("csrf_token", path="/")
    return response


# ─── Текущий пользователь ───
@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


# ─── VK OAuth ───
@router.get("/vk")
async def vk_redirect():
    url = (
        f"https://oauth.vk.com/authorize"
        f"?client_id={settings.VK_CLIENT_ID}"
        f"&redirect_uri={settings.VK_REDIRECT_URI}"
        f"&display=popup"
        f"&response_type=code"
    )
    return RedirectResponse(url)


@router.get("/vk/callback")
async def vk_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    user, access_token, refresh_token = await oauth_vk_login(db, code)
    return _auth_response("Успешный вход через VK", user, access_token, refresh_token)


# ─── Yandex OAuth ───
@router.get("/yandex")
async def yandex_redirect():
    url = (
        f"https://oauth.yandex.ru/authorize"
        f"?client_id={settings.YANDEX_CLIENT_ID}"
        f"&redirect_uri={settings.YANDEX_REDIRECT_URI}"
        f"&response_type=code"
    )
    return RedirectResponse(url)


@router.get("/yandex/callback")
async def yandex_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    user, access_token, refresh_token = await oauth_yandex_login(db, code)
    return _auth_response("Успешный вход через Yandex", user, access_token, refresh_token)