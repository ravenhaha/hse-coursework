"""Сервис материалов.

Бизнес-правила:
    - материал принадлежит коллекции, коллекция — юзеру;
    - доступ к материалу = доступ к его коллекции;
    - при загрузке файла извлекаем текст (для поиска и превью).

Транзакции:
    CRUD-слой делает только flush() (чтобы получить server-generated
    поля типа id и created_at). COMMIT — обязанность сервисного слоя:
    каждая мутирующая публичная функция (create/update/delete) сама
    вызывает `await db.commit()` после успешного выполнения всех
    бизнес-проверок.
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
from app.models.material import Material, SourceType
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
    """Достаёт материал (с tags) и проверяет доступ через его коллекцию."""
    mat = await get_material_by_id(db, material_id)
    if not mat:
        material_not_found()

    await get_owned_collection(db, mat.collection_id, user)
    return mat


async def _reload_with_tags(db: AsyncSession, material_id: int) -> Material:
    """Перечитывает материал из БД, гарантируя подгруженный tags.

    Используется ПОСЛЕ commit'а — чтобы вернуть свежий объект
    с актуальными server-defaults и связями.
    """
    mat = await get_material_by_id(db, material_id)
    if not mat:
        material_not_found()
    return mat


# ══════════════════════════════════════════════════════════
# Чтение
# ══════════════════════════════════════════════════════════
async def list_materials(
    db: AsyncSession,
    user: User,
    *,
    collection_id: int | None = None,
) -> list[Material]:
    """Список материалов юзера (с tags)."""
    if collection_id is not None:
        await get_owned_collection(db, collection_id, user)
        return await list_materials_by_collection(db, collection_id)

    return await list_all_user_materials(db, user.id)


async def search_materials(
    db: AsyncSession,
    user: User,
    *,
    query_str: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> list[Material]:
    """Поиск с фильтрами + проверка доступа к коллекции (если задана)."""
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
    """Один материал по id, с проверкой владения."""
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
    """Текстовый материал (HTML из TipTap-редактора).

    После создания делаем commit и перечитываем материал, чтобы
    вернуть фронту объект с подгруженными tags (пустой список,
    но фронт ожидает поле в JSON).
    """
    await get_owned_collection(db, collection_id, user)

    mat = await create_material(
        db,
        collection_id=collection_id,
        material_name=material_name,
        source_type=SourceType.TEXT,
        text_content=text_content,
    )
    await db.commit()
    return await _reload_with_tags(db, mat.id)


async def create_file_material(
    db: AsyncSession,
    user: User,
    collection_id: int,
    material_name: str,
    file_path: str,
    file_size: int,
) -> Material:
    """Файловый материал. Парсер текста уходит в thread pool.

    Если парсер упал — логируем и сохраняем материал без
    extracted_text. Сам факт неудачи парсинга не должен ломать
    создание материала: файл уже загружен, юзер его видит.
    """
    await get_owned_collection(db, collection_id, user)

    extracted_text: str | None = None
    abs_path = get_full_path(file_path)
    if abs_path:
        try:
            extracted_text = await anyio.to_thread.run_sync(
                extract_text_from_file, abs_path,
            )
        except Exception:
            logger.exception("Failed to extract text from %s", file_path)
            extracted_text = None

    mat = await create_material(
        db,
        collection_id=collection_id,
        material_name=material_name,
        source_type=SourceType.FILE,
        file_path=file_path,
        file_size=file_size,
        extracted_text=extracted_text,
    )
    await db.commit()
    return await _reload_with_tags(db, mat.id)


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
    """Частичное обновление материала.

    Проверки против невалидных PATCH-полей:
      - text_content редактируется только у TEXT-материалов
      - text_content не может быть null (нарушит CheckConstraint в БД)
      - collection_id не может быть null
      - is_important не может быть null (NOT NULL в БД)

    Commit делаем только если реально что-то меняли —
    нет смысла фиксировать пустую транзакцию.
    """
    mat = await get_owned_material(db, material_id, user)

    # text_content: только для TEXT и только строка (не null)
    if "text_content" in changes:
        if mat.source_type != SourceType.TEXT:
            bad_request(
                "text_content можно менять только для текстовых материалов",
            )
        if changes["text_content"] is None:
            bad_request(
                "text_content не может быть null для текстового материала",
            )

    # collection_id: не null, и юзер должен владеть новой коллекцией
    if "collection_id" in changes:
        new_cid = changes["collection_id"]
        if new_cid is None:
            bad_request(
                "collection_id не может быть null — "
                "материал должен быть в коллекции",
            )
        await get_owned_collection(db, new_cid, user)

    # is_important: не null (в БД NOT NULL)
    if "is_important" in changes and changes["is_important"] is None:
        bad_request("is_important не может быть null")

    if changes:
        await update_material(db, mat, **changes)
        await db.commit()

    # Перечитываем — чтобы tags подгрузились свежим запросом
    # (особенно важно если меняли collection_id).
    return await _reload_with_tags(db, mat.id)


async def delete_existing_material(
    db: AsyncSession,
    material_id: int,
    user: User,
) -> None:
    """Удаление материала.

    Commit фиксирует удаление; refresh не нужен — объект больше
    не существует в БД.
    """
    mat = await get_owned_material(db, material_id, user)
    await delete_material(db, mat)
    await db.commit()