from __future__ import annotations

import csv
import html as html_lib
import io
import json
import re
import tempfile
import zipfile
from collections import defaultdict
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import Select, and_, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import LIKE_ESCAPE_CHAR, escape_like
from app.core.exceptions import bad_request
from app.core.file_storage import get_full_path
from app.crud.material import create_material
from app.crud.tag import create_tag, get_tag_by_name_ci, link_material_tag
from app.models.collection import Collection
from app.models.material import Material, SourceType
from app.models.material_tag import material_tags
from app.models.tag import Tag
from app.models.user import User
from app.services.collection import get_owned_collection


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_ZIP_BAD_CHARS_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _build_filtered_stmt(
    *,
    user_id: int,
    q: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> Select:
    """Базовый SELECT материалов с теми же фильтрами, что /materials/search."""
    stmt = (
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .where(Collection.user_id == user_id)
    )

    if collection_id is not None:
        stmt = stmt.where(Material.collection_id == collection_id)

    if q:
        pattern = f"%{escape_like(q)}%"
        stmt = stmt.where(
            or_(
                Material.material_name.ilike(pattern, escape=LIKE_ESCAPE_CHAR),
                Material.text_content.ilike(pattern, escape=LIKE_ESCAPE_CHAR),
                Material.extracted_text.ilike(pattern, escape=LIKE_ESCAPE_CHAR),
            )
        )

    if tag_ids:
        stmt = stmt.where(
            Material.id.in_(
                select(material_tags.c.material_id).where(
                    material_tags.c.tag_id.in_(tag_ids),
                )
            )
        )

    return stmt


def _html_to_text_snippet(value: str | None, max_len: int = 160) -> str:
    """Убирает HTML-теги и сжимает пробелы для description/snippet."""
    if not value:
        return ""

    text = _HTML_TAG_RE.sub(" ", value)
    text = html_lib.unescape(text)
    text = _WS_RE.sub(" ", text).strip()
    return text[:max_len]


def _safe_zip_name(value: str | None, fallback: str) -> str:
    """Безопасное имя файла/архива."""
    clean = _ZIP_BAD_CHARS_RE.sub("_", str(value or "").strip()).strip(" .")
    return clean or fallback


def _build_zip_entry_name(
    material_name: str,
    file_path: str,
    material_id: int,
    used_names: set[str],
) -> str:
    """Уникальное имя файла внутри ZIP."""
    ext = Path(file_path).suffix
    base = _safe_zip_name(material_name, f"material_{material_id}")

    if ext and not base.lower().endswith(ext.lower()):
        base = f"{base}{ext}"

    stem = Path(base).stem
    suffix = Path(base).suffix

    candidate = f"files/{base}"
    index = 1

    while candidate in used_names:
        candidate = f"files/{stem} ({index}){suffix}"
        index += 1

    used_names.add(candidate)
    return candidate


async def get_materials_summary(
    db: AsyncSession,
    user: User,
    *,
    q: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
    top_tags: int = 50,
) -> dict[str, Any]:
    """Сводка по текущей выборке материалов."""
    if collection_id is not None:
        await get_owned_collection(db, collection_id, user)

    base_subq = (
        _build_filtered_stmt(
            user_id=user.id,
            q=q,
            collection_id=collection_id,
            tag_ids=tag_ids,
        )
        .with_only_columns(Material.id, Material.source_type, Material.collection_id)
        .subquery()
    )

    total = (
        await db.execute(
            select(func.count()).select_from(base_subq),
        )
    ).scalar_one()

    type_rows = await db.execute(
        select(base_subq.c.source_type, func.count())
        .select_from(base_subq)
        .group_by(base_subq.c.source_type)
    )
    by_type_map: dict[str, int] = defaultdict(int)
    for source_type, count in type_rows.all():
        by_type_map[str(source_type)] += int(count)

    by_type = {
        "text": by_type_map.get("text", 0),
        "file": by_type_map.get("file", 0),
    }

    collection_rows = await db.execute(
        select(Collection.id, Collection.name, func.count())
        .select_from(base_subq)
        .join(Collection, Collection.id == base_subq.c.collection_id)
        .group_by(Collection.id, Collection.name)
        .order_by(func.count().desc(), Collection.name)
    )
    by_collection = [
        {"id": collection_id_, "name": name, "count": int(count)}
        for collection_id_, name, count in collection_rows.all()
    ]

    tag_rows = await db.execute(
        select(Tag.id, Tag.tag_name, func.count())
        .select_from(base_subq)
        .join(material_tags, material_tags.c.material_id == base_subq.c.id)
        .join(
            Tag,
            and_(
                Tag.id == material_tags.c.tag_id,
                Tag.user_id == user.id,
            ),
        )
        .group_by(Tag.id, Tag.tag_name)
        .order_by(func.count().desc(), Tag.tag_name)
        .limit(top_tags)
    )
    by_tag = [
        {"id": tag_id, "name": name, "count": int(count)}
        for tag_id, name, count in tag_rows.all()
    ]

    return {
        "total": int(total),
        "byType": by_type,
        "byCollection": by_collection,
        "byTag": by_tag,
    }


async def iter_export_csv(
    db: AsyncSession,
    user: User,
    *,
    q: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> AsyncIterator[str]:
    """Потоковый CSV-экспорт текущей выборки материалов."""
    if collection_id is not None:
        await get_owned_collection(db, collection_id, user)

    filtered_ids = (
        _build_filtered_stmt(
            user_id=user.id,
            q=q,
            collection_id=collection_id,
            tag_ids=tag_ids,
        )
        .with_only_columns(Material.id)
        .subquery()
    )

    result = await db.execute(
        select(
            Material.id,
            Material.material_name,
            Material.source_type,
            Material.text_content,
            Material.extracted_text,
            Collection.name.label("collection_name"),
            func.coalesce(
                func.string_agg(func.distinct(Tag.tag_name), literal(";")),
                literal(""),
            ).label("tags"),
        )
        .select_from(filtered_ids)
        .join(Material, Material.id == filtered_ids.c.id)
        .join(Collection, Material.collection_id == Collection.id)
        .join(material_tags, material_tags.c.material_id == Material.id, isouter=True)
        .join(
            Tag,
            and_(
                Tag.id == material_tags.c.tag_id,
                Tag.user_id == user.id,
            ),
            isouter=True,
        )
        .group_by(
            Material.id,
            Material.material_name,
            Material.source_type,
            Material.text_content,
            Material.extracted_text,
            Collection.name,
            Material.created_at,
        )
        .order_by(Material.created_at.desc(), Material.id.desc())
    )

    yield "\ufeff"

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")

    writer.writerow(["title", "description", "type", "collection", "tags", "content"])
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    for (
        _material_id,
        title,
        source_type,
        text_content,
        extracted_text,
        collection_name,
        tags_joined,
    ) in result.all():
        source_type_value = str(source_type)
        is_text = source_type_value == SourceType.TEXT

        description = (
            _html_to_text_snippet(text_content or extracted_text, 160)
            if is_text
            else _html_to_text_snippet(extracted_text, 160)
        )
        content = text_content if is_text else ""

        writer.writerow(
            [
                title,
                description,
                source_type_value,
                collection_name or "",
                tags_joined or "",
                content,
            ]
        )
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


async def build_collection_files_zip(
    db: AsyncSession,
    user: User,
    *,
    collection_id: int,
) -> tuple[Path, str]:
    """Собирает ZIP со всеми файловыми материалами выбранной коллекции."""
    collection = await get_owned_collection(db, collection_id, user)

    result = await db.execute(
        select(
            Material.id,
            Material.material_name,
            Material.file_path,
            Material.file_size,
            Material.created_at,
            Material.updated_at,
        )
        .where(
            Material.collection_id == collection_id,
            Material.source_type == SourceType.FILE,
        )
        .order_by(Material.created_at.desc(), Material.id.desc())
    )

    rows = result.all()

    tmp_file = tempfile.NamedTemporaryFile(
        prefix="materials_files_",
        suffix=".zip",
        delete=False,
    )
    tmp_path = Path(tmp_file.name)
    tmp_file.close()

    used_names: set[str] = set()
    exported_files: list[dict[str, Any]] = []
    skipped_files: list[dict[str, Any]] = []

    manifest: dict[str, Any] = {
        "format": "collection-files-bundle",
        "version": 1,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "collection": {
            "id": collection.id,
            "name": collection.name,
        },
        "stats": {
            "totalFileMaterials": len(rows),
            "exportedFiles": 0,
            "skippedFiles": 0,
        },
        "files": exported_files,
        "skipped": skipped_files,
    }

    try:
        with zipfile.ZipFile(
            tmp_path,
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
        ) as archive:
            for (
                material_id,
                material_name,
                file_path,
                file_size,
                created_at,
                updated_at,
            ) in rows:
                if not file_path:
                    skipped_files.append(
                        {
                            "materialId": material_id,
                            "title": material_name,
                            "reason": "У материала отсутствует file_path",
                        }
                    )
                    continue

                full_path = get_full_path(file_path)
                if full_path is None or not full_path.exists() or not full_path.is_file():
                    skipped_files.append(
                        {
                            "materialId": material_id,
                            "title": material_name,
                            "filePath": file_path,
                            "reason": "Файл не найден на диске",
                        }
                    )
                    continue

                archive_path = _build_zip_entry_name(
                    material_name=material_name,
                    file_path=file_path,
                    material_id=material_id,
                    used_names=used_names,
                )

                archive.write(full_path, arcname=archive_path)

                exported_files.append(
                    {
                        "materialId": material_id,
                        "title": material_name,
                        "archivePath": archive_path,
                        "filePath": file_path,
                        "size": int(file_size or full_path.stat().st_size),
                        "createdAt": created_at.isoformat() if created_at else None,
                        "updatedAt": updated_at.isoformat() if updated_at else None,
                    }
                )

            manifest["stats"]["exportedFiles"] = len(exported_files)
            manifest["stats"]["skippedFiles"] = len(skipped_files)

            archive.writestr(
                "manifest.json",
                json.dumps(manifest, ensure_ascii=False, indent=2),
            )

    except Exception:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    archive_filename = (
        f"{_safe_zip_name(collection.name, f'collection_{collection.id}')}"
        f"_files_{stamp}.zip"
    )

    return tmp_path, archive_filename


async def import_texts_from_csv(
    db: AsyncSession,
    user: User,
    *,
    collection_id: int,
    file_bytes: bytes,
) -> dict[str, Any]:
    """Импорт текстовых материалов из CSV в выбранную коллекцию."""
    await get_owned_collection(db, collection_id, user)

    if not file_bytes:
        bad_request("CSV-файл пустой")

    try:
        text_data = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        bad_request("CSV должен быть в UTF-8")

    reader = csv.DictReader(io.StringIO(text_data, newline=""))

    if not reader.fieldnames:
        bad_request("CSV должен содержать строку заголовков")

    field_map = {
        field_name.lower().strip(): field_name
        for field_name in reader.fieldnames
        if field_name is not None
    }

    if "title" not in field_map or "content" not in field_map:
        bad_request("CSV должен содержать колонки 'title' и 'content'")

    def _get(row: dict[str, Any], key: str) -> str:
        source_key = field_map.get(key, key)
        return str(row.get(source_key) or "").strip()

    created_count = 0
    skipped_count = 0
    errors: list[dict[str, Any]] = []
    tags_cache: dict[str, int] = {}

    line_no = 1  # header

    for row in reader:
        line_no += 1

        if not row or not any(str(value or "").strip() for value in row.values()):
            continue

        title = _get(row, "title")
        content = _get(row, "content")
        tags_raw = _get(row, "tags")

        if not title or not content:
            skipped_count += 1
            errors.append(
                {
                    "row": line_no,
                    "message": "title и content обязательны",
                }
            )
            continue

        row_new_tags: dict[str, int] = {}

        try:
            async with db.begin_nested():
                material = await create_material(
                    db,
                    collection_id=collection_id,
                    material_name=title,
                    source_type=SourceType.TEXT,
                    text_content=content,
                )

                if tags_raw:
                    tag_names = [tag.strip() for tag in tags_raw.split(";") if tag.strip()]
                    unique_tag_names = list(dict.fromkeys(tag_names))

                    for tag_name in unique_tag_names:
                        tag_key = tag_name.casefold()
                        tag_id = tags_cache.get(tag_key)

                        if tag_id is None:
                            existing_tag = await get_tag_by_name_ci(db, user.id, tag_name)
                            if existing_tag is None:
                                existing_tag = await create_tag(db, user.id, tag_name)

                            tag_id = existing_tag.id
                            row_new_tags[tag_key] = tag_id

                        await link_material_tag(db, material.id, tag_id)

            tags_cache.update(row_new_tags)
            created_count += 1

        except Exception as exc:
            skipped_count += 1
            errors.append(
                {
                    "row": line_no,
                    "message": f"Ошибка импорта строки: {exc.__class__.__name__}",
                }
            )

    await db.commit()

    return {
        "createdCount": created_count,
        "skippedCount": skipped_count,
        "errors": errors,
    }