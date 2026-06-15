"""Интеграционные тесты коллекций (папок материалов).

Покрываем:
    - CRUD;
    - иерархию (дерево, дети, перемещение);
    - поиск;
    - валидацию имени и иконки (баг №6 для коллекций);
    - PATCH-семантику "не передано" vs "передано null".

Путь BASE берём из settings.API_PREFIX, чтобы не зависеть от префикса роутера.
"""

import pytest

from app.core.config import settings

BASE = f"{settings.API_PREFIX}/collections"


# ──────────────────────────────────────────
# Хелпер: создать коллекцию через API и вернуть её id
# ──────────────────────────────────────────
async def _create(client, name: str, parent_id: int | None = None,
                  icon: str | None = None) -> dict:
    body: dict = {"name": name}
    if parent_id is not None:
        body["parent_id"] = parent_id
    if icon is not None:
        body["icon"] = icon
    resp = await client.post(BASE, json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ══════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════
class TestCrud:
    async def test_create_root(self, client, test_user):
        data = await _create(client, "Физика", icon="📚")
        assert data["name"] == "Физика"
        assert data["icon"] == "📚"
        assert data["parent_id"] is None
        assert data["user_id"] == test_user.id

    async def test_create_without_icon(self, client):
        data = await _create(client, "Без иконки")
        assert data["icon"] is None

    async def test_get_by_id(self, client):
        created = await _create(client, "Получить")
        resp = await client.get(f"{BASE}/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created["id"]

    async def test_get_nonexistent(self, client):
        assert (await client.get(f"{BASE}/999999")).status_code == 404

    async def test_update_name(self, client):
        created = await _create(client, "Старое имя")
        resp = await client.patch(f"{BASE}/{created['id']}", json={"name": "Новое имя"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Новое имя"

    async def test_update_icon(self, client):
        created = await _create(client, "С иконкой", icon="📕")
        resp = await client.patch(f"{BASE}/{created['id']}", json={"icon": "📗"})
        assert resp.status_code == 200
        assert resp.json()["icon"] == "📗"

    async def test_delete(self, client):
        created = await _create(client, "Удалить")
        cid = created["id"]
        assert (await client.delete(f"{BASE}/{cid}")).status_code == 204
        assert (await client.get(f"{BASE}/{cid}")).status_code == 404


# ══════════════════════════════════════════
# Список и режимы (root / children / search)
# ══════════════════════════════════════════
class TestListing:
    async def test_list_root(self, client):
        await _create(client, "Корневая 1")
        await _create(client, "Корневая 2")
        resp = await client.get(BASE)
        assert resp.status_code == 200
        names = {c["name"] for c in resp.json()}
        assert {"Корневая 1", "Корневая 2"} <= names

    async def test_list_root_excludes_children(self, client):
        """Без параметров возвращаются только корневые (parent_id IS NULL)."""
        parent = await _create(client, "Родитель")
        await _create(client, "Ребёнок", parent_id=parent["id"])
        resp = await client.get(BASE)
        names = {c["name"] for c in resp.json()}
        assert "Родитель" in names
        assert "Ребёнок" not in names

    async def test_list_children(self, client):
        parent = await _create(client, "Папка")
        await _create(client, "Вложенная", parent_id=parent["id"])
        resp = await client.get(BASE, params={"parent_id": parent["id"]})
        assert resp.status_code == 200
        names = {c["name"] for c in resp.json()}
        assert names == {"Вложенная"}

    async def test_search(self, client):
        await _create(client, "Квантовая физика")
        await _create(client, "История")
        resp = await client.get(BASE, params={"search": "физик"})
        assert resp.status_code == 200
        names = {c["name"] for c in resp.json()}
        assert "Квантовая физика" in names
        assert "История" not in names


# ══════════════════════════════════════════
# Дерево
# ══════════════════════════════════════════
class TestTree:
    async def test_tree_structure(self, client):
        parent = await _create(client, "Корень")
        await _create(client, "Лист", parent_id=parent["id"])
        resp = await client.get(f"{BASE}/tree")
        assert resp.status_code == 200
        tree = resp.json()
        root_node = next(n for n in tree if n["name"] == "Корень")
        assert {c["name"] for c in root_node["children"]} == {"Лист"}

    async def test_tree_empty(self, client):
        resp = await client.get(f"{BASE}/tree")
        assert resp.status_code == 200
        assert resp.json() == []


# ══════════════════════════════════════════
# Иерархия: перемещение (PATCH-семантика)
# ══════════════════════════════════════════
class TestHierarchy:
    async def test_move_into_parent(self, client):
        parent = await _create(client, "Новый родитель")
        child = await _create(client, "Перемещаемая")
        resp = await client.patch(
            f"{BASE}/{child['id']}",
            json={"parent_id": parent["id"]},
        )
        assert resp.status_code == 200
        assert resp.json()["parent_id"] == parent["id"]

    async def test_move_to_root(self, client):
        """parent_id=null → перемещение в корень (поле передано как null)."""
        parent = await _create(client, "Родитель")
        child = await _create(client, "Ребёнок", parent_id=parent["id"])
        resp = await client.patch(f"{BASE}/{child['id']}", json={"parent_id": None})
        assert resp.status_code == 200
        assert resp.json()["parent_id"] is None

    async def test_patch_name_keeps_parent(self, client):
        """parent_id НЕ передан → не трогаем (остаётся прежним)."""
        parent = await _create(client, "Папка")
        child = await _create(client, "Старое", parent_id=parent["id"])
        resp = await client.patch(f"{BASE}/{child['id']}", json={"name": "Новое"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Новое"
        assert body["parent_id"] == parent["id"]


# ══════════════════════════════════════════
# Валидация (баг №6 для коллекций)
# ══════════════════════════════════════════
class TestValidation:
    @pytest.mark.parametrize("name", ["", "   ", "\t\n"])
    async def test_blank_name_rejected(self, client, name):
        resp = await client.post(BASE, json={"name": name})
        assert resp.status_code == 422

    async def test_name_trimmed(self, client):
        data = await _create(client, "  Алгебра  ")
        assert data["name"] == "Алгебра"

    async def test_name_too_long(self, client):
        resp = await client.post(BASE, json={"name": "x" * 101})
        assert resp.status_code == 422

    async def test_icon_too_long(self, client):
        resp = await client.post(BASE, json={"name": "Норм", "icon": "x" * 11})
        assert resp.status_code == 422

    async def test_blank_icon_becomes_null(self, client):
        """Пустая иконка после strip трактуется как None (сброс)."""
        data = await _create(client, "Тест", icon="   ")
        assert data["icon"] is None
