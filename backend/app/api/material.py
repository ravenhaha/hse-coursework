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

# Запрещённые в именах файлов символы (Windows + Linux).
_FILENAME_BAD_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

# Размер чанка для стримингового чтения загружаемого файла.
# 1 MB — компромисс между числом await'ов и памятью.
_UPLOAD_CHUNK_SIZE = 1024 * 1024


def _safe_download_filename(
    material_name: str,
    file_path: str,
    material_id: int,
) -> str:
    """Формирует безопасное имя файла для скачивания.

    Берёт material_name (как юзер назвал материал) + расширение из file_path.
    Запрещённые символы заменяет на '_'. Если после очистки имя пустое —
    fallback к 'material_{id}'.
    """
    ext = Path(file_path).suffix  # .pdf, .docx, ...
    clean = _FILENAME_BAD_CHARS.sub("_", material_name).strip(" .")
    if not clean:
        clean = f"material_{material_id}"
    return f"{clean}{ext}"


async def _read_upload_with_limit(
    file: UploadFile,
    max_size: int,
) -> bytes:
    """Читает UploadFile чанками с inflight-проверкой размера.

    Защита от DDoS: если юзер шлёт огромный файл, мы не качаем его
    целиком в память, а проверяем размер на лету и бросаем 413,
    как только превысили лимит.
    """
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
    """Загрузить файл и создать материал.

    Валидация:
      - Расширение из белого списка (ALLOWED_MATERIAL_EXTENSIONS).
      - Размер не больше settings.MAX_MATERIAL_FILE_SIZE (проверка inflight).

    Если запись в БД не удалась — файл с диска удаляется (rollback).
    """
    # --- 1. Валидация расширения ---
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_MATERIAL_EXTENSIONS:
        unsupported_media_type(f"Расширение {ext!r} не поддерживается")

    # --- 2. Стриминговое чтение с inflight-проверкой размера ---
    # Если юзер шлёт 1GB — мы не дочитаем до конца, а прервёмся
    # как только превысим MAX_MATERIAL_FILE_SIZE.
    content = await _read_upload_with_limit(
        file, settings.MAX_MATERIAL_FILE_SIZE
    )

    # --- 3. Сохранение на диск ---
    relative_path, file_size = await save_material(
        user_id=user.id,
        filename=file.filename or f"upload{ext}",
        content=content,
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
        # Чистим осиротевший файл, чтобы не было мусора на диске.
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
    """Материалы юзера.

    - collection_id=null  → все материалы юзера (для построения дерева)
    - collection_id=<id>  → только из указанной коллекции
    """
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
    """Частичное обновление материала.

    Используем model_fields_set, чтобы различать:
      - поле не передано в JSON → не трогаем
      - поле передано как null → пробуем установить (если бизнес-логика разрешит)
    """
    # Берём только реально присланные поля (PATCH-семантика).
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
    file_path = mat.file_path  # запоминаем до удаления из БД

    await delete_existing_material(db, material_id=material_id, user=user)

    # Чистим файл уже после успешного коммита в БД.
    if file_path:
        await delete_file(file_path)


# ══════════════════════════════════════════
# Скачивание файла
# ══════════════════════════════════════════

@router.get("/{material_id}/file")
async def download_file(material_id: int, db: DB, user: CurrentUser):
    """Отдать файл материала с правильным именем.

    Имя файла = material_name юзера + расширение из file_path.
    Кириллица в имени работает корректно благодаря RFC 5987
    (Starlette автоматически добавляет filename*=UTF-8'').
    """
    mat = await get_material(db, material_id=material_id, user=user)

    if mat.source_type != "file" or not mat.file_path:
        bad_request("У этого материала нет файла")

    full_path = get_full_path(mat.file_path)
    if full_path is None or not full_path.exists():
        material_not_found()

    filename = _safe_download_filename(mat.material_name, mat.file_path, mat.id)
    return FileResponse(path=full_path, filename=filename)