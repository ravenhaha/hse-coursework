"""Auth-роуты: logout и OAuth-flow (VK / Yandex).

register/login/refresh вынесены отдельно — для них нужны точные поля
схем UserRegister/UserLogin (см. конец ответа).

OAuth-сервисы мокаются через monkeypatch — наружу (в VK/Яндекс) не ходим.
Rate limiter отключаем фикстурой, иначе словим 429 на повторных прогонах.
"""

import pytest

from app.api import auth as auth_module
from app.api.auth import OAUTH_STATE_COOKIE_NAME
from app.core.config import settings
from app.core.dependencies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME

BASE = f"{settings.API_PREFIX}/auth"


# ──────────────────────────────────────────
# Отключаем rate limiting на время тестов:
# 3/min на register и 5/min на login иначе дадут 429 при повторных прогонах.
# ──────────────────────────────────────────
@pytest.fixture(autouse=True)
def _disable_rate_limit():
    from app.core.limiter import limiter
    original = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = original


# ══════════════════════════════════════════
# Logout
# ══════════════════════════════════════════
class TestLogout:
    async def test_logout_ok(self, client):
        resp = await client.post(f"{BASE}/logout")
        assert resp.status_code == 200
        assert resp.json()["message"]

    async def test_logout_clears_cookies(self, client):
        resp = await client.post(f"{BASE}/logout")
        set_cookie = " ".join(resp.headers.get_list("set-cookie"))
        # delete_cookie ставит Max-Age=0 / expires в прошлом для каждой cookie
        assert ACCESS_COOKIE_NAME in set_cookie
        assert REFRESH_COOKIE_NAME in set_cookie


# ══════════════════════════════════════════
# OAuth: redirect на провайдера + state-cookie
# ══════════════════════════════════════════
class TestOAuthRedirect:
    async def test_vk_redirect(self, client, monkeypatch):
        monkeypatch.setattr(
            auth_module, "build_vk_authorize_url",
            lambda state: f"https://oauth.vk.com/authorize?state={state}",
        )
        resp = await client.get(f"{BASE}/vk")
        assert resp.status_code == 307                       # RedirectResponse default
        assert resp.headers["location"].startswith("https://oauth.vk.com")
        assert OAUTH_STATE_COOKIE_NAME in resp.cookies

    async def test_yandex_redirect(self, client, monkeypatch):
        monkeypatch.setattr(
            auth_module, "build_yandex_authorize_url",
            lambda state: f"https://oauth.yandex.ru/authorize?state={state}",
        )
        resp = await client.get(f"{BASE}/yandex")
        assert resp.status_code == 307
        assert resp.headers["location"].startswith("https://oauth.yandex.ru")
        assert OAUTH_STATE_COOKIE_NAME in resp.cookies


# ══════════════════════════════════════════
# OAuth: callback — проверка state (Login CSRF guard) + обмен code
# ══════════════════════════════════════════
class TestOAuthCallback:
    async def test_vk_callback_no_state_cookie(self, client):
        """Нет state-cookie → 403 (защита от OAuth Login CSRF)."""
        resp = await client.get(
            f"{BASE}/vk/callback",
            params={"code": "authcode", "state": "whatever"},
        )
        assert resp.status_code == 403

    async def test_yandex_callback_state_mismatch(self, client):
        """state из query ≠ state в cookie → 403."""
        resp = await client.get(
            f"{BASE}/yandex/callback",
            params={"code": "authcode", "state": "fake-state"},
            headers={"Cookie": f"{OAUTH_STATE_COOKIE_NAME}=real-state"},
        )
        assert resp.status_code == 403

    async def test_yandex_callback_success(self, client, monkeypatch, test_user):
        """Совпавший state + замоканный обмен code → 302 на /workspace + cookies."""
        async def fake_login(db, code):
            return test_user, "access.jwt.token", "refresh.jwt.token"

        monkeypatch.setattr(auth_module, "oauth_yandex_login", fake_login)

        state = "matching-state-123"
        resp = await client.get(
            f"{BASE}/yandex/callback",
            params={"code": "authcode", "state": state},
            headers={"Cookie": f"{OAUTH_STATE_COOKIE_NAME}={state}"},
        )
        assert resp.status_code == 302
        assert resp.headers["location"].endswith("/workspace")
        assert ACCESS_COOKIE_NAME in resp.cookies
        assert REFRESH_COOKIE_NAME in resp.cookies
