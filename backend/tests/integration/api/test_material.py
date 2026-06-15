"""Интеграционные тесты материалов: CRUD текста, валидация имени (баг №6),
форматы файлов (баг №3).

Путь BASE берём из settings.API_PREFIX, чтобы не зависеть от префикса роутера.
Имя поля коллекции определяем автоматически (collection_name / name / title).
"""

import io

import pytest

from app.core.config import settings
from app.models.collection import Collection

BASE = f"{settings.API_PREFIX}/materials"


# ──────────────────────────────────────────
# Коллекция текущего юзера.
# Имя текстового поля определяем автоматически — чтобы не зависеть
# от конкретного имени колонки в модели Collection.
# ──────────────────────────────────────────
def _collection_name_field() -> str:
    for candidate in ("collection_name", "name", "title"):
        if hasattr(Collection, candidate):
            return candidate
    raise RuntimeError(
        "Не нашёл текстовое поле имени у модели Collection — "
        "проверь app/models/collection.py"
    )


@pytest.fixture
async def collection_id(db_session, test_user) -> int:
    name_field = _collection_name_field()
    coll = Collection(**{name_field: "Тестовая"}, user_id=test_user.id)
    db_session.add(coll)
    await db_session.commit()
    await db_session.refresh(coll)
    return coll.id


# ══════════════════════════════════════════
# CRUD текстового материала
# ══════════════════════════════════════════
class TestTextMaterialCrud:
    async def test_create(self, client, collection_id):
        resp = await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "Конспект",
            "text_content": "<p>текст</p>",
        })
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["material_name"] == "Конспект"
        assert data["source_type"].lower() == "text"

    async def test_get_by_id(self, client, collection_id):
        created = await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "Для чтения",
            "text_content": "<p>x</p>",
        })
        assert created.status_code == 201, created.text
        mid = created.json()["id"]
        resp = await client.get(f"{BASE}/{mid}")
        assert resp.status_code == 200
        assert resp.json()["id"] == mid

    async def test_list(self, client, collection_id):
        await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "В списке",
            "text_content": "<p>x</p>",
        })
        resp = await client.get(BASE)
        assert resp.status_code == 200
        assert "В списке" in {m["material_name"] for m in resp.json()}

    async def test_update_name(self, client, collection_id):
        created = await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "Старое",
            "text_content": "<p>x</p>",
        })
        assert created.status_code == 201, created.text
        mid = created.json()["id"]
        resp = await client.patch(f"{BASE}/{mid}", json={"material_name": "Новое"})
        assert resp.status_code == 200
        assert resp.json()["material_name"] == "Новое"

    async def test_delete(self, client, collection_id):
        created = await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "Удалить",
            "text_content": "<p>x</p>",
        })
        assert created.status_code == 201, created.text
        mid = created.json()["id"]
        assert (await client.delete(f"{BASE}/{mid}")).status_code == 204
        assert (await client.get(f"{BASE}/{mid}")).status_code == 404

    async def test_get_nonexistent(self, client):
        assert (await client.get(f"{BASE}/999999")).status_code == 404


# ══════════════════════════════════════════
# Валидация имени и контента (баг №6)
# ══════════════════════════════════════════
class TestValidation:
    @pytest.mark.parametrize("name", ["", "   ", "\t\n"])
    async def test_blank_name_rejected(self, client, collection_id, name):
        resp = await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": name,
            "text_content": "<p>x</p>",
        })
        assert resp.status_code == 422

    async def test_empty_text_rejected(self, client, collection_id):
        resp = await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "Норм",
            "text_content": "",
        })
        assert resp.status_code == 422

    async def test_name_trimmed(self, client, collection_id):
        resp = await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "  Лекция 1  ",
            "text_content": "<p>x</p>",
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["material_name"] == "Лекция 1"

    async def test_nonexistent_collection(self, client):
        """Несуществующая коллекция → 404 (collection_id в схеме
        не ограничен gt=0, проверка существования — в сервисе)."""
        resp = await client.post(f"{BASE}/text", json={
            "collection_id": 999999,
            "material_name": "X",
            "text_content": "<p>x</p>",
        })
        assert resp.status_code == 404


# ══════════════════════════════════════════
# Файлы и форматы (баг №3)
# ══════════════════════════════════════════
class TestFileUpload:
    async def test_upload_txt(self, client, collection_id):
        files = {"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")}
        data = {"collection_id": str(collection_id), "material_name": "Файл"}
        resp = await client.post(f"{BASE}/file", data=data, files=files)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["source_type"].lower() == "file"
        assert body["file_size"] == 5

    async def test_unsupported_extension(self, client, collection_id):
        files = {"file": ("x.exe", io.BytesIO(b"MZ"), "application/octet-stream")}
        data = {"collection_id": str(collection_id), "material_name": "Бинарь"}
        resp = await client.post(f"{BASE}/file", data=data, files=files)
        assert resp.status_code == 415

    async def test_empty_name_in_form(self, client, collection_id):
        files = {"file": ("notes.txt", io.BytesIO(b"x"), "text/plain")}
        data = {"collection_id": str(collection_id), "material_name": ""}
        resp = await client.post(f"{BASE}/file", data=data, files=files)
        assert resp.status_code == 422  # Form(min_length=1)

    async def test_download(self, client, collection_id):
        files = {"file": ("doc.txt", io.BytesIO(b"content"), "text/plain")}
        data = {"collection_id": str(collection_id), "material_name": "Скачать"}
        created = await client.post(f"{BASE}/file", data=data, files=files)
        assert created.status_code == 201, created.text
        mid = created.json()["id"]
        resp = await client.get(f"{BASE}/{mid}/file")
        assert resp.status_code == 200
        assert resp.content == b"content"

# ══════════════════════════════════════════
# Отчёты: пагинация, поиск, сводка, экспорт
# ══════════════════════════════════════════
class TestReports:
    async def test_paginated(self, client, collection_id):
        for i in range(3):
            await client.post(f"{BASE}/text", json={
                "collection_id": collection_id,
                "material_name": f"M{i}",
                "text_content": "<p>x</p>",
            })
        resp = await client.get(
            f"{BASE}/paginated",
            params={"collection_id": collection_id, "limit": 2, "offset": 0},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total"] == 3
        assert len(body["items"]) == 2
        assert body["has_more"] is True

    async def test_search(self, client, collection_id):
        await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "Уникум",
            "text_content": "<p>x</p>",
        })
        resp = await client.get(f"{BASE}/search", params={"q": "Уникум"})
        assert resp.status_code == 200
        assert "Уникум" in {m["material_name"] for m in resp.json()}

    async def test_summary(self, client, collection_id):
        await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "S1",
            "text_content": "<p>x</p>",
        })
        resp = await client.get(f"{BASE}/summary")
        assert resp.status_code == 200, resp.text
        assert resp.json()["total"] >= 1

    async def test_export_csv(self, client, collection_id):
        await client.post(f"{BASE}/text", json={
            "collection_id": collection_id,
            "material_name": "CSV",
            "text_content": "<p>x</p>",
        })
        resp = await client.get(f"{BASE}/export.csv")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]

    async def test_export_files_zip(self, client, collection_id):
        files = {"file": ("z.txt", io.BytesIO(b"zip"), "text/plain")}
        data = {"collection_id": str(collection_id), "material_name": "ВZip"}
        await client.post(f"{BASE}/file", data=data, files=files)
        resp = await client.get(
            f"{BASE}/export-files.zip", params={"collection_id": collection_id}
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

    async def test_import_wrong_extension(self, client, collection_id):
        files = {"file": ("data.txt", io.BytesIO(b"foo"), "text/plain")}
        resp = await client.post(
            f"{BASE}/import.csv",
            params={"collection_id": collection_id},
            files=files,
        )
        assert resp.status_code == 400, resp.text

    async def test_delete_file_material(self, client, collection_id):
        """Удаление файлового материала идёт по ветке if file_path."""
        files = {"file": ("del.txt", io.BytesIO(b"x"), "text/plain")}
        data = {"collection_id": str(collection_id), "material_name": "ФайлДель"}
        created = await client.post(f"{BASE}/file", data=data, files=files)
        mid = created.json()["id"]
        assert (await client.delete(f"{BASE}/{mid}")).status_code == 204
