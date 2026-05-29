"""Безопасность: хеширование паролей (Argon2) и работа с JWT-токенами.

Этот модуль — единственная точка криптографии в приложении. Прикладной код
НЕ должен напрямую обращаться к argon2/jwt — только через функции отсюда.

Состав:
    • hash_password / verify_password / needs_rehash — пароли (Argon2id).
    • create_access_token / create_refresh_token    — выпуск JWT.
    • decode_access_token / decode_refresh_token    — валидация JWT с проверкой типа.
    • generate_csrf_token                            — CSRF-токен (см. csrf.py).

Принципы:
    1. Argon2id с параметрами выше OWASP-минимума (берутся из argon2-cffi по умолчанию).
    2. Раздельные функции декодирования для access/refresh — защита от подмены типа токена.
    3. Никаких сырых исключений наружу: ошибки криптографии превращаются в None/False,
       прикладной код работает с булевыми/Optional-результатами.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Final, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import settings


# ─────────────────────────────────────────────────────────────────────────────
# Типы и константы
# ─────────────────────────────────────────────────────────────────────────────

TokenType = Literal["access", "refresh"]
"""Допустимые типы JWT. Используется как claim `type` в payload, чтобы нельзя
было подсунуть access вместо refresh (и наоборот)."""

# Единственный инстанс PasswordHasher на весь процесс.
# Параметры по умолчанию (argon2-cffi 23.x):
#   time_cost=3, memory_cost=65536 KiB (64 MiB), parallelism=4, hash_len=32, salt_len=16.
# Это выше минимума OWASP (m≥19 MiB, t≥2, p≥1) — менять не нужно без причины.
_password_hasher: Final[PasswordHasher] = PasswordHasher()


# ─────────────────────────────────────────────────────────────────────────────
# Пароли (Argon2id)
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Хеширует пароль алгоритмом Argon2id.

    Argon2id выбран как победитель Password Hashing Competition и текущая
    рекомендация OWASP. Соль генерируется библиотекой автоматически (16 байт CSPRNG)
    и встраивается в итоговую строку — отдельно хранить её не нужно.

    Возвращает строку формата `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`.
    """
    return _password_hasher.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Проверяет соответствие пароля сохранённому хешу.

    Намеренно не пробрасывает исключения наружу: вызывающий код работает
    с булевым результатом. Любая ошибка верификации (несовпадение,
    повреждённый хеш, неподдерживаемый формат) трактуется как «не совпало».
    Это упрощает прикладную логику и закрывает классический баг «забыли
    обработать исключение → 500 вместо 401».

    Argon2id выполняет сравнение в постоянном времени — timing-атаки на
    сам процесс верификации невозможны.
    """
    try:
        return _password_hasher.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:
    """Сообщает, нужно ли пере-хешировать пароль при следующем успешном логине.

    Возвращает True, если хеш был создан с устаревшими параметрами Argon2
    (например, после планового апгрейда `memory_cost` в библиотеке или вручную).
    Это позволяет постепенно мигрировать на более стойкие параметры без массовой
    перезаписи БД — на каждом логине вызывающий код проверяет needs_rehash и,
    если True, перезаписывает users.password_hash свежим hash_password(plain).

    При повреждённом хеше возвращает False: формально он не «устарел», и
    верификация всё равно провалится — пользователь не залогинится, а
    перехеш потребовал бы валидного пароля в открытом виде.
    """
    try:
        return _password_hasher.check_needs_rehash(hashed)
    except InvalidHashError:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# JWT — выпуск токенов
# ─────────────────────────────────────────────────────────────────────────────

def _create_token(user_id: int, token_type: TokenType, expires_delta: timedelta) -> str:
    """Внутренний помощник: собирает payload и кодирует JWT.

    Payload содержит:
        • sub  — идентификатор пользователя (строкой, как требует RFC 7519);
        • type — "access" | "refresh", критично для защиты от подмены типа;
        • iat  — момент выпуска;
        • exp  — момент истечения.

    Подпись — HS256 общим секретом из settings.SECRET_KEY. Для одиночного
    backend-сервиса этого достаточно; если в будущем появятся независимые
    верификаторы (микросервисы), стоит мигрировать на RS256/EdDSA с парой
    ключей.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    """Выпускает короткоживущий access-токен для авторизации API-запросов.

    TTL задан в settings.ACCESS_TOKEN_EXPIRE_MINUTES (по умолчанию — минуты,
    не часы: компромисс между UX и окном эксплуатации при утечке).
    """
    return _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    """Выпускает долгоживущий refresh-токен для обновления пары токенов.

    TTL задан в settings.REFRESH_TOKEN_EXPIRE_DAYS. Refresh используется
    только эндпоинтом POST /auth/refresh — больше никем; это гарантируется
    проверкой claim `type` в decode_refresh_token.
    """
    return _create_token(
        user_id,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


# ─────────────────────────────────────────────────────────────────────────────
# JWT — декодирование
# ─────────────────────────────────────────────────────────────────────────────

def _decode_token(token: str) -> dict | None:
    """Низкоуровневый декодер: проверяет только подпись и срок жизни.

    НЕ для прикладного использования. Вызывающий код должен пользоваться
    decode_access_token / decode_refresh_token, которые дополнительно
    проверяют тип токена и тем самым закрывают атаку «подмена access/refresh».

    Возвращает payload (dict) при успехе или None при любой ошибке:
        • неверная подпись (InvalidSignatureError);
        • истёкший токен (ExpiredSignatureError);
        • повреждённая структура (DecodeError);
        • неподдерживаемый алгоритм и т.п.

    Все эти случаи нам функционально одинаковы — «токен невалиден» — поэтому
    схлопываем их в Optional, не различая причину.
    """
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.PyJWTError:
        return None


def _decode_token_of_type(token: str, expected_type: TokenType) -> dict | None:
    """Декодирует JWT и дополнительно проверяет соответствие claim `type`.

    Возвращает payload при успехе, None — если:
        • базовая валидация (подпись/срок/формат) провалилась;
        • поле `type` не совпало с ожидаемым.

    Именно эта проверка делает невозможным сценарий, когда злоумышленник
    подсовывает долгоживущий refresh туда, где ожидается access (или наоборот).
    """
    payload = _decode_token(token)
    if not payload:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload


def decode_access_token(token: str) -> dict | None:
    """Валидирует именно access-токен.

    Используется зависимостью получения текущего пользователя (см. dependencies.py).
    Refresh-токен через эту функцию НЕ пройдёт — это намеренно.
    """
    return _decode_token_of_type(token, "access")


def decode_refresh_token(token: str) -> dict | None:
    """Валидирует именно refresh-токен.

    Используется только эндпоинтом POST /auth/refresh. Access-токен через
    эту функцию НЕ пройдёт — это закрывает класс атак «использую долгоживущий
    access вместо refresh».
    """
    return _decode_token_of_type(token, "refresh")


# ─────────────────────────────────────────────────────────────────────────────
# CSRF
# ─────────────────────────────────────────────────────────────────────────────

def generate_csrf_token() -> str:
    """Генерирует криптостойкий CSRF-токен (256 бит энтропии).

    Используется в схеме double-submit cookie (детали — в csrf.py).
    `secrets.token_hex` опирается на системный CSPRNG (os.urandom).
    """
    return secrets.token_hex(32)