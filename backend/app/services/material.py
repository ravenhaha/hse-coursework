from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from crud.material import (
    get_material_by_id,
    get_materials_by_collection,
    create_material,
    update_material,
    delete_material,
    search_materials_query,
)
from models.material import Material
from models.collection import Collection
from models.user import User
from services.collection import _get_own_collection
from core.exceptions import material_not_found, material_access_denied
from core.file_parser import extract_text_from_file


async def _check_material_owner(
    db: AsyncSession,
    material_id: int,
    user: User,
) -> Material:
    """Проверяем владельца через коллекцию (material → collection → user)."""
    mat = await get_material_by_id(db, material_id)
    if not mat:
        material_not_found()

    collection = await db.get(Collection, mat.collection_id)
    if not collection or collection.user_id != user.id:
        material_access_denied()

    return mat


async def list_materials(
    db: AsyncSession,
    user: User,
    collection_id: int,
) -> list[Material]:
    await _get_own_collection(db, collection_id, user)
    return await get_materials_by_collection(db, collection_id)


async def search_materials(
    db: AsyncSession,
    user: User,
    query_str: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> list[Material]:
    if collection_id is not None:
        await _get_own_collection(db, collection_id, user)

    return await search_materials_query(
        db, user.id, query_str, collection_id, tag_ids,
    )


async def get_material(
    db: AsyncSession,
    material_id: int,
    user: User,
) -> Material:
    return await _check_material_owner(db, material_id, user)


async def create_text_material(
    db: AsyncSession,
    user: User,
    collection_id: int,
    material_name: str,
    text_content: str,
) -> Material:
    await _get_own_collection(db, collection_id, user)

    mat = await create_material(
        db,
        collection_id=collection_id,
        material_name=material_name,
        source_type="text",
        text_content=text_content,
    )
    await db.commit()
    await db.refresh(mat)
    return mat


async def create_file_material(
    db: AsyncSession,
    user: User,
    collection_id: int,
    material_name: str,
    file_path: str,
) -> Material:
    await _get_own_collection(db, collection_id, user)

    # Парсим текст из файла
    text_content = extract_text_from_file(file_path)

    mat = await create_material(
        db,
        collection_id=collection_id,
        material_name=material_name,
        source_type="file",
        file_path=file_path,
        text_content=text_content,
    )
    await db.commit()
    await db.refresh(mat)
    return mat


async def update_existing_material(
    db: AsyncSession,
    material_id: int,
    user: User,
    material_name: str | None = None,
    text_content: str | None = None,
    collection_id: int | None = None,       # ← НОВОЕ: перемещение
    is_important: bool | None = None,        # ← НОВОЕ: пометка «важно»
) -> Material:
    mat = await _check_material_owner(db, material_id, user)

    # Если перемещаем — проверяем что целевая коллекция тоже принадлежит юзеру
    if collection_id is not None:
        await _get_own_collection(db, collection_id, user)

    kwargs = {}
    if material_name is not None:
        kwargs["material_name"] = material_name
    if text_content is not None:
        kwargs["text_content"] = text_content
    if collection_id is not None:
        kwargs["collection_id"] = collection_id
    if is_important is not None:
        kwargs["is_important"] = is_important

    if kwargs:
        await update_material(db, mat, **kwargs)

    await db.commit()
    await db.refresh(mat)
    return mat


async def delete_existing_material(
    db: AsyncSession,
    material_id: int,
    user: User,
) -> None:
    mat = await _check_material_owner(db, material_id, user)
    await delete_material(db, mat)
    await db.commit()