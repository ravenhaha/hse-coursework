from sqlalchemy.ext.asyncio import AsyncSession

from crud.collection import (
    get_collection_by_id,
    get_collections_by_user,
    get_duplicate,
    create_collection,
    update_collection,
    delete_collection,
    search_collections_by_name,
)
from models.collection import Collection
from models.user import User
from core.exceptions import not_found, forbidden, conflict
# ИЗМЕНЕНО: импорт UNSET из core/constants вместо локального _UNSET
from core.constants import UNSET


# ─── Хелпер: проверка владельца ───

async def _get_own_collection(
    db: AsyncSession,
    collection_id: int,
    user: User,
) -> Collection:
    collection = await get_collection_by_id(db, collection_id)
    if not collection:
        not_found("Коллекция не найдена")
    if collection.user_id != user.id:
        forbidden("Нет доступа к этой коллекции")
    return collection


# ─── Список корневых (или вложенных) коллекций ───

async def list_collections(
    db: AsyncSession,
    user: User,
    parent_id: int | None = None,
) -> list[Collection]:
    if parent_id is not None:
        await _get_own_collection(db, parent_id, user)

    return await get_collections_by_user(db, user.id, parent_id)


# ─── Получение одной коллекции ───

async def get_collection(
    db: AsyncSession,
    collection_id: int,
    user: User,
) -> Collection:
    return await _get_own_collection(db, collection_id, user)


# ─── Создание ───

async def create_new_collection(
    db: AsyncSession,
    user: User,
    collection_name: str,
    parent_id: int | None = None,
) -> Collection:
    if parent_id is not None:
        await _get_own_collection(db, parent_id, user)

    dup = await get_duplicate(db, user.id, parent_id, collection_name)
    if dup:
        conflict("Коллекция с таким именем уже существует на этом уровне")

    collection = await create_collection(db, user.id, collection_name, parent_id)
    await db.commit()
    await db.refresh(collection)
    return collection


# ─── Обновление ───
# ИЗМЕНЕНО: UNSET вместо _UNSET

async def update_existing_collection(
    db: AsyncSession,
    collection_id: int,
    user: User,
    collection_name: str | None = None,
    parent_id: int | None = UNSET,
) -> Collection:
    collection = await _get_own_collection(db, collection_id, user)

    new_name = collection_name if collection_name is not None else collection.collection_name
    new_parent = parent_id if parent_id is not UNSET else collection.parent_id

    if parent_id is not UNSET and parent_id == collection.id:
        conflict("Нельзя переместить коллекцию в саму себя")

    if collection_name is not None or parent_id is not UNSET:
        dup = await get_duplicate(db, user.id, new_parent, new_name)
        if dup and dup.id != collection.id:
            conflict("Коллекция с таким именем уже существует на этом уровне")

    if parent_id is not UNSET and parent_id is not None and parent_id != collection.parent_id:
        await _get_own_collection(db, parent_id, user)

    update_kwargs = {}
    if collection_name is not None:
        update_kwargs["collection_name"] = collection_name
    if parent_id is not UNSET:
        update_kwargs["parent_id"] = parent_id

    if update_kwargs:
        await update_collection(db, collection, **update_kwargs)

    await db.commit()
    await db.refresh(collection)
    return collection


# ─── Удаление ───

async def delete_existing_collection(
    db: AsyncSession,
    collection_id: int,
    user: User,
) -> None:
    collection = await _get_own_collection(db, collection_id, user)
    await delete_collection(db, collection)
    await db.commit()

# ─── Поиск ───

async def search_collections(
    db: AsyncSession,
    user: User,
    query_str: str,
) -> list[Collection]:
    return await search_collections_by_name(db, user.id, query_str)