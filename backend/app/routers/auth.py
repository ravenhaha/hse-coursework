from fastapi import APIRouter, Depends, Response, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.session import get_db
from schemas.user import UserRegister, UserLogin, UserResponse
from models.user import User
from core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from core.config import settings
from core.exceptions import (
    email_taken,
    username_taken,
    invalid_credentials,
    token_missing,
    token_invalid,
    refresh_token_missing,
    user_not_found,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# === Регистрация ===
@router.post("/register", response_model=UserResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        email_taken()

    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        username_taken()

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        display_name=data.display_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# === Вход ===
@router.post("/login")
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        invalid_credentials()

    if not verify_password(data.password, user.hashed_password):
        invalid_credentials()

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    response = JSONResponse(content={
        "message": "Успешный вход",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
        }
    })

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return response


# === Обновление токена ===
@router.post("/refresh")
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")

    if not token:
        refresh_token_missing()

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        token_invalid()

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        user_not_found()

    access_token = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)

    response = JSONResponse(content={"message": "Токен обновлён"})

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return response


# === Выход ===
@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "Вы вышли из системы"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response


# === Текущий пользователь ===
@router.get("/me", response_model=UserResponse)
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    
    token = request.cookies.get("access_token")

    if not token:
        token_missing()

    payload = decode_token(token)

    if not payload:
        token_invalid()

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        user_not_found()

    return user