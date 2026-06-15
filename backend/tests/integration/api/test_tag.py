"""Интеграционные тесты тегов.

Покрываем:
    - CRUD тегов;
    - валидацию имени (trim, пустое, длина) — баг №6 для тегов;
    - case-insensitive уникальность;
    - привязку/отвязку тегов к материалам;
    - bulk-замену набора тегов.
"""

import pytest

from app.core.config import settings
from app.models.collection import Collection

BASE = f"{settings.API_PREFIX}/tags"
MATERIALS = f"{settings.API_PREFIX}/materials"


# ──────────────────────────────────────────
# Фикстура коллекции (нужна для создания материалов).
# Имя текстового поля определяем автоматически — как в test_material.py.
# ──────────────────────────────────────────
def _collection_name_field() -> str:
    for candidate in ("collection_name", "name", "title"):
        if hasattr(Collection, candidate):
            return candidate
    raise RuntimeError("Не нашёл текстовое поле имени у модели Collection")


@pytest.fixture
async def collection_id(db_session, test_user) -> int:
    name_field = _collection_name_field()
    coll = Collection(**{name_field: "Для тегов"}, user_id=test_user.id)
    db_session.add(coll)
    await db_session.commit()
    await db_session.refresh(coll)
    return coll.id


# ──────────────────────────────────────────
# Хелперы
# ──────────────────────────────────────────
async def _create_tag(client, name: str) -> dict:
    resp = await client.post(BASE, json={"tag_name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_material(client, collection_id: int,
                           name: str = "Материал для тегов") -> dict:
    resp = await client.post(f"{MATERIALS}/text", json={
        "collection_id": collection_id,
        "material_name": name,
        "text_content": "<p>x</p>",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


# ══════════════════════════════════════════
# CRUD тегов
# ══════════════════════════════════════════
class TestCrud:
    async def test_create(self, client, test_user):
        data = await _create_tag(client, "Физика")
        assert data["tag_name"] == "Физика"
        assert data["user_id"] == test_user.id

    async def test_list(self, client):
        await _create_tag(client, "Тег А")
        await _create_tag(client, "Тег Б")
        resp = await client.get(BASE)
        assert resp.status_code == 200
        names = {t["tag_name"] for t in resp.json()}
        assert {"Тег А", "Тег Б"} <= names

    async def test_get_by_id(self, client):
        created = await _create_tag(client, "Получить")
        resp = await client.get(f"{BASE}/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created["id"]

    async def test_get_nonexistent(self, client):
        assert (await client.get(f"{BASE}/999999")).status_code == 404

    async def test_update(self, client):
        created = await _create_tag(client, "Старое")
        resp = await client.patch(f"{BASE}/{created['id']}", json={"tag_name": "Новое"})
        assert resp.status_code == 200
        assert resp.json()["tag_name"] == "Новое"

    async def test_delete(self, client):
        created = await _create_tag(client, "Удалить")
        tid = created["id"]
        assert (await client.delete(f"{BASE}/{tid}")).status_code == 204
        assert (await client.get(f"{BASE}/{tid}")).status_code == 404


# ══════════════════════════════════════════
# Валидация (баг №6 для тегов)
# ══════════════════════════════════════════
class TestValidation:
    @pytest.mark.parametrize("name", ["", "   ", "\t\n"])
    async def test_blank_name_rejected(self, client, name):
        resp = await client.post(BASE, json={"tag_name": name})
        assert resp.status_code == 422

    async def test_name_trimmed(self, client):
        data = await _create_tag(client, "  Алгебра  ")
        assert data["tag_name"] == "Алгебра"

    async def test_name_too_long(self, client):
        resp = await client.post(BASE, json={"tag_name": "x" * 51})
        assert resp.status_code == 422

    async def test_update_blank_rejected(self, client):
        created = await _create_tag(client, "Норм")
        resp = await client.patch(f"{BASE}/{created['id']}", json={"tag_name": "   "})
        assert resp.status_code == 422

    async def test_update_without_name_rejected(self, client):
        """tag_name обязателен в TagUpdate → PATCH без него = 422."""
        created = await _create_tag(client, "Норм")
        resp = await client.patch(f"{BASE}/{created['id']}", json={})
        assert resp.status_code == 422


# ══════════════════════════════════════════
# Уникальность (case-insensitive на уровне БД)
# ══════════════════════════════════════════
class TestUniqueness:
    async def test_duplicate_same_case(self, client):
        await _create_tag(client, "Уникальный")
        resp = await client.post(BASE, json={"tag_name": "Уникальный"})
        assert resp.status_code in (400, 409), resp.text

    async def test_duplicate_different_case(self, client):
        """Регистр сохраняется, но уникальность case-insensitive."""
        await _create_tag(client, "Python")
        resp = await client.post(BASE, json={"tag_name": "PYTHON"})
        assert resp.status_code in (400, 409), resp.text


# ══════════════════════════════════════════
# Привязка тегов к материалам
# ══════════════════════════════════════════
class TestMaterialTags:
    async def test_assign_and_list(self, client, collection_id):
        material = await _create_material(client, collection_id)
        tag = await _create_tag(client, "Привязка")

        resp = await client.post(
            f"{BASE}/materials/{material['id']}",
            json={"tag_id": tag["id"]},
        )
        assert resp.status_code == 201, resp.text

        listed = await client.get(f"{BASE}/materials/{material['id']}")
        assert listed.status_code == 200
        assert {t["id"] for t in listed.json()} == {tag["id"]}

    async def test_unassign(self, client, collection_id):
        material = await _create_material(client, collection_id)
        tag = await _create_tag(client, "Снять")
        await client.post(
            f"{BASE}/materials/{material['id']}",
            json={"tag_id": tag["id"]},
        )

        resp = await client.delete(
            f"{BASE}/materials/{material['id']}/{tag['id']}"
        )
        assert resp.status_code == 204

        listed = await client.get(f"{BASE}/materials/{material['id']}")
        assert listed.json() == []

    async def test_set_bulk(self, client, collection_id):
        material = await _create_material(client, collection_id)
        tag1 = await _create_tag(client, "Bulk1")
        tag2 = await _create_tag(client, "Bulk2")

        resp = await client.put(
            f"{BASE}/materials/{material['id']}",
            json={"tag_ids": [tag1["id"], tag2["id"]]},
        )
        assert resp.status_code == 200, resp.text
        assert set(resp.json()["tag_ids"]) == {tag1["id"], tag2["id"]}

    async def test_set_bulk_replaces(self, client, collection_id):
        """PUT полностью заменяет набор: старые теги уходят."""
        material = await _create_material(client, collection_id)
        old = await _create_tag(client, "Старый")
        new = await _create_tag(client, "Новый")

        await client.put(
            f"{BASE}/materials/{material['id']}",
            json={"tag_ids": [old["id"]]},
        )
        await client.put(
            f"{BASE}/materials/{material['id']}",
            json={"tag_ids": [new["id"]]},
        )

        listed = await client.get(f"{BASE}/materials/{material['id']}")
        assert {t["id"] for t in listed.json()} == {new["id"]}

    async def test_set_bulk_empty_clears(self, client, collection_id):
        """Пустой список = снять все теги."""
        material = await _create_material(client, collection_id)
        tag = await _create_tag(client, "Очистить")
        await client.put(
            f"{BASE}/materials/{material['id']}",
            json={"tag_ids": [tag["id"]]},
        )

        resp = await client.put(
            f"{BASE}/materials/{material['id']}",
            json={"tag_ids": []},
        )
        assert resp.status_code == 200
        assert resp.json()["tag_ids"] == []

    async def test_bulk_too_many_rejected(self, client, collection_id):
        """max_length=100 → 101 тег отклоняется без похода в БД."""
        material = await _create_material(client, collection_id)
        resp = await client.put(
            f"{BASE}/materials/{material['id']}",
            json={"tag_ids": list(range(101))},
        )
        assert resp.status_code == 422
