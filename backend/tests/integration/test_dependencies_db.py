"""Интеграционные тесты get_current_user (нужна БД)."""

import pytest
from fastapi import HTTPException

from app.core.dependencies import (
    ACCESS_COOKIE_NAME,
    get_current_user,
    get_current_user_optional,
)
from app.core.security import create_access_token


class _FakeRequest:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_valid_user(self, db_session, test_user):
        token = create_access_token(test_user.id)
        req = _FakeRequest({ACCESS_COOKIE_NAME: token})
        user = await get_current_user(req, db_session)
        assert user.id == test_user.id

    @pytest.mark.asyncio
    async def test_no_token_raises_401(self, db_session):
        with pytest.raises(HTTPException) as exc:
            await get_current_user(_FakeRequest(), db_session)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_nonexistent_user_raises_404(self, db_session):
        token = create_access_token(999999)
        req = _FakeRequest({ACCESS_COOKIE_NAME: token})
        with pytest.raises(HTTPException) as exc:
            await get_current_user(req, db_session)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_inactive_user_raises_403(self, db_session, test_user):
        test_user.is_active = False
        await db_session.commit()
        token = create_access_token(test_user.id)
        req = _FakeRequest({ACCESS_COOKIE_NAME: token})
        with pytest.raises(HTTPException) as exc:
            await get_current_user(req, db_session)
        assert exc.value.status_code == 403


class TestGetCurrentUserOptional:
    @pytest.mark.asyncio
    async def test_no_cookie_returns_none(self, db_session):
        assert await get_current_user_optional(_FakeRequest(), db_session) is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self, db_session):
        req = _FakeRequest({ACCESS_COOKIE_NAME: "garbage"})
        assert await get_current_user_optional(req, db_session) is None

    @pytest.mark.asyncio
    async def test_valid_returns_user(self, db_session, test_user):
        token = create_access_token(test_user.id)
        req = _FakeRequest({ACCESS_COOKIE_NAME: token})
        user = await get_current_user_optional(req, db_session)
        assert user is not None
        assert user.id == test_user.id
