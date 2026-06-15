"""Схемы пользователей: регистрация, логин, профиль.

Принципы:
    - Поле avatar_url наружу (в API) — это публичный URL для фронта.
    - В БД оно живёт как avatar_path (относительный путь).
      Маппинг делается на уровне сервиса/роута (см. UserResponse).
    - Валидация пароля синхронизирована с фронтом (см. validators).
"""

import re

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_validator,
)

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
DISPLAY_NAME_MAX_LENGTH = 100

_RE_LETTER = re.compile(r"[A-Za-zА-Яа-яЁё]")
_RE_DIGIT = re.compile(r"\d")


def validate_password_strength(password: str) -> str:
    """Проверка надёжности пароля.

    Правила:
        - длина 8..128 символов;
        - хотя бы одна буква (lat/cyr);
        - хотя бы одна цифра;
        - запрет NUL-байтов (защита от обрезания строки в bcrypt-совместимых
          хешерах при будущей миграции; argon2 NUL обрабатывает корректно).

    Дублирующие правила должны быть на фронте — иначе UX плохой.
    """
    if not (PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH):
        raise ValueError(
            f"Пароль должен быть от {PASSWORD_MIN_LENGTH} до {PASSWORD_MAX_LENGTH} символов"
        )
    if "\x00" in password:
        raise ValueError("Пароль содержит недопустимые символы")
    if not _RE_LETTER.search(password):
        raise ValueError("Пароль должен содержать хотя бы одну букву")
    if not _RE_DIGIT.search(password):
        raise ValueError("Пароль должен содержать хотя бы одну цифру")
    return password


# ─────────────────────────────────────────────────────────────────────────────
# Запросы
# ─────────────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    model_config = ConfigDict(extra="forbid")

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.strip().lower()  # 🆕

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        return validate_password_strength(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(extra="forbid")

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserUpdate(BaseModel):
    """Тело PATCH /users/me.

    Пока редактируется только display_name. В будущем сюда же придут смена
    пароля / email — но через отдельные endpoint'ы с подтверждением.
    """

    display_name: str | None = Field(
        None, min_length=1, max_length=DISPLAY_NAME_MAX_LENGTH
    )

    model_config = ConfigDict(extra="forbid")

    @field_validator("display_name")
    @classmethod
    def _strip_and_validate(cls, v: str | None) -> str | None:
        """Trim + запрет управляющих символов.

        Запрет на \\n, \\t, \\r и т.п. защищает от:
            - инъекции переносов в UI (ломает вёрстку);
            - homoglyph-подобных атак через zero-width-символы;
            - засорения логов.
        """
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Имя не может быть пустым")
        if any(c.isspace() and c != " " for c in v):
            raise ValueError("Имя не должно содержать переносы строк или табуляции")
        if any(ord(c) < 0x20 or ord(c) == 0x7f for c in v):
            raise ValueError("Имя содержит недопустимые управляющие символы")
        return v


# ─────────────────────────────────────────────────────────────────────────────
# Ответы
# ─────────────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Профиль пользователя в ответах API.

    ВАЖНО: НЕТ password_hash и других чувствительных полей.

    avatar_path хранится в БД как ОТНОСИТЕЛЬНЫЙ путь от UPLOADS_DIR,
    например 'avatars/42/abc123.png'. Наружу отдаём avatar_url —
    АБСОЛЮТНЫЙ публичный URL для фронта, собирается как:
        {BACKEND_URL}/uploads/{avatar_path}

    Почему абсолютный, а не относительный:
        Фронт (Vite на :5173) и бэкенд (FastAPI на :8000) живут на разных
        origin'ах. Относительный '/uploads/...' браузер прицепит к origin
        ТЕКУЩЕЙ страницы (5173), где никакого /uploads нет → 404 → битая
        картинка. С абсолютным URL браузер пойдёт сразу на бэкенд.

    Если переедем на CDN/S3 — поменяется только тело @computed_field.
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
        if not self.avatar_path:
            return None
        from app.core.config import settings
        return f"{settings.BACKEND_URL}/uploads/{self.avatar_path}"
