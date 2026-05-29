"""Роуты материалов: создание (текст/файл), чтение, поиск,
обновление, удаление, скачивание файла."""

import re
from pathlib import Path

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.constants import ALLOWED_MATERIAL_EXTENSIONS
from app.core.dependencies import CurrentUser, DB
from app.core.exceptions import (
    bad_request,
    file_too_large,
    material_not_found,
    unsupported_media_type,
)
from app.core.file_storage import delete_file, get_full_path, save_material
from app.models.material import SourceType
from app.schemas.material import MaterialCreateText, MaterialRead, MaterialUpdate
from app.services.material import (
    create_file_material,
    create_text_material,
    delete_existing_material,
    get_material,
    list_materials,
    search_materials,
    update_existing_material,
)

router = APIRouter(prefix="/materials", tags=["Materials"])


# ══════════════════════════════════════════
# Хелперы
# ══════════════════════════════════════════
_FILENAME_BAD_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_UPLOAD_CHUNK_SIZE = 1024 * 1024


def _safe_download_filename(
    material_name: str,
    file_path: str,
    material_id: int,
) -> str:
    """Формирует безопасное имя файла для скачивания."""
    ext = Path(file_path).suffix
    clean = _FILENAME_BAD_CHARS.sub("_", material_name).strip(" .")
    if not clean:
        clean = f"material_{material_id}"
    return f"{clean}{ext}"


async def _read_upload_with_limit(
    file: UploadFile,
    max_size: int,
) -> bytes:
    """Читает UploadFile чанками с inflight-проверкой размера."""
    total = 0
    chunks: list[bytes] = []
    while True:
        chunk = await file.read(_UPLOAD_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_size:
            file_too_large(
                f"Файл больше {max_size // (1024 * 1024)} MB"
            )
        chunks.append(chunk)
    return b"".join(chunks)


# ══════════════════════════════════════════
# Создание
# ══════════════════════════════════════════

@router.post(
    "/text",
    response_model=MaterialRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_text(body: MaterialCreateText, db: DB, user: CurrentUser):
    """Создать текстовый материал (HTML из TipTap-редактора)."""
    return await create_text_material(
        db,
        user=user,
        collection_id=body.collection_id,
        material_name=body.material_name,
        text_content=body.text_content,
    )


@router.post(
    "/file",
    response_model=MaterialRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_file(
    db: DB,
    user: CurrentUser,
    collection_id: int = Form(...),
    material_name: str = Form(..., min_length=1, max_length=255),
    file: UploadFile = File(...),
):
    """Загрузить файл и создать материал."""
    # --- 1. Валидация расширения ---
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_MATERIAL_EXTENSIONS:
        unsupported_media_type(f"Расширение {ext!r} не поддерживается")

    # --- 2. Стриминговое чтение с inflight-проверкой размера ---
    content = await _read_upload_with_limit(
        file, settings.MAX_MATERIAL_FILE_SIZE
    )

    # --- 3. Сохранение на диск ---
    # ⚠️ ВАЖНО: имена аргументов должны совпадать с file_storage.save_material —
    # original_filename / file_content, иначе TypeError на каждой загрузке.
    relative_path, file_size = await save_material(
        user_id=user.id,
        original_filename=file.filename or f"upload{ext}",
        file_content=content,
    )

    # --- 4. Создание записи в БД с rollback файла при ошибке ---
    try:
        return await create_file_material(
            db,
            user=user,
            collection_id=collection_id,
            material_name=material_name,
            file_path=str(relative_path),
            file_size=file_size,
        )
    except Exception:
        await delete_file(relative_path)
        raise


# ══════════════════════════════════════════
# Чтение
# ══════════════════════════════════════════

@router.get("", response_model=list[MaterialRead])
async def list_(
    db: DB,
    user: CurrentUser,
    collection_id: int | None = Query(None),
):
    """Материалы юзера."""
    return await list_materials(db, user=user, collection_id=collection_id)


@router.get("/search", response_model=list[MaterialRead])
async def search(
    db: DB,
    user: CurrentUser,
    q: str = Query("", description="Подстрока для поиска"),
    collection_id: int | None = Query(None),
    tag_ids: list[int] = Query(default_factory=list),
):
    """Поиск по material_name, text_content, extracted_text + фильтры."""
    return await search_materials(
        db,
        user=user,
        query_str=q,
        collection_id=collection_id,
        tag_ids=tag_ids,
    )


@router.get("/{material_id}", response_model=MaterialRead)
async def get_one(material_id: int, db: DB, user: CurrentUser):
    """Один материал по id."""
    return await get_material(db, material_id=material_id, user=user)


# ══════════════════════════════════════════
# Обновление и удаление
# ══════════════════════════════════════════

@router.patch("/{material_id}", response_model=MaterialRead)
async def update(
    material_id: int,
    body: MaterialUpdate,
    db: DB,
    user: CurrentUser,
):
    """Частичное обновление материала."""
    changes = body.model_dump(include=body.model_fields_set)

    return await update_existing_material(
        db,
        material_id=material_id,
        user=user,
        changes=changes,
    )


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(material_id: int, db: DB, user: CurrentUser):
    """Удалить материал. Если есть файл — удаляем и его с диска."""
    mat = await get_material(db, material_id=material_id, user=user)
    file_path = mat.file_path

    await delete_existing_material(db, material_id=material_id, user=user)
    if file_path:
        await delete_file(file_path)


# ══════════════════════════════════════════
# Скачивание файла
# ══════════════════════════════════════════

@router.get("/{material_id}/file")
async def download_file(material_id: int, db: DB, user: CurrentUser):
    """Отдать файл материала с правильным именем."""
    mat = await get_material(db, material_id=material_id, user=user)

    if mat.source_type != SourceType.FILE or not mat.file_path:
        bad_request("У этого материала нет файла")

    full_path = get_full_path(mat.file_path)
    if full_path is None or not full_path.exists():
        material_not_found()

    filename = _safe_download_filename(mat.material_name, mat.file_path, mat.id)
    return FileResponse(path=full_path, filename=filename)