"""Безопасность: хеширование паролей (Argon2) и работа с JWT-токенами."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import settings


TokenType = Literal["access", "refresh"]

# Один экземпляр на всё приложение — он thread-safe.
_password_hasher = PasswordHasher()


# ══════════════════════════════════════════
# Пароли
# ══════════════════════════════════════════

def hash_password(password: str) -> str:
    """Хеширует пароль через Argon2id (рекомендованный стандарт OWASP)."""
    return _password_hasher.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Сверяет пароль с хешем. Возвращает True/False, исключения не пробрасывает.

    Ловим все ожидаемые ошибки argon2:
        - VerifyMismatchError — пароль не совпал;
        - VerificationError   — общая ошибка верификации;
        - InvalidHashError    — мусор в БД вместо хеша.
    """
    try:
        return _password_hasher.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:
    """True, если хеш устарел (изменились параметры Argon2) — стоит пере-хешировать
    при следующем успешном логине."""
    try:
        return _password_hasher.check_needs_rehash(hashed)
    except Exception:
        return False


# ══════════════════════════════════════════
# JWT — создание
# ══════════════════════════════════════════

def _create_token(user_id: int, token_type: TokenType, expires_delta: timedelta) -> str:
    """Внутренний помощник: собирает payload и кодирует JWT.
    Используется create_access_token / create_refresh_token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,                          # issued at — когда выдан
        "exp": now + expires_delta,          # expires — когда протухнет
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    """Короткоживущий токен для авторизации API-запросов."""
    return _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    """Долгоживущий токен для обновления пары токенов."""
    return _create_token(
        user_id,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


# ══════════════════════════════════════════
# JWT — декодирование
# ══════════════════════════════════════════

def decode_token(token: str) -> dict | None:
    """Декодирует JWT БЕЗ проверки типа. Возвращает payload или None.

    Используется как низкоуровневая функция. В прикладном коде
    предпочитай decode_access_token / decode_refresh_token —
    они дополнительно проверяют поле `type` и закрывают дыру
    «использую access вместо refresh» (и наоборот).
    """
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.PyJWTError:
        # PyJWTError — корневой класс всех ошибок jwt:
        # ExpiredSignature, InvalidToken, InvalidSignature и т.д.
        return None


def _decode_token_of_type(token: str, expected_type: TokenType) -> dict | None:
    """Декодирует JWT и проверяет, что поле `type` совпадает с ожидаемым.

    Возвращает payload или None, если:
        - подпись/срок невалидны;
        - тип токена не совпал (прислали access вместо refresh, например).
    """
    payload = decode_token(token)
    if not payload:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload


def decode_access_token(token: str) -> dict | None:
    """Декодирует именно access-токен.

    Используется в dependency-проверке текущего юзера (CurrentUser).
    Refresh-токен через эту функцию НЕ пройдёт — это намеренно.
    """
    return _decode_token_of_type(token, "access")


def decode_refresh_token(token: str) -> dict | None:
    """Декодирует именно refresh-токен.

    Используется в POST /auth/refresh. Access-токен через эту функцию
    НЕ пройдёт — это закрывает класс атак «использую долгоживущий
    access вместо refresh».
    """
    return _decode_token_of_type(token, "refresh")


# ══════════════════════════════════════════
# CSRF
# ══════════════════════════════════════════

def generate_csrf_token() -> str:
    """Генерирует криптостойкий CSRF-токен (256 бит)."""
    return secrets.token_hex(32)