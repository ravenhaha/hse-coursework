"""Схемы пользователей: регистрация, логин, профиль.

Принципы:
    - Поле avatar_url наружу (в API) — это публичный URL для фронта.
    - В БД оно живёт как avatar_path (относительный путь).
      Маппинг делается на уровне сервиса/роута (см. UserResponse).
    - Валидация пароля синхронизирована с фронтом (см. validators).
"""

import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
_RE_LETTER = re.compile(r"[A-Za-zА-Яа-яЁё]")
_RE_DIGIT = re.compile(r"\d")


def validate_password_strength(password: str) -> str:
    """Проверка надёжности пароля.

    Правила:
        - длина 8..128 символов;
        - хотя бы одна буква (lat/cyr);
        - хотя бы одна цифра.

    Дублирующие правила должны быть на фронте — иначе UX плохой.
    """
    if not (PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH):
        raise ValueError(
            f"Пароль должен быть от {PASSWORD_MIN_LENGTH} до {PASSWORD_MAX_LENGTH} символов"
        )
    if not _RE_LETTER.search(password):
        raise ValueError("Пароль должен содержать хотя бы одну букву")
    if not _RE_DIGIT.search(password):
        raise ValueError("Пароль должен содержать хотя бы одну цифру")
    return password


# ══════════════════════════════════════════
# Запросы
# ══════════════════════════════════════════
class UserRegister(BaseModel):
    """Тело POST /auth/register."""

    email: EmailStr
    password: str = Field(
        ...,
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
    )

    model_config = ConfigDict(extra="forbid")

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        return validate_password_strength(v)


class UserLogin(BaseModel):
    """Тело POST /auth/login.

    Пароль НЕ валидируем по сложности: старые юзеры со слабыми паролями
    (если правила сложности менялись) всё ещё должны иметь возможность
    войти и сменить пароль.
    """

    email: EmailStr
    password: str

    model_config = ConfigDict(extra="forbid")


class UserUpdate(BaseModel):
    """Тело PATCH /users/me.

    Пока редактируется только display_name. В будущем сюда же
    придут смена пароля / email — но через отдельные endpoint'ы
    с подтверждением.
    """

    display_name: str | None = Field(None, min_length=1, max_length=100)

    model_config = ConfigDict(extra="forbid")

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Имя не может быть пустым")
        return v


# ══════════════════════════════════════════
# Ответы
# ══════════════════════════════════════════
class UserResponse(BaseModel):
    """Профиль пользователя в ответах API.

    ВАЖНО: НЕТ password_hash и других чувствительных полей.
    avatar_url — публичный URL для фронта, собирается из avatar_path
    через @computed_field. Сейчас avatar_path в БД уже хранит полный
    публичный путь ("/uploads/avatars/x.png"), поэтому avatar_url
    идентичен ему. Если переедем на CDN — поменяется только тело
    @computed_field, остальной код не затронется.
    """

    id: int
    email: EmailStr
    display_name: str | None = None
    is_active: bool

    avatar_path: str | None = Field(default=None, exclude=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def avatar_url(self) -> str | None:
        """Публичный URL аватара. None = фронт показывает placeholder."""
        return self.avatar_path