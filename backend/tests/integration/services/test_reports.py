"""Интеграционные тесты services/reports.py с реальной тестовой БД.

Покрывают:
    - get_materials_summary  — сводка с фильтрами;
    - iter_export_csv        — потоковый CSV-экспорт;
    - import_texts_from_csv  — импорт из CSV;
    - build_collection_files_zip — сборка ZIP.
"""

import csv
import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.models.collection import Collection
from app.models.material import Material, SourceType
from app.models.material_tag import material_tags
from app.models.tag import Tag
from app.services.reports import (
    build_collection_files_zip,
    get_materials_summary,
    import_texts_from_csv,
    iter_export_csv,
)


# ──────────────────────────────────────────
# Хелперы подготовки данных в тестовой БД
# ──────────────────────────────────────────
async def _make_collection(db, user, name="Физика"):
    collection = Collection(user_id=user.id, name=name)
    db.add(collection)
    await db.flush()
    return collection


async def _make_material(
    db, collection, *, name="Лекция", source_type=SourceType.TEXT,
    text_content="контент", extracted_text=None, file_path=None, file_size=None,
):
    material = Material(
        collection_id=collection.id,
        material_name=name,
        source_type=source_type,
        text_content=text_content,
        extracted_text=extracted_text,
        file_path=file_path,
        file_size=file_size,
    )
    db.add(material)
    await db.flush()
    return material


async def _make_tag(db, user, name="тег"):
    tag = Tag(user_id=user.id, tag_name=name)
    db.add(tag)
    await db.flush()
    return tag


async def _link(db, material, tag):
    await db.execute(
        material_tags.insert().values(material_id=material.id, tag_id=tag.id)
    )
    await db.flush()


# ══════════════════════════════════════════
# get_materials_summary
# ══════════════════════════════════════════
class TestMaterialsSummary:
    @pytest.mark.asyncio
    async def test_empty(self, db_session, test_user):
        summary = await get_materials_summary(db_session, test_user)
        assert summary["total"] == 0
        assert summary["byType"] == {"text": 0, "file": 0}
        assert summary["byCollection"] == []
        assert summary["byTag"] == []

    @pytest.mark.asyncio
    async def test_counts_by_type(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await _make_material(db_session, coll, source_type=SourceType.TEXT)
        await _make_material(db_session, coll, source_type=SourceType.TEXT)
        await _make_material(
            db_session, coll, source_type=SourceType.FILE,
            text_content=None, file_path="a/b.pdf", file_size=1024,
        )
        await db_session.commit()

        summary = await get_materials_summary(db_session, test_user)
        assert summary["total"] == 3
        assert summary["byType"] == {"text": 2, "file": 1}

    @pytest.mark.asyncio
    async def test_by_collection(self, db_session, test_user):
        c1 = await _make_collection(db_session, test_user, name="A")
        c2 = await _make_collection(db_session, test_user, name="B")
        await _make_material(db_session, c1)
        await _make_material(db_session, c1)
        await _make_material(db_session, c2)
        await db_session.commit()

        summary = await get_materials_summary(db_session, test_user)
        names = {row["name"]: row["count"] for row in summary["byCollection"]}
        assert names == {"A": 2, "B": 1}

    @pytest.mark.asyncio
    async def test_by_tag(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        material = await _make_material(db_session, coll)
        tag = await _make_tag(db_session, test_user, name="важное")
        await _link(db_session, material, tag)
        await db_session.commit()

        summary = await get_materials_summary(db_session, test_user)
        assert summary["byTag"] == [{"id": tag.id, "name": "важное", "count": 1}]

    @pytest.mark.asyncio
    async def test_search_filter(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await _make_material(db_session, coll, name="Квантовая физика")
        await _make_material(db_session, coll, name="История")
        await db_session.commit()

        summary = await get_materials_summary(db_session, test_user, q="квант")
        assert summary["total"] == 1

    @pytest.mark.asyncio
    async def test_collection_filter(self, db_session, test_user):
        c1 = await _make_collection(db_session, test_user, name="A")
        c2 = await _make_collection(db_session, test_user, name="B")
        await _make_material(db_session, c1)
        await _make_material(db_session, c2)
        await db_session.commit()

        summary = await get_materials_summary(
            db_session, test_user, collection_id=c1.id,
        )
        assert summary["total"] == 1


# ══════════════════════════════════════════
# iter_export_csv
# ══════════════════════════════════════════
class TestExportCsv:
    async def _collect(self, db_session, test_user, **kwargs):
        chunks = []
        async for chunk in iter_export_csv(db_session, test_user, **kwargs):
            chunks.append(chunk)
        return "".join(chunks)

    @pytest.mark.asyncio
    async def test_has_bom_and_header(self, db_session, test_user):
        content = await self._collect(db_session, test_user)
        assert content.startswith("\ufeff")
        assert "title,description,type,collection,tags,content" in content

    @pytest.mark.asyncio
    async def test_exports_text_material(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user, name="Колл")
        await _make_material(
            db_session, coll, name="Заголовок",
            text_content="Тело материала",
        )
        await db_session.commit()

        content = await self._collect(db_session, test_user)
        rows = list(csv.reader(io.StringIO(content.lstrip("\ufeff"))))
        # rows[0] — заголовок, rows[1] — данные
        assert rows[1][0] == "Заголовок"
        assert rows[1][2] == SourceType.TEXT
        assert rows[1][3] == "Колл"
        assert rows[1][5] == "Тело материала"

    @pytest.mark.asyncio
    async def test_file_material_no_content(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await _make_material(
            db_session, coll, source_type=SourceType.FILE,
            text_content=None, extracted_text="извлечённый текст",
            file_path="x.pdf", file_size=2048,
        )
        await db_session.commit()

        content = await self._collect(db_session, test_user)
        rows = list(csv.reader(io.StringIO(content.lstrip("\ufeff"))))
        assert rows[1][5] == ""


# ══════════════════════════════════════════
# import_texts_from_csv
# ══════════════════════════════════════════
class TestImportCsv:
    @pytest.mark.asyncio
    async def test_empty_file_raises(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await db_session.commit()
        with pytest.raises(HTTPException) as exc:
            await import_texts_from_csv(
                db_session, test_user, collection_id=coll.id, file_bytes=b"",
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_missing_columns_raises(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await db_session.commit()
        with pytest.raises(HTTPException) as exc:
            await import_texts_from_csv(
                db_session, test_user, collection_id=coll.id,
                file_bytes=b"foo,bar\n1,2\n",
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_successful_import(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await db_session.commit()
        csv_bytes = (
            "title,content,tags\n"
            "Лекция 1,Текст один,физика;важное\n"
            "Лекция 2,Текст два,\n"
        ).encode("utf-8")

        result = await import_texts_from_csv(
            db_session, test_user, collection_id=coll.id, file_bytes=csv_bytes,
        )
        assert result["createdCount"] == 2
        assert result["skippedCount"] == 0
        assert result["errors"] == []

    @pytest.mark.asyncio
    async def test_skips_rows_without_title_or_content(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await db_session.commit()
        csv_bytes = (
            "title,content\n"
            ",пусто без title\n"
            "Без контента,\n"
            "Норм,Контент\n"
        ).encode("utf-8")

        result = await import_texts_from_csv(
            db_session, test_user, collection_id=coll.id, file_bytes=csv_bytes,
        )
        assert result["createdCount"] == 1
        assert result["skippedCount"] == 2
        assert len(result["errors"]) == 2

    @pytest.mark.asyncio
    async def test_reuses_existing_tag(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await _make_tag(db_session, test_user, name="физика")
        await db_session.commit()

        csv_bytes = (
            "title,content,tags\n"
            "М1,Т1,Физика\n"  
        ).encode("utf-8")

        result = await import_texts_from_csv(
            db_session, test_user, collection_id=coll.id, file_bytes=csv_bytes,
        )
        assert result["createdCount"] == 1

        count = (
            await db_session.execute(
                select(func.count())
                .select_from(Tag)
                .where(Tag.user_id == test_user.id)
            )
        ).scalar_one()
        assert count == 1

    @pytest.mark.asyncio
    async def test_bad_encoding_raises(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await db_session.commit()
        # Невалидный UTF-8 байт
        with pytest.raises(HTTPException) as exc:
            await import_texts_from_csv(
                db_session, test_user, collection_id=coll.id,
                file_bytes=b"title,content\n\xff\xfe,x\n",
            )
        assert exc.value.status_code == 400


# ══════════════════════════════════════════
# build_collection_files_zip
# ══════════════════════════════════════════
class TestBuildZip:
    @pytest.mark.asyncio
    async def test_zip_with_missing_files_marks_skipped(
        self, db_session, test_user,
    ):
        coll = await _make_collection(db_session, test_user)
        await _make_material(
            db_session, coll, source_type=SourceType.FILE,
            text_content=None, file_path="nonexistent/file.pdf",
            file_size=512,
        )
        await db_session.commit()

        tmp_path, filename = await build_collection_files_zip(
            db_session, test_user, collection_id=coll.id,
        )
        try:
            assert filename.endswith(".zip")
            with zipfile.ZipFile(tmp_path) as archive:
                manifest = json.loads(archive.read("manifest.json"))
            assert manifest["stats"]["skippedFiles"] == 1
            assert manifest["stats"]["exportedFiles"] == 0
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_zip_with_empty_collection(self, db_session, test_user):
        coll = await _make_collection(db_session, test_user)
        await db_session.commit()

        tmp_path, filename = await build_collection_files_zip(
            db_session, test_user, collection_id=coll.id,
        )
        try:
            with zipfile.ZipFile(tmp_path) as archive:
                manifest = json.loads(archive.read("manifest.json"))
            assert manifest["stats"]["totalFileMaterials"] == 0
        finally:
            Path(tmp_path).unlink(missing_ok=True)
