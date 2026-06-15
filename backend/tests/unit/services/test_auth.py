"""Unit-тесты сервиса аутентификации (app/services/auth.py).

Без БД и без сети: CRUD, security и httpx замоканы в неймспейсе
app.services.auth. Доменные исключения (core.exceptions) НЕ мокаются —
они бросают настоящий HTTPException, проверяем его status_code.

Стиль соответствует tests/unit/services/test_defaults.py:
    - класс-группировка TestX;
    - async-методы без @pytest.mark.asyncio (asyncio_mode=auto);
    - CRUD-функции патчатся через monkeypatch.setattr в неймспейсе сервиса.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

import app.services.auth as auth_service
from app.models.auth_account import AuthProvider
from tests.helpers.builders import make_user
from tests.helpers.mocks import mock_db_session


# ─────────────────────────────────────────────────────────────
# Локальные хелперы (билдера для AuthAccount в helpers/ нет)
# ─────────────────────────────────────────────────────────────
def _auth(user=None, password_hash="$argon2id$fake"):
    """Мок AuthAccount: сервис трогает .user, .password_hash, .last_login_at."""
    account = MagicMock(name="AuthAccount")
    account.user = user
    account.password_hash = password_hash
    account.last_login_at = None
    return account


def _resp(status_code=200, data=None):
    """Мок httpx.Response."""
    response = MagicMock(name="Response")
    response.status_code = status_code
    response.json = MagicMock(return_value=data or {})
    return response


def _patch_httpx(monkeypatch, *, post=None, get=None):
    """Подменяет httpx.AsyncClient на async-context-manager с моками.

    post/get — Response, список Response (по очереди вызовов) или
    исключение (будет брошено при вызове).
    """
    client = AsyncMock(name="httpx_client")
    if post is not None:
        client.post = AsyncMock(side_effect=post if isinstance(post, list) else [post])
    if get is not None:
        client.get = AsyncMock(side_effect=get if isinstance(get, list) else [get])

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(auth_service.httpx, "AsyncClient",
                        MagicMock(return_value=cm))
    return client


# ─────────────────────────────────────────────────────────────
# Фикстуры
# ─────────────────────────────────────────────────────────────
@pytest.fixture
def db():
    return mock_db_session()


@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch):
    """Детерминированные токены — чтобы проверять возвращаемую пару."""
    monkeypatch.setattr(auth_service, "create_access_token", lambda uid: "access")
    monkeypatch.setattr(auth_service, "create_refresh_token", lambda uid: "refresh")


# ═════════════════════════════════════════════════════════════
# Утилиты модуля
# ═════════════════════════════════════════════════════════════
class TestHelpers:
    def test_normalize_email(self):
        assert auth_service._normalize_email("  Ivan@HSE.RU ") == "ivan@hse.ru"

    @pytest.mark.parametrize("email,expected", [
        ("ivan@hse.ru", "ivan"),
        ("@nobody", "user"),
        ("x" * 200 + "@a.ru", "x" * 100),
    ])
    def test_default_display_name(self, email, expected):
        assert auth_service._default_display_name(email) == expected

    def test_build_vk_authorize_url(self):
        url = auth_service.build_vk_authorize_url("st8")
        assert "oauth.vk.com/authorize" in url
        assert "state=st8" in url

    def test_build_yandex_authorize_url(self):
        url = auth_service.build_yandex_authorize_url("st8")
        assert "oauth.yandex.ru/authorize" in url
        assert "state=st8" in url


# ═════════════════════════════════════════════════════════════
# 1. register_user
# ═════════════════════════════════════════════════════════════
class TestRegisterUser:
    @pytest.fixture
    def patched(self, monkeypatch):
        get_by_email = AsyncMock(return_value=None)
        create_u = AsyncMock(return_value=make_user())
        create_acc = AsyncMock()
        create_tags = AsyncMock()
        monkeypatch.setattr(auth_service, "get_user_by_email", get_by_email)
        monkeypatch.setattr(auth_service, "create_user", create_u)
        monkeypatch.setattr(auth_service, "create_auth_account", create_acc)
        monkeypatch.setattr(auth_service, "create_default_tags_for_user", create_tags)
        monkeypatch.setattr(auth_service, "hash_password", lambda p: "hashed")
        return {
            "get_user_by_email": get_by_email,
            "create_user": create_u,
            "create_auth_account": create_acc,
            "create_default_tags_for_user": create_tags,
        }

    async def test_success_returns_pair(self, db, patched):
        payload = SimpleNamespace(email="New@Mail.ru", password="secret123")
        user, access, refresh = await auth_service.register_user(db, payload)

        assert access == "access"
        assert refresh == "refresh"
        assert user is patched["create_user"].return_value
        db.commit.assert_awaited_once()
        db.rollback.assert_not_awaited()

    async def test_email_normalized_before_write(self, db, patched):
        payload = SimpleNamespace(email="  New@Mail.RU ", password="secret123")
        await auth_service.register_user(db, payload)
        assert patched["create_user"].await_args.kwargs["email"] == "new@mail.ru"

    async def test_default_tags_created(self, db, patched):
        payload = SimpleNamespace(email="a@b.ru", password="secret123")
        await auth_service.register_user(db, payload)
        patched["create_default_tags_for_user"].assert_awaited_once()

    async def test_email_taken_409(self, db, patched):
        patched["get_user_by_email"].return_value = make_user()
        payload = SimpleNamespace(email="dup@mail.ru", password="secret123")
        with pytest.raises(HTTPException) as exc:
            await auth_service.register_user(db, payload)
        assert exc.value.status_code == 409
        db.commit.assert_not_awaited()

    async def test_rollback_on_db_error(self, db, patched):
        patched["create_user"].side_effect = RuntimeError("boom")
        payload = SimpleNamespace(email="a@b.ru", password="secret123")
        with pytest.raises(RuntimeError):
            await auth_service.register_user(db, payload)
        db.rollback.assert_awaited_once()
        db.commit.assert_not_awaited()


# ═════════════════════════════════════════════════════════════
# 2. login_user
# ═════════════════════════════════════════════════════════════
class TestLoginUser:
    @pytest.fixture
    def patched(self, monkeypatch):
        get_acc = AsyncMock()
        update_hash = AsyncMock()
        monkeypatch.setattr(auth_service, "get_email_account", get_acc)
        monkeypatch.setattr(auth_service, "update_password_hash", update_hash)
        monkeypatch.setattr(auth_service, "verify_password", lambda p, h: True)
        monkeypatch.setattr(auth_service, "needs_rehash", lambda h: False)
        monkeypatch.setattr(auth_service, "hash_password", lambda p: "new_hash")
        return {"get_email_account": get_acc, "update_password_hash": update_hash}

    async def test_success(self, db, patched):
        user = make_user()
        patched["get_email_account"].return_value = _auth(user=user)
        payload = SimpleNamespace(email="User@Mail.ru", password="secret123")

        res_user, access, refresh = await auth_service.login_user(db, payload)
        assert res_user is user
        assert (access, refresh) == ("access", "refresh")
        db.commit.assert_awaited_once()

    async def test_updates_last_login(self, db, patched):
        account = _auth(user=make_user())
        patched["get_email_account"].return_value = account
        payload = SimpleNamespace(email="u@m.ru", password="secret123")
        await auth_service.login_user(db, payload)
        assert account.last_login_at is not None

    async def test_no_account_401(self, db, patched):
        patched["get_email_account"].return_value = None
        payload = SimpleNamespace(email="nope@m.ru", password="secret123")
        with pytest.raises(HTTPException) as exc:
            await auth_service.login_user(db, payload)
        assert exc.value.status_code == 401

    async def test_oauth_only_account_401(self, db, patched):
        # password_hash=None → у аккаунта нет пароля (заведён через OAuth)
        patched["get_email_account"].return_value = _auth(
            user=make_user(), password_hash=None,
        )
        payload = SimpleNamespace(email="oauth@m.ru", password="secret123")
        with pytest.raises(HTTPException) as exc:
            await auth_service.login_user(db, payload)
        assert exc.value.status_code == 401

    async def test_wrong_password_401(self, db, patched, monkeypatch):
        monkeypatch.setattr(auth_service, "verify_password", lambda p, h: False)
        patched["get_email_account"].return_value = _auth(user=make_user())
        payload = SimpleNamespace(email="u@m.ru", password="wrong")
        with pytest.raises(HTTPException) as exc:
            await auth_service.login_user(db, payload)
        assert exc.value.status_code == 401

    async def test_inactive_403(self, db, patched):
        patched["get_email_account"].return_value = _auth(
            user=make_user(is_active=False),
        )
        payload = SimpleNamespace(email="u@m.ru", password="secret123")
        with pytest.raises(HTTPException) as exc:
            await auth_service.login_user(db, payload)
        assert exc.value.status_code == 403

    async def test_rehash_triggers_update(self, db, patched, monkeypatch):
        monkeypatch.setattr(auth_service, "needs_rehash", lambda h: True)
        patched["get_email_account"].return_value = _auth(user=make_user())
        payload = SimpleNamespace(email="u@m.ru", password="secret123")

        await auth_service.login_user(db, payload)
        patched["update_password_hash"].assert_awaited_once()
        # третий позиционный аргумент — новый хеш
        assert patched["update_password_hash"].await_args.args[2] == "new_hash"


# ═════════════════════════════════════════════════════════════
# 3. refresh_tokens
# ═════════════════════════════════════════════════════════════
class TestRefreshTokens:
    @pytest.fixture
    def patched(self, monkeypatch):
        get_by_id = AsyncMock(return_value=make_user(user_id=42))
        monkeypatch.setattr(auth_service, "get_user_by_id", get_by_id)
        return {"get_user_by_id": get_by_id}

    def _set_decode(self, monkeypatch, value):
        monkeypatch.setattr(auth_service, "decode_refresh_token", lambda t: value)

    async def test_success(self, db, patched, monkeypatch):
        self._set_decode(monkeypatch, {"sub": "42", "type": "refresh"})
        user, access, refresh = await auth_service.refresh_tokens(db, "tok")
        assert user is patched["get_user_by_id"].return_value
        assert (access, refresh) == ("access", "refresh")

    async def test_invalid_token_401(self, db, patched, monkeypatch):
        self._set_decode(monkeypatch, None)
        with pytest.raises(HTTPException) as exc:
            await auth_service.refresh_tokens(db, "bad")
        assert exc.value.status_code == 401

    async def test_missing_sub_401(self, db, patched, monkeypatch):
        self._set_decode(monkeypatch, {"type": "refresh"})
        with pytest.raises(HTTPException) as exc:
            await auth_service.refresh_tokens(db, "tok")
        assert exc.value.status_code == 401

    async def test_sub_not_int_401(self, db, patched, monkeypatch):
        self._set_decode(monkeypatch, {"sub": "abc", "type": "refresh"})
        with pytest.raises(HTTPException) as exc:
            await auth_service.refresh_tokens(db, "tok")
        assert exc.value.status_code == 401

    async def test_user_gone_401(self, db, patched, monkeypatch):
        self._set_decode(monkeypatch, {"sub": "42", "type": "refresh"})
        patched["get_user_by_id"].return_value = None
        with pytest.raises(HTTPException) as exc:
            await auth_service.refresh_tokens(db, "tok")
        assert exc.value.status_code == 401

    async def test_inactive_403(self, db, patched, monkeypatch):
        self._set_decode(monkeypatch, {"sub": "42", "type": "refresh"})
        patched["get_user_by_id"].return_value = make_user(is_active=False)
        with pytest.raises(HTTPException) as exc:
            await auth_service.refresh_tokens(db, "tok")
        assert exc.value.status_code == 403


# ═════════════════════════════════════════════════════════════
# 4. get_or_create_oauth_user
# ═════════════════════════════════════════════════════════════
class TestGetOrCreateOAuthUser:
    @pytest.fixture
    def patched(self, monkeypatch):
        get_acc = AsyncMock(return_value=None)
        get_by_email = AsyncMock(return_value=None)
        create_acc = AsyncMock(return_value=_auth(user=None))
        create_u = AsyncMock(return_value=make_user(user_id=99))
        create_tags = AsyncMock()
        monkeypatch.setattr(auth_service, "get_auth_account", get_acc)
        monkeypatch.setattr(auth_service, "get_user_by_email", get_by_email)
        monkeypatch.setattr(auth_service, "create_auth_account", create_acc)
        monkeypatch.setattr(auth_service, "create_user", create_u)
        monkeypatch.setattr(auth_service, "create_default_tags_for_user", create_tags)
        return {
            "get_auth_account": get_acc,
            "get_user_by_email": get_by_email,
            "create_auth_account": create_acc,
            "create_user": create_u,
            "create_default_tags_for_user": create_tags,
        }

    async def test_existing_link(self, db, patched):
        """Сценарий 1: привязка уже есть → возвращаем её юзера."""
        user = make_user()
        account = _auth(user=user)
        patched["get_auth_account"].return_value = account

        res_user, access, refresh = await auth_service.get_or_create_oauth_user(
            db, provider=AuthProvider.YANDEX, provider_user_id="ya1",
            email="user@mail.ru",
        )
        assert res_user is user
        assert account.last_login_at is not None
        patched["create_user"].assert_not_awaited()
        db.commit.assert_awaited_once()

    async def test_existing_link_inactive_403(self, db, patched):
        patched["get_auth_account"].return_value = _auth(
            user=make_user(is_active=False),
        )
        with pytest.raises(HTTPException) as exc:
            await auth_service.get_or_create_oauth_user(
                db, provider=AuthProvider.YANDEX, provider_user_id="ya1",
                email="u@m.ru",
            )
        assert exc.value.status_code == 403

    async def test_link_to_existing_user_by_email(self, db, patched):
        """Сценарий 2: юзер с таким email есть → линкуем новую привязку."""
        existing = make_user(user_id=5)
        patched["get_user_by_email"].return_value = existing

        res_user, *_ = await auth_service.get_or_create_oauth_user(
            db, provider=AuthProvider.YANDEX, provider_user_id="ya2",
            email="Exist@Mail.ru",
        )
        assert res_user is existing
        patched["create_auth_account"].assert_awaited_once()
        patched["create_user"].assert_not_awaited()
        db.commit.assert_awaited_once()

    async def test_create_new_user(self, db, patched):
        """Сценарий 3: ни привязки, ни юзера → создаём нового + теги."""
        new_user = make_user(user_id=99, email="brand@new.ru")
        patched["create_user"].return_value = new_user

        res_user, access, refresh = await auth_service.get_or_create_oauth_user(
            db, provider=AuthProvider.YANDEX, provider_user_id="ya3",
            email="Brand@New.ru",
        )
        assert res_user is new_user
        assert (access, refresh) == ("access", "refresh")
        patched["create_user"].assert_awaited_once()
        patched["create_auth_account"].assert_awaited_once()
        patched["create_default_tags_for_user"].assert_awaited_once()
        db.commit.assert_awaited_once()

    async def test_email_normalized_on_create(self, db, patched):
        """Email нормализуется перед поиском/созданием."""
        patched["create_user"].return_value = make_user(user_id=99)
        await auth_service.get_or_create_oauth_user(
            db, provider=AuthProvider.YANDEX, provider_user_id="ya4",
            email="  MiXeD@Case.RU ",
        )
        # хотя бы один из путей получил нормализованный email
        assert patched["get_user_by_email"].await_args.args[1] == "mixed@case.ru"

    async def test_rollback_on_error(self, db, patched):
        """Любая ошибка при создании → rollback, commit не вызывается."""
        patched["create_user"].side_effect = RuntimeError("boom")
        with pytest.raises(RuntimeError):
            await auth_service.get_or_create_oauth_user(
                db, provider=AuthProvider.YANDEX, provider_user_id="ya5",
                email="err@m.ru",
            )
        db.rollback.assert_awaited_once()
        db.commit.assert_not_awaited()
