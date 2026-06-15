"""Unit-тесты сервиса коллекций.

Мокаем CRUD-слой (app.services.collection.crud_collection) и сессию.
Фокус — бизнес-правила: проверка владения (404/403), защита от циклов,
проверка дублей имён.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.services import collection as collection_service


def _make_collection(id: int, user_id: int, parent_id=None, name="Папка"):
    """Лёгкий стенд-ин модели Collection (нам нужны только атрибуты)."""
    c = MagicMock()
    c.id = id
    c.user_id = user_id
    c.parent_id = parent_id
    c.name = name
    return c


def _make_user(user_id: int):
    u = MagicMock()
    u.id = user_id
    return u


@pytest.fixture
def db():
    """Мок асинхронной сессии."""
    session = AsyncMock()
    return session


@pytest.fixture
def crud(monkeypatch):
    """Подменяет весь crud_collection модуль на AsyncMock."""
    mock = MagicMock()
    # каждый метод — отдельный AsyncMock
    mock.get_collection_by_id = AsyncMock()
    mock.get_duplicate = AsyncMock()
    mock.is_descendant = AsyncMock()
    mock.create_collection = AsyncMock()
    mock.update_collection = AsyncMock()
    mock.delete_collection = AsyncMock()
    mock.list_user_collections = AsyncMock()
    mock.list_all_user_collections = AsyncMock()
    monkeypatch.setattr(collection_service, "crud_collection", mock)
    return mock


class TestGetOwnedCollection:
    async def test_returns_own_collection(self, db, crud):
        crud.get_collection_by_id.return_value = _make_collection(1, user_id=42)
        result = await collection_service.get_collection(db, 1, user_id=42)
        assert result.id == 1

    async def test_not_found_raises_404(self, db, crud):
        crud.get_collection_by_id.return_value = None
        with pytest.raises(HTTPException) as exc:
            await collection_service.get_collection(db, 999, user_id=42)
        assert exc.value.status_code == 404

    async def test_foreign_collection_raises_403(self, db, crud):
        crud.get_collection_by_id.return_value = _make_collection(1, user_id=999)
        with pytest.raises(HTTPException) as exc:
            await collection_service.get_collection(db, 1, user_id=42)
        assert exc.value.status_code == 403


class TestCreateCollection:
    async def test_create_root_ok(self, db, crud):
        crud.get_duplicate.return_value = None
        created = _make_collection(5, user_id=42, name="Новая")
        crud.create_collection.return_value = created

        result = await collection_service.create_collection(
            db, user_id=42, name="Новая", parent_id=None, icon=None,
        )
        assert result.id == 5
        crud.create_collection.assert_awaited_once()
        db.commit.assert_awaited_once()

    async def test_duplicate_name_raises_409(self, db, crud):
        crud.get_duplicate.return_value = _make_collection(2, user_id=42, name="Новая")
        with pytest.raises(HTTPException) as exc:
            await collection_service.create_collection(
                db, user_id=42, name="Новая", parent_id=None, icon=None,
            )
        assert exc.value.status_code == 409
        crud.create_collection.assert_not_called()

    async def test_create_with_foreign_parent_raises_403(self, db, crud):
        # parent существует, но чужой
        crud.get_collection_by_id.return_value = _make_collection(10, user_id=999)
        with pytest.raises(HTTPException) as exc:
            await collection_service.create_collection(
                db, user_id=42, name="Новая", parent_id=10, icon=None,
            )
        assert exc.value.status_code == 403

    async def test_create_with_missing_parent_raises_404(self, db, crud):
        crud.get_collection_by_id.return_value = None
        with pytest.raises(HTTPException) as exc:
            await collection_service.create_collection(
                db, user_id=42, name="Новая", parent_id=777, icon=None,
            )
        assert exc.value.status_code == 404


class TestUpdateCollectionCycleProtection:
    async def test_cannot_set_self_as_parent(self, db, crud):
        """Защита от цикла: коллекция не может быть своим родителем."""
        col = _make_collection(3, user_id=42)
        # 1-й вызов get_collection_by_id — сама коллекция (в _get_owned_collection)
        # 2-й вызов — parent (=сама коллекция, тоже наша)
        crud.get_collection_by_id.side_effect = [col, col]

        with pytest.raises(HTTPException) as exc:
            await collection_service.update_collection(
                db,
                collection_id=3,
                user_id=42,
                new_name=None,
                new_parent_id=3,            # сам себе родитель
                new_icon=None,
                parent_id_provided=True,
                icon_provided=False,
            )
        assert exc.value.status_code == 400

    async def test_cannot_move_into_descendant(self, db, crud):
        """Нельзя переместить коллекцию в собственного потомка."""
        col = _make_collection(3, user_id=42)
        parent = _make_collection(8, user_id=42)
        crud.get_collection_by_id.side_effect = [col, parent]
        crud.is_descendant.return_value = True  # 8 — потомок 3

        with pytest.raises(HTTPException) as exc:
            await collection_service.update_collection(
                db,
                collection_id=3,
                user_id=42,
                new_name=None,
                new_parent_id=8,
                new_icon=None,
                parent_id_provided=True,
                icon_provided=False,
            )
        assert exc.value.status_code == 400


class TestDeleteCollection:
    async def test_delete_own_ok(self, db, crud):
        crud.get_collection_by_id.return_value = _make_collection(1, user_id=42)
        await collection_service.delete_collection(db, collection_id=1, user_id=42)
        crud.delete_collection.assert_awaited_once()
        db.commit.assert_awaited_once()

    async def test_delete_foreign_raises_403(self, db, crud):
        crud.get_collection_by_id.return_value = _make_collection(1, user_id=999)
        with pytest.raises(HTTPException) as exc:
            await collection_service.delete_collection(db, collection_id=1, user_id=42)
        assert exc.value.status_code == 403
        crud.delete_collection.assert_not_called()


class TestBuildTree:
    async def test_builds_nested_tree(self, db, crud):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        def row(id, name, parent_id):
            r = MagicMock()
            r.id, r.name, r.parent_id, r.icon, r.created_at = id, name, parent_id, None, now
            return r

        crud.list_all_user_collections.return_value = [
            row(1, "Родитель", None),
            row(2, "Ребёнок", 1),
            row(3, "Корень2", None),
        ]
        tree = await collection_service.build_tree(db, user_id=42)

        assert len(tree) == 2  # два корня
        parent_node = next(n for n in tree if n.id == 1)
        assert len(parent_node.children) == 1
        assert parent_node.children[0].id == 2
