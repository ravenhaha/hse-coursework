"""Сервис материалов.

Бизнес-правила:
  - материал принадлежит коллекции, коллекция — юзеру;
  - доступ к материалу = доступ к его коллекции;
  - при загрузке файла извлекаем текст (для поиска и превью).

Обработка ошибок:
  - get_owned_material не оборачивает исключения get_owned_collection
    в "доступ к материалу запрещён". Если коллекция недоступна (404/403),
    исключение пробрасывается наружу как есть — FastAPI вернёт корректный
    статус. Это и проще, и семантически правильнее.
"""

import logging

import anyio

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import bad_request, material_not_found
from app.core.file_parser import extract_text_from_file
from app.core.file_storage import get_full_path
from app.crud.material import (
    create_material,
    delete_material,
    get_material_by_id,
    list_all_user_materials,
    list_materials_by_collection,
    search_materials as search_materials_query,
    update_material,
)
from app.models.material import Material
from app.models.user import User
from app.services.collection import get_owned_collection

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════
# Хелперы
# ══════════════════════════════════════════════════════════
async def get_owned_material(
    db: AsyncSession,
    material_id: int,
    user: User,
) -> Material:
    """Достаёт материал и проверяет доступ через его коллекцию.

    Если материала нет — бросит material_not_found (404).
    Если коллекция недоступна — get_owned_collection сам бросит
    подходящее исключение (404/403). Намеренно НЕ оборачиваем
    в try/except, чтобы не маскировать настоящие ошибки.
    """
    mat = await get_material_by_id(db, material_id)
    if not mat:
        material_not_found()

    await get_owned_collection(db, mat.collection_id, user)
    return mat


async def _persist_material(db: AsyncSession, mat: Material) -> Material:
    """Коммитит транзакцию и обновляет объект из БД."""
    await db.commit()
    await db.refresh(mat)
    return mat


# ══════════════════════════════════════════════════════════
# Чтение
# ══════════════════════════════════════════════════════════
async def list_materials(
    db: AsyncSession,
    user: User,
    collection_id: int | None = None,
) -> list[Material]:
    """Список материалов юзера, опционально по коллекции."""
    if collection_id is not None:
        await get_owned_collection(db, collection_id, user)
        return await list_materials_by_collection(db, collection_id)
    return await list_all_user_materials(db, user.id)


async def search_materials(
    db: AsyncSession,
    user: User,
    query_str: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> list[Material]:
    """Поиск с проверкой доступа к коллекции (если задана)."""
    if collection_id is not None:
        await get_owned_collection(db, collection_id, user)
    return await search_materials_query(
        db,
        user.id,
        query_str=query_str,
        collection_id=collection_id,
        tag_ids=tag_ids,
    )


async def get_material(
    db: AsyncSession,
    material_id: int,
    user: User,
) -> Material:
    """Один материал юзера по id (с проверкой доступа)."""
    return await get_owned_material(db, material_id, user)


# ══════════════════════════════════════════════════════════
# Создание
# ══════════════════════════════════════════════════════════
async def create_text_material(
    db: AsyncSession,
    user: User,
    collection_id: int,
    material_name: str,
    text_content: str,
) -> Material:
    """Текстовый материал (юзер вводит HTML через TipTap)."""
    await get_owned_collection(db, collection_id, user)

    mat = await create_material(
        db,
        collection_id=collection_id,
        material_name=material_name,
        source_type="text",
        text_content=text_content,
    )
    return await _persist_material(db, mat)


async def create_file_material(
    db: AsyncSession,
    user: User,
    collection_id: int,
    material_name: str,
    file_path: str,
    file_size: int,
) -> Material:
    """Файловый материал.

    Парсер запускается в thread pool (anyio.to_thread.run_sync), чтобы
    тяжёлая обработка PDF/DOCX не блокировала event loop. Если упадёт
    или вернёт пустоту — ничего страшного: extracted_text останется NULL,
    материал просто не будет находиться по содержимому файла
    (поиск по названию работает).
    """
    await get_owned_collection(db, collection_id, user)

    extracted_text: str | None = None
    abs_path = get_full_path(file_path)
    if abs_path:
        try:
            extracted_text = await anyio.to_thread.run_sync(
                extract_text_from_file, abs_path
            )
        except Exception:
            logger.exception("Failed to extract text from %s", file_path)
            extracted_text = None

    mat = await create_material(
        db,
        collection_id=collection_id,
        material_name=material_name,
        source_type="file",
        file_path=file_path,
        file_size=file_size,
        extracted_text=extracted_text,
    )
    return await _persist_material(db, mat)


# ══════════════════════════════════════════════════════════
# Обновление и удаление
# ══════════════════════════════════════════════════════════
async def update_existing_material(
    db: AsyncSession,
    material_id: int,
    user: User,
    *,
    changes: dict,
) -> Material:
    """Частичное обновление материала с проверкой доступа.

    Параметр `changes` — это словарь только тех полей, которые юзер
    реально передал в PATCH (формируется в роуте через model_fields_set).
    Это позволяет различать "поле не передано" и "поле передано как null".

    Бизнес-правила:
      - text_content редактируется ТОЛЬКО для source_type='text'.
      - При переносе в другую коллекцию проверяем доступ к ней.
    """
    mat = await get_owned_material(db, material_id, user)

    if "text_content" in changes and mat.source_type != "text":
        bad_request("text_content можно менять только для текстовых материалов")

    if "collection_id" in changes:
        new_cid = changes["collection_id"]
        if new_cid is None:
            bad_request("collection_id не может быть null — материал должен быть в коллекции")
        await get_owned_collection(db, new_cid, user)

    if changes:
        await update_material(db, mat, **changes)
        await db.commit()
        await db.refresh(mat)

    return mat


async def delete_existing_material(
    db: AsyncSession,
    material_id: int,
    user: User,
) -> None:
    """Удаление материала. Файл с диска чистится отдельно (в роуте)."""
    mat = await get_owned_material(db, material_id, user)
    await delete_material(db, mat)
    await db.commit()