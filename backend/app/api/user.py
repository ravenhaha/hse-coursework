"""Роуты профиля текущего пользователя: /me, аватар, удаление аккаунта."""

from fastapi import APIRouter, File, Response, UploadFile, status

from app.api.auth import clear_auth_cookies
from app.core.dependencies import CurrentUser, DB
from app.schemas.user import UserResponse, UserUpdate
from app.services.user import (
    delete_user_account,
    remove_user_avatar,
    update_user_avatar,
    update_user_profile,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(user: CurrentUser):
    """Профиль текущего юзера. Сборка avatar_url происходит в UserResponse."""
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(body: UserUpdate, db: DB, user: CurrentUser):
    """Частичное обновление профиля. Сейчас — только display_name."""
    return await update_user_profile(db, user, body)


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    db: DB,
    user: CurrentUser,
    file: UploadFile = File(...),
):
    """Загрузка/замена аватара. Старый файл удаляется автоматически."""
    return await update_user_avatar(db, user, file)


@router.delete("/me/avatar", response_model=UserResponse)
async def remove_avatar(db: DB, user: CurrentUser):
    """Сброс аватара (файл удаляется, в БД avatar_path = NULL)."""
    return await remove_user_avatar(db, user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(response: Response, db: DB, user: CurrentUser):
    """Безвозвратное удаление аккаунта со всеми данными.

    Что удаляется:
        - сам User;
        - все AuthAccount (email/vk/yandex);
        - все коллекции и материалы (с файлами на диске);
        - все теги и связи material↔tag;
        - файл аватара.

    После удаления сразу чистим cookies — чтобы фронт не пытался
    дёрнуть /users/me с протухшей сессией.
    """
    await delete_user_account(db, user)
    clear_auth_cookies(response)
    return None