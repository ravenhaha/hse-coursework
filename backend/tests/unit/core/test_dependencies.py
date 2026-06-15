"""Юнит-тесты FastAPI-зависимостей аутентификации (без БД)."""

import pytest
from fastapi import HTTPException

from app.core.dependencies import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    _extract_access_token,
    _user_id_from_access_token,
    get_refresh_token,
)
from app.core.security import create_access_token, create_refresh_token


class _FakeRequest:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}


class TestExtractAccessToken:
    def test_present(self):
        req = _FakeRequest({ACCESS_COOKIE_NAME: "abc"})
        assert _extract_access_token(req) == "abc"

    def test_missing_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            _extract_access_token(_FakeRequest())
        assert exc.value.status_code == 401


class TestUserIdFromToken:
    def test_valid_token(self):
        token = create_access_token(42)
        assert _user_id_from_access_token(token) == 42

    def test_garbage_token_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            _user_id_from_access_token("not.a.token")
        assert exc.value.status_code == 401

    def test_refresh_token_rejected(self):
        refresh = create_refresh_token(42)
        with pytest.raises(HTTPException) as exc:
            _user_id_from_access_token(refresh)
        assert exc.value.status_code == 401


class TestGetRefreshToken:
    def test_present(self):
        req = _FakeRequest({REFRESH_COOKIE_NAME: "rtoken"})
        assert get_refresh_token(req) == "rtoken"

    def test_missing_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            get_refresh_token(_FakeRequest())
        assert exc.value.status_code == 401
