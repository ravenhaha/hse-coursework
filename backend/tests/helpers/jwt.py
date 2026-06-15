"""Хелперы для тестов JWT: ручная сборка токенов с нужными claims.

Нужны там, где обычные create_*_token не подходят — например, чтобы
получить заведомо просроченный токен или токен, подписанный чужим ключом
(для проверки реакции декодера на невалидную подпись).
"""

from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings


def make_token(
    *,
    user_id: int = 1,
    token_type: str = "access",
    expires_delta: timedelta = timedelta(minutes=15),
    secret: str | None = None,
    algorithm: str | None = None,
) -> str:
    """Собирает JWT с произвольными параметрами (для крайних случаев)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(
        payload,
        secret or settings.SECRET_KEY,
        algorithm=algorithm or settings.ALGORITHM,
    )


def make_expired_token(*, user_id: int = 1, token_type: str = "access") -> str:
    """Токен с истёкшим сроком (exp в прошлом) — для проверки протухания."""
    return make_token(
        user_id=user_id,
        token_type=token_type,
        expires_delta=timedelta(minutes=-5),
    )


def make_token_with_wrong_signature(
    *, user_id: int = 1, token_type: str = "access",
) -> str:
    """Валидный по структуре токен, но подписанный ЧУЖИМ секретом."""
    return make_token(
        user_id=user_id,
        token_type=token_type,
        secret=settings.SECRET_KEY + "_tampered",
    )
