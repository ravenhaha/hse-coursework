"""Unit-тесты сервиса тегов.

Фокус: проверка владения (404 для несуществующего, 403 для чужого),
идемпотентность assign/unassign, проверка дублей имён.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

import app.services.tag as tag_service


def _make_user(user_id=42):
    u = MagicMock()
    u.id = user_id
    return u


def _make_tag(id, user_id=42, name="python"):
    t = MagicMock()
    t.id = id
    t.user_id = user_id
    t.tag_name = name
    return t


@pytest.fixture
def db():
    return AsyncMock()


@pytest.fixture
def patched(monkeypatch):
    """Патчим все crud-функции + get_owned_material по месту использования."""
    mocks = {}
    for name in [
        "get_tag_by_id", "get_tag_by_name_ci", "get_tags_by_ids",
        "get_tags_by_user", "get_tags_for_material",
        "create_tag", "update_tag", "delete_tag",
        "link_material_tag", "unlink_material_tag", "set_material_tags",
    ]:
        m = AsyncMock()
        monkeypatch.setattr(tag_service, name, m)
        mocks[name] = m
    # get_owned_material импортирован в неймспейс tag_service
    m_owned = AsyncMock()
    monkeypatch.setattr(tag_service, "get_owned_material", m_owned)
    mocks["get_owned_material"] = m_owned
    return mocks


class TestGetTag:
    async def test_own_tag_ok(self, db, patched):
        patched["get_tag_by_id"].return_value = _make_tag(1, user_id=42)
        result = await tag_service.get_tag(db, 1, _make_user(42))
        assert result.id == 1

    async def test_missing_tag_raises_404(self, db, patched):
        patched["get_tag_by_id"].return_value = None
        with pytest.raises(HTTPException) as exc:
            await tag_service.get_tag(db, 999, _make_user(42))
        assert exc.value.status_code == 404

    async def test_foreign_tag_raises_403(self, db, patched):
        patched["get_tag_by_id"].return_value = _make_tag(1, user_id=999)
        with pytest.raises(HTTPException) as exc:
            await tag_service.get_tag(db, 1, _make_user(42))
        assert exc.value.status_code == 403


class TestCreateTag:
    async def test_create_ok(self, db, patched):
        patched["get_tag_by_name_ci"].return_value = None
        patched["create_tag"].return_value = _make_tag(5, name="новый")
        result = await tag_service.create_new_tag(db, _make_user(42), "новый")
        assert result.id == 5
        db.commit.assert_awaited_once()

    async def test_duplicate_name_raises_409(self, db, patched):
        patched["get_tag_by_name_ci"].return_value = _make_tag(2, name="новый")
        with pytest.raises(HTTPException) as exc:
            await tag_service.create_new_tag(db, _make_user(42), "новый")
        assert exc.value.status_code == 409
        patched["create_tag"].assert_not_called()


class TestAssignTag:
    async def test_assign_ok(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        patched["get_tag_by_id"].return_value = _make_tag(1, user_id=42)
        patched["link_material_tag"].return_value = True  # реально вставили

        await tag_service.assign_tag(db, _make_user(42), material_id=10, tag_id=1)
        db.commit.assert_awaited_once()

    async def test_assign_already_assigned_raises_409(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        patched["get_tag_by_id"].return_value = _make_tag(1, user_id=42)
        patched["link_material_tag"].return_value = False  # уже была связь

        with pytest.raises(HTTPException) as exc:
            await tag_service.assign_tag(db, _make_user(42), material_id=10, tag_id=1)
        assert exc.value.status_code == 409
        db.commit.assert_not_called()

    async def test_assign_foreign_tag_raises_403(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        patched["get_tag_by_id"].return_value = _make_tag(1, user_id=999)
        with pytest.raises(HTTPException) as exc:
            await tag_service.assign_tag(db, _make_user(42), material_id=10, tag_id=1)
        assert exc.value.status_code == 403


class TestUnassignTag:
    async def test_unassign_ok(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        patched["get_tag_by_id"].return_value = _make_tag(1, user_id=42)
        patched["unlink_material_tag"].return_value = True

        await tag_service.unassign_tag(db, _make_user(42), material_id=10, tag_id=1)
        db.commit.assert_awaited_once()

    async def test_unassign_not_assigned_raises_404(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        patched["get_tag_by_id"].return_value = _make_tag(1, user_id=42)
        patched["unlink_material_tag"].return_value = False

        with pytest.raises(HTTPException) as exc:
            await tag_service.unassign_tag(db, _make_user(42), material_id=10, tag_id=1)
        assert exc.value.status_code == 404


class TestSetMaterialTagsBulk:
    async def test_all_tags_owned_ok(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        patched["get_tags_by_ids"].return_value = [
            _make_tag(1, user_id=42), _make_tag(2, user_id=42),
        ]
        patched["set_material_tags"].return_value = [1, 2]

        result = await tag_service.set_material_tags_bulk(
            db, _make_user(42), material_id=10, tag_ids=[1, 2],
        )
        assert result == [1, 2]
        db.commit.assert_awaited_once()

    async def test_missing_tag_raises_404(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        # запросили 2 тега, БД вернула 1 → один не существует
        patched["get_tags_by_ids"].return_value = [_make_tag(1, user_id=42)]
        with pytest.raises(HTTPException) as exc:
            await tag_service.set_material_tags_bulk(
                db, _make_user(42), material_id=10, tag_ids=[1, 2],
            )
        assert exc.value.status_code == 404

    async def test_foreign_tag_raises_403(self, db, patched):
        patched["get_owned_material"].return_value = MagicMock()
        patched["get_tags_by_ids"].return_value = [
            _make_tag(1, user_id=42), _make_tag(2, user_id=999),
        ]
        with pytest.raises(HTTPException) as exc:
            await tag_service.set_material_tags_bulk(
                db, _make_user(42), material_id=10, tag_ids=[1, 2],
            )
        assert exc.value.status_code == 403
