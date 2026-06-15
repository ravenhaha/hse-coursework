"""CRUD для коллекций (папок)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_utils import LIKE_ESCAPE_CHAR, escape_like
from app.models.collection import Collection


# ─────────────────────────────────────
# READ
# ─────────────────────────────────────
async def get_collection_by_id(
    db: AsyncSession,
    collection_id: int,
) -> Collection | None:
    """Возвращает коллекцию по id или None."""
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id)
    )
    return result.scalar_one_or_none()


async def list_user_collections(
    db: AsyncSession,
    user_id: int,
    parent_id: int | None = None,
) -> list[Collection]:
    """Список коллекций пользователя на одном уровне (по parent_id)."""
    stmt = select(Collection).where(Collection.user_id == user_id)
    if parent_id is None:
        stmt = stmt.where(Collection.parent_id.is_(None))
    else:
        stmt = stmt.where(Collection.parent_id == parent_id)
    stmt = stmt.order_by(Collection.name)

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_all_user_collections(
    db: AsyncSession,
    user_id: int,
) -> list[Collection]:
    """ВСЕ коллекции пользователя одним запросом — для дерева."""
    stmt = (
        select(Collection)
        .where(Collection.user_id == user_id)
        .order_by(Collection.name)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def search_collections_by_name(
    db: AsyncSession,
    user_id: int,
    query_str: str,
) -> list[Collection]:
    """Поиск коллекций по подстроке в названии (регистронезависимый)."""
    pattern = f"%{escape_like(query_str)}%"
    stmt = (
        select(Collection)
        .where(
            Collection.user_id == user_id,
            Collection.name.ilike(pattern, escape=LIKE_ESCAPE_CHAR),
        )
        .order_by(Collection.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_duplicate(
    db: AsyncSession,
    user_id: int,
    parent_id: int | None,
    name: str,
) -> Collection | None:
    """Ищет коллекцию с тем же именем на том же уровне."""
    stmt = select(Collection).where(
        Collection.user_id == user_id,
        Collection.name == name,
    )
    if parent_id is None:
        stmt = stmt.where(Collection.parent_id.is_(None))
    else:
        stmt = stmt.where(Collection.parent_id == parent_id)

    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ─────────────────────────────────────
# Защита от циклов в дереве
# ─────────────────────────────────────
async def is_descendant(
    db: AsyncSession,
    collection_id: int,
    potential_ancestor_id: int,
) -> bool:
    """Проверяет, лежит ли potential_ancestor_id ВНУТРИ поддерева collection_id."""
    current_id: int | None = potential_ancestor_id
    visited: set[int] = set()

    while current_id is not None:
        if current_id in visited:
            return True
        visited.add(current_id)

        if current_id == collection_id:
            return True

        result = await db.execute(
            select(Collection.parent_id).where(Collection.id == current_id)
        )
        current_id = result.scalar_one_or_none()

    return False


# ─────────────────────────────────────
# CREATE / UPDATE / DELETE
# ─────────────────────────────────────
async def create_collection(
    db: AsyncSession,
    *,
    user_id: int,
    name: str,
    parent_id: int | None = None,
    icon: str | None = None,
) -> Collection:
    """Создаёт коллекцию и делает flush для получения id."""
    collection = Collection(
        user_id=user_id,
        name=name,
        parent_id=parent_id,
        icon=icon,
    )
    db.add(collection)
    await db.flush()
    return collection


_UPDATABLE_COLLECTION_FIELDS = {"name", "parent_id", "icon"}


async def update_collection(
    db: AsyncSession,
    collection: Collection,
    **fields,
) -> Collection:
    """Обновляет разрешённые поля коллекции (имя, parent_id, icon)."""
    for key, value in fields.items():
        if key in _UPDATABLE_COLLECTION_FIELDS:
            setattr(collection, key, value)
    await db.flush()
    return collection


async def delete_collection(
    db: AsyncSession,
    collection: Collection,
) -> None:
    """Удаляет коллекцию (каскад на дочерние и материалы — в модели)."""
    await db.delete(collection)
    await db.flush()