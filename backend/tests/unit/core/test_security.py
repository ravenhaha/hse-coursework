"""Unit-тесты модуля криптографии (app/core/security.py).

Без БД и без сети. Покрывают:
    - хеширование паролей Argon2id (hash/verify/needs_rehash);
    - выпуск и round-trip JWT (create → decode);
    - защиту от подмены типа токена (access ↮ refresh);
    - устойчивость декодера к протухшим, битым и мусорным токенам.

Стиль соответствует tests/unit/services/test_auth.py:
    - группировка по классам TestX;
    - синхронные тесты (модуль security полностью синхронный).
"""

import jwt
import pytest

from app.core import security
from app.core.config import settings
from tests.helpers.jwt import (
    make_expired_token,
    make_token,
    make_token_with_wrong_signature,
)


# ═════════════════════════════════════════════════════════════
# Пароли (Argon2id)
# ═════════════════════════════════════════════════════════════
class TestPasswordHashing:
    def test_hash_differs_from_plain(self):
        hashed = security.hash_password("secret123")
        assert hashed != "secret123"
        assert hashed.startswith("$argon2id$")

    def test_verify_correct_password(self):
        hashed = security.hash_password("secret123")
        assert security.verify_password("secret123", hashed) is True

    def test_verify_wrong_password(self):
        hashed = security.hash_password("secret123")
        assert security.verify_password("wrong", hashed) is False

    def test_same_password_different_hashes(self):
        """Случайная соль → одинаковый пароль даёт разные хеши."""
        h1 = security.hash_password("secret123")
        h2 = security.hash_password("secret123")
        assert h1 != h2
        # но оба валидны
        assert security.verify_password("secret123", h1)
        assert security.verify_password("secret123", h2)

    def test_verify_garbage_hash_returns_false(self):
        """Битый хеш → False, без исключения наружу."""
        assert security.verify_password("secret123", "not-a-hash") is False

    def test_needs_rehash_false_for_fresh_hash(self):
        """Свежий хеш с текущими параметрами не требует перехеша."""
        hashed = security.hash_password("secret123")
        assert security.needs_rehash(hashed) is False

    def test_needs_rehash_garbage_returns_false(self):
        """Битый хеш → False (формально не «устарел»)."""
        assert security.needs_rehash("not-a-hash") is False


# ═════════════════════════════════════════════════════════════
# Выпуск и round-trip access-токена
# ═════════════════════════════════════════════════════════════
class TestAccessToken:
    def test_create_returns_string(self):
        token = security.create_access_token(42)
        assert isinstance(token, str) and token.count(".") == 2

    def test_roundtrip(self):
        token = security.create_access_token(42)
        payload = security.decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "42"        # sub — строка (RFC 7519)
        assert payload["type"] == "access"

    def test_sub_is_string(self):
        payload = security.decode_access_token(security.create_access_token(7))
        assert isinstance(payload["sub"], str)

    def test_has_iat_and_exp(self):
        payload = security.decode_access_token(security.create_access_token(1))
        assert "iat" in payload and "exp" in payload


# ═════════════════════════════════════════════════════════════
# Выпуск и round-trip refresh-токена
# ═════════════════════════════════════════════════════════════
class TestRefreshToken:
    def test_roundtrip(self):
        token = security.create_refresh_token(42)
        payload = security.decode_refresh_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["type"] == "refresh"


# ═════════════════════════════════════════════════════════════
# Защита от подмены типа токена
# ═════════════════════════════════════════════════════════════
class TestTokenTypeIsolation:
    def test_access_not_accepted_as_refresh(self):
        """access-токен НЕ должен проходить как refresh."""
        access = security.create_access_token(1)
        assert security.decode_refresh_token(access) is None

    def test_refresh_not_accepted_as_access(self):
        """refresh-токен НЕ должен проходить как access."""
        refresh = security.create_refresh_token(1)
        assert security.decode_access_token(refresh) is None


# ═════════════════════════════════════════════════════════════
# Устойчивость декодера к невалидным токенам
# ═════════════════════════════════════════════════════════════
class TestTokenRobustness:
    def test_expired_token_rejected(self):
        token = make_expired_token(token_type="access")
        assert security.decode_access_token(token) is None

    def test_expired_refresh_rejected(self):
        token = make_expired_token(token_type="refresh")
        assert security.decode_refresh_token(token) is None

    def test_wrong_signature_rejected(self):
        token = make_token_with_wrong_signature(token_type="access")
        assert security.decode_access_token(token) is None

    @pytest.mark.parametrize("garbage", [
        "",
        "not.a.token",
        "abc",
        "....",
    ])
    def test_garbage_rejected(self, garbage):
        assert security.decode_access_token(garbage) is None
        assert security.decode_refresh_token(garbage) is None

    def test_token_without_type_claim_rejected(self):
        """Токен без claim `type` не проходит типизированный декодер."""
        # подписываем валидно, но без поля type
        token = jwt.encode(
            {"sub": "1"},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        assert security.decode_access_token(token) is None
        assert security.decode_refresh_token(token) is None

    def test_unknown_type_rejected(self):
        """Токен с посторонним type → отклоняется обоими декодерами."""
        token = make_token(token_type="superuser")
        assert security.decode_access_token(token) is None
        assert security.decode_refresh_token(token) is None


# ═════════════════════════════════════════════════════════════
# CSRF-токен
# ═════════════════════════════════════════════════════════════
class TestCsrfToken:
    def test_length_and_hex(self):
        token = security.generate_csrf_token()
        assert len(token) == 64                  # 32 байта → 64 hex-символа
        int(token, 16)                            # должен парситься как hex

    def test_tokens_are_unique(self):
        tokens = {security.generate_csrf_token() for _ in range(100)}
        assert len(tokens) == 100                 # коллизий нет
