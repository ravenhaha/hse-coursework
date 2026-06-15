"""Тесты HTTP-логики OAuth (Yandex/VK): обмен code → токен → профиль.

get_or_create_oauth_user замокан — здесь проверяется ТОЛЬКО сетевая
часть и разбор ответов провайдера, без обращения к БД.
"""

import httpx
import pytest
from fastapi import HTTPException

from app.services import auth as auth_service


# ── Заглушки httpx ──
class _FakeResponse:
    def __init__(self, status_code: int = 200, json_data: dict | None = None):
        self.status_code = status_code
        self._json = json_data or {}

    def json(self) -> dict:
        return self._json


class _FakeAsyncClient:
    """Отдаёт заранее заданные ответы по порядку вызовов post/get.

    Если в очереди лежит Exception — бросает его (эмуляция сетевого сбоя).
    """

    def __init__(self, responses):
        self._responses = list(responses)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    def _next(self):
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    async def post(self, *args, **kwargs):
        return self._next()

    async def get(self, *args, **kwargs):
        return self._next()


def _patch_client(monkeypatch, responses):
    client = _FakeAsyncClient(responses)
    monkeypatch.setattr(
        auth_service.httpx, "AsyncClient", lambda *a, **k: client
    )


@pytest.fixture
def mock_goc(monkeypatch):
    """get_or_create_oauth_user → фиксированный результат."""
    from unittest.mock import AsyncMock

    mock = AsyncMock(return_value=("user", "access", "refresh"))
    monkeypatch.setattr(auth_service, "get_or_create_oauth_user", mock)
    return mock


# ════════════════════════════════════════════
# Yandex (строки 406-450)
# ════════════════════════════════════════════
class TestYandexOAuth:
    async def test_success(self, monkeypatch, mock_goc):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok"}),
            _FakeResponse(200, {
                "id": "123",
                "default_email": "a@b.ru",
                "real_name": "Иван Петров",
            }),
        ])
        result = await auth_service.oauth_yandex_login(None, "code")
        assert result == ("user", "access", "refresh")
        mock_goc.assert_awaited_once()

    async def test_token_network_error(self, monkeypatch):
        _patch_client(monkeypatch, [httpx.ConnectError("boom")])
        with pytest.raises(HTTPException) as e:
            await auth_service.oauth_yandex_login(None, "code")
        assert e.value.status_code == 400

    async def test_token_bad_status(self, monkeypatch):
        _patch_client(monkeypatch, [_FakeResponse(500, {})])
        with pytest.raises(HTTPException) as e:
            await auth_service.oauth_yandex_login(None, "code")
        assert e.value.status_code == 400

    async def test_no_access_token(self, monkeypatch):
        _patch_client(monkeypatch, [_FakeResponse(200, {})])
        with pytest.raises(HTTPException):
            await auth_service.oauth_yandex_login(None, "code")

    async def test_info_network_error(self, monkeypatch):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok"}),
            httpx.ConnectError("boom"),
        ])
        with pytest.raises(HTTPException):
            await auth_service.oauth_yandex_login(None, "code")

    async def test_info_bad_status(self, monkeypatch):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok"}),
            _FakeResponse(403, {}),
        ])
        with pytest.raises(HTTPException):
            await auth_service.oauth_yandex_login(None, "code")

    async def test_no_user_id(self, monkeypatch):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok"}),
            _FakeResponse(200, {}),  # нет id
        ])
        with pytest.raises(HTTPException):
            await auth_service.oauth_yandex_login(None, "code")

    async def test_email_from_emails_list(self, monkeypatch, mock_goc):
        # ветка fallback: default_email нет, берём emails[0]
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok"}),
            _FakeResponse(200, {"id": "9", "emails": ["x@y.ru"], "login": "x"}),
        ])
        await auth_service.oauth_yandex_login(None, "code")
        assert mock_goc.await_args.kwargs["email"] == "x@y.ru"


# ════════════════════════════════════════════
# VK (строки 482-540)
# ════════════════════════════════════════════
class TestVKOAuth:
    @pytest.fixture
    def vk_configured(self, monkeypatch):
        monkeypatch.setattr(
            auth_service.settings, "VK_CLIENT_SECRET", "secret", raising=False
        )

    async def test_not_configured(self, monkeypatch):
        monkeypatch.setattr(
            auth_service.settings, "VK_CLIENT_SECRET", None, raising=False
        )
        with pytest.raises(HTTPException) as e:
            await auth_service.oauth_vk_login(None, "code")
        assert e.value.status_code == 501

    async def test_success(self, monkeypatch, vk_configured, mock_goc):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {
                "access_token": "tok", "user_id": 42, "email": "a@b.ru",
            }),
            _FakeResponse(200, {
                "response": [{"first_name": "Иван", "last_name": "Петров"}],
            }),
        ])
        result = await auth_service.oauth_vk_login(None, "code")
        assert result == ("user", "access", "refresh")
        assert mock_goc.await_args.kwargs["display_name"] == "Иван Петров"

    async def test_token_network_error(self, monkeypatch, vk_configured):
        _patch_client(monkeypatch, [httpx.ConnectError("boom")])
        with pytest.raises(HTTPException):
            await auth_service.oauth_vk_login(None, "code")

    async def test_token_bad_status(self, monkeypatch, vk_configured):
        _patch_client(monkeypatch, [_FakeResponse(500, {})])
        with pytest.raises(HTTPException):
            await auth_service.oauth_vk_login(None, "code")

    async def test_no_token_or_user_id(self, monkeypatch, vk_configured):
        _patch_client(monkeypatch, [_FakeResponse(200, {"access_token": "tok"})])
        with pytest.raises(HTTPException):
            await auth_service.oauth_vk_login(None, "code")

    async def test_profile_network_error(self, monkeypatch, vk_configured):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok", "user_id": 42}),
            httpx.ConnectError("boom"),
        ])
        with pytest.raises(HTTPException):
            await auth_service.oauth_vk_login(None, "code")

    async def test_profile_bad_status(self, monkeypatch, vk_configured):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok", "user_id": 42}),
            _FakeResponse(403, {}),
        ])
        with pytest.raises(HTTPException):
            await auth_service.oauth_vk_login(None, "code")

    async def test_empty_profile(self, monkeypatch, vk_configured):
        _patch_client(monkeypatch, [
            _FakeResponse(200, {"access_token": "tok", "user_id": 42}),
            _FakeResponse(200, {"response": []}),
        ])
        with pytest.raises(HTTPException):
            await auth_service.oauth_vk_login(None, "code")
