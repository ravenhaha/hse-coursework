"""Unit-тесты сервиса материалов.

Фокус:
    - проверка владения через коллекцию (get_owned_collection);
    - бизнес-правила update (text_content только для TEXT, запрет null);
    - file-материал: парсер в thread pool мокается, его падение
      не ломает создание материала.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

import app.services.material as material_service
from app.models.material import SourceType


def _make_user(user_id=42):
    u = MagicMock()
    u.id = user_id
    return u


def _make_material(id=1, collection_id=10, source_type=SourceType.TEXT):
    m = MagicMock()
    m.id = id
    m.collection_id = collection_id
    m.source_type = source_type
    return m


@pytest.fixture
def db():
    return AsyncMock()


@pytest.fixture
def patched(monkeypatch):
    """Патчим crud-функции и кросс-сервисный get_owned_collection."""
    names = [
        "get_material_by_id", "create_material", "update_material",
        "delete_material", "list_all_user_materials",
        "list_materials_by_collection", "list_user_materials_paginated",
    ]
    mocks = {}
    for name in names:
        m = AsyncMock()
        monkeypatch.setattr(material_service, name, m)
        mocks[name] = m

    m_coll = AsyncMock()
    monkeypatch.setattr(material_service, "get_owned_collection", m_coll)
    mocks["get_owned_collection"] = m_coll
    return mocks


class TestGetOwnedMaterial:
    async def test_ok(self, db, patched):
        patched["get_material_by_id"].return_value = _make_material()
        patched["get_owned_collection"].return_value = MagicMock()
        result = await material_service.get_material(db, 1, _make_user())
        assert result.id == 1
        # проверка доступа шла через коллекцию материала
        patched["get_owned_collection"].assert_awaited_once()

    async def test_missing_raises_404(self, db, patched):
        patched["get_material_by_id"].return_value = None
        with pytest.raises(HTTPException) as exc:
            await material_service.get_material(db, 999, _make_user())
        assert exc.value.status_code == 404

    async def test_foreign_collection_raises_403(self, db, patched):
        """Материал есть, но его коллекция чужая → get_owned_collection кидает 403."""
        patched["get_material_by_id"].return_value = _make_material()
        patched["get_owned_collection"].side_effect = HTTPException(403, "нет доступа")
        with pytest.raises(HTTPException) as exc:
            await material_service.get_material(db, 1, _make_user())
        assert exc.value.status_code == 403


class TestCreateTextMaterial:
    async def test_create_ok(self, db, patched):
        patched["get_owned_collection"].return_value = MagicMock()
        created = _make_material(id=5)
        patched["create_material"].return_value = created
        # _reload_with_tags зовёт get_material_by_id ещё раз
        patched["get_material_by_id"].return_value = created

        result = await material_service.create_text_material(
            db, _make_user(), collection_id=10,
            material_name="Лекция", text_content="<p>текст</p>",
        )
        assert result.id == 5
        db.commit.assert_awaited_once()

    async def test_create_in_foreign_collection_raises_403(self, db, patched):
        patched["get_owned_collection"].side_effect = HTTPException(403, "нет доступа")
        with pytest.raises(HTTPException) as exc:
            await material_service.create_text_material(
                db, _make_user(), collection_id=999,
                material_name="Лекция", text_content="текст",
            )
        assert exc.value.status_code == 403
        patched["create_material"].assert_not_called()


class TestUpdateMaterialRules:
    async def test_text_content_on_file_material_raises_400(self, db, patched):
        """Нельзя менять text_content у файлового материала."""
        patched["get_material_by_id"].return_value = _make_material(
            source_type=SourceType.FILE,
        )
        patched["get_owned_collection"].return_value = MagicMock()

        with pytest.raises(HTTPException) as exc:
            await material_service.update_existing_material(
                db, 1, _make_user(), changes={"text_content": "новый"},
            )
        assert exc.value.status_code == 400

    async def test_text_content_null_raises_400(self, db, patched):
        patched["get_material_by_id"].return_value = _make_material(
            source_type=SourceType.TEXT,
        )
        patched["get_owned_collection"].return_value = MagicMock()

        with pytest.raises(HTTPException) as exc:
            await material_service.update_existing_material(
                db, 1, _make_user(), changes={"text_content": None},
            )
        assert exc.value.status_code == 400

    async def test_collection_id_null_raises_400(self, db, patched):
        patched["get_material_by_id"].return_value = _make_material()
        patched["get_owned_collection"].return_value = MagicMock()

        with pytest.raises(HTTPException) as exc:
            await material_service.update_existing_material(
                db, 1, _make_user(), changes={"collection_id": None},
            )
        assert exc.value.status_code == 400

    async def test_move_to_foreign_collection_raises_403(self, db, patched):
        material = _make_material()
        # 1-й get_owned_collection — проверка владения материалом (ок)
        # 2-й — проверка новой коллекции (чужая → 403)
        patched["get_material_by_id"].return_value = material
        patched["get_owned_collection"].side_effect = [
            MagicMock(),
            HTTPException(403, "нет доступа"),
        ]
        with pytest.raises(HTTPException) as exc:
            await material_service.update_existing_material(
                db, 1, _make_user(), changes={"collection_id": 999},
            )
        assert exc.value.status_code == 403

    async def test_valid_update_commits(self, db, patched):
        material = _make_material(source_type=SourceType.TEXT)
        patched["get_material_by_id"].return_value = material
        patched["get_owned_collection"].return_value = MagicMock()

        await material_service.update_existing_material(
            db, 1, _make_user(), changes={"material_name": "Новое имя"},
        )
        patched["update_material"].assert_awaited_once()
        db.commit.assert_awaited_once()


class TestCreateFileMaterialParser:
    async def test_parser_failure_does_not_break_creation(self, db, patched, monkeypatch):
        """Если парсер упал — материал всё равно создаётся (без extracted_text)."""
        patched["get_owned_collection"].return_value = MagicMock()
        created = _make_material(id=7, source_type=SourceType.FILE)
        patched["create_material"].return_value = created
        patched["get_material_by_id"].return_value = created

        # get_full_path вернёт «путь», а парсер в thread pool упадёт
        monkeypatch.setattr(material_service, "get_full_path", lambda p: "/abs/path")

        async def boom(*args, **kwargs):
            raise RuntimeError("parser crashed")

        monkeypatch.setattr(material_service.anyio.to_thread, "run_sync", boom)

        result = await material_service.create_file_material(
            db, _make_user(), collection_id=10,
            material_name="Документ", file_path="rel/path.pdf", file_size=123,
        )
        assert result.id == 7
        # материал создан с extracted_text=None
        _, kwargs = patched["create_material"].call_args
        assert kwargs["extracted_text"] is None
        db.commit.assert_awaited_once()

    async def test_parser_success_passes_text(self, db, patched, monkeypatch):
        patched["get_owned_collection"].return_value = MagicMock()
        created = _make_material(id=8, source_type=SourceType.FILE)
        patched["create_material"].return_value = created
        patched["get_material_by_id"].return_value = created

        monkeypatch.setattr(material_service, "get_full_path", lambda p: "/abs/path")

        async def ok(func, arg):
            return "извлечённый текст"

        monkeypatch.setattr(material_service.anyio.to_thread, "run_sync", ok)

        await material_service.create_file_material(
            db, _make_user(), collection_id=10,
            material_name="Документ", file_path="rel/path.pdf", file_size=123,
        )
        _, kwargs = patched["create_material"].call_args
        assert kwargs["extracted_text"] == "извлечённый текст"
