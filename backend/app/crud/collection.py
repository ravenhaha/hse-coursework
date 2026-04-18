from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.collection import Collection


async def get_collection_by_id(
    db: AsyncSession,
    collection_id: int,
) -> Collection | None:
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    return result.scalar_one_or_none()


async def get_collections_by_user(
    db: AsyncSession,
    user_id: int,
    parent_id: int | None = None,
) -> list[Collection]:
    query = select(Collection).where(
        Collection.user_id == user_id,
        Collection.parent_id == parent_id,
    )
    result = await db.execute(query)
    return list(result.scalars().all())


# ДОБАВЛЕНО: поиск коллекций по имени
async def search_collections_by_name(
    db: AsyncSession,
    user_id: int,
    query_str: str,
) -> list[Collection]:
    stmt = (
        select(Collection)
        .where(
            Collection.user_id == user_id,
            # ilike — регистронезависимый поиск подстроки
            Collection.collection_name.ilike(f"%{query_str}%"),
        )
        .order_by(Collection.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_duplicate(
    db: AsyncSession,
    user_id: int,
    parent_id: int | None,
    collection_name: str,
) -> Collection | None:
    result = await db.execute(
        select(Collection).where(
            Collection.user_id == user_id,
            Collection.parent_id == parent_id,
            Collection.collection_name == collection_name,
        )
    )
    return result.scalar_one_or_none()


async def create_collection(
    db: AsyncSession,
    user_id: int,
    collection_name: str,
    parent_id: int | None = None,
) -> Collection:
    collection = Collection(
        user_id=user_id,
        collection_name=collection_name,
        parent_id=parent_id,
    )
    db.add(collection)
    return collection


async def update_collection(
    db: AsyncSession,
    collection: Collection,
    **kwargs,
) -> Collection:
    for key, value in kwargs.items():
        setattr(collection, key, value)
    return collection


async def delete_collection(
    db: AsyncSession,
    collection: Collection,
) -> None:
    await db.delete(collection)