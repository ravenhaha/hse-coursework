"""CRUD для материалов (заметок и файлов).

Тонкий слой над БД: только SELECT/INSERT/UPDATE/DELETE.
Никаких проверок владельца, raise HTTPException — это работа сервиса.
Commit не делаем (агрегирует вызывающий код).
"""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db_utils import LIKE_ESCAPE_CHAR, escape_like
from app.models.collection import Collection
from app.models.material import Material, SourceType
from app.models.material_tag import material_tags


# ─────────────────────────────────────
# READ
# ─────────────────────────────────────
async def get_material_by_id(
    db: AsyncSession,
    material_id: int,
) -> Material | None:
    """Один материал по id, с подгруженными тегами."""
    stmt = (
        select(Material)
        .options(selectinload(Material.tags))
        .where(Material.id == material_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_materials_by_collection(
    db: AsyncSession,
    collection_id: int,
) -> list[Material]:
    """Все материалы коллекции, новые сверху."""
    stmt = (
        select(Material)
        .options(selectinload(Material.tags))
        .where(Material.collection_id == collection_id)
        .order_by(Material.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_all_user_materials(
    db: AsyncSession,
    user_id: int,
) -> list[Material]:
    """Все материалы юзера (через JOIN с collections)."""
    stmt = (
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .options(selectinload(Material.tags))
        .where(Collection.user_id == user_id)
        .order_by(Material.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_user_materials_paginated(
    db: AsyncSession,
    user_id: int,
    *,
    collection_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Material], int]:
    """Страница материалов юзера + общее количество по фильтру.

    Возвращает кортеж (materials, total):
        - materials — срез по limit/offset, новые сверху;
        - total — сколько всего записей подходит под фильтр.

    total считается отдельным COUNT-запросом по тем же условиям, но без
    limit/offset — иначе клиент не узнает, сколько ещё страниц впереди.
    """
    base_filter = (
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .where(Collection.user_id == user_id)
    )
    if collection_id is not None:
        base_filter = base_filter.where(Material.collection_id == collection_id)

    count_stmt = base_filter.with_only_columns(func.count(Material.id))
    total = (await db.execute(count_stmt)).scalar_one()

    page_stmt = (
        base_filter
        .options(selectinload(Material.tags))
        .order_by(Material.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(page_stmt)
    materials = list(result.scalars().all())

    return materials, total


async def search_materials(
    db: AsyncSession,
    user_id: int,
    *,
    query_str: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> list[Material]:
    """Поиск материалов с опциональными фильтрами.

    Семантика тегов — OR (материал имеет хотя бы один из tag_ids).
    """
    stmt = (
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .options(selectinload(Material.tags))
        .where(Collection.user_id == user_id)
    )

    if collection_id is not None:
        stmt = stmt.where(Material.collection_id == collection_id)

    if query_str:
        pattern = f"%{escape_like(query_str)}%"
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
                ),
            ),
        )

    stmt = stmt.order_by(Material.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ─────────────────────────────────────
# CREATE / UPDATE / DELETE
# ─────────────────────────────────────
async def create_material(
    db: AsyncSession,
    *,
    collection_id: int,
    material_name: str,
    source_type: SourceType,
    text_content: str | None = None,
    file_path: str | None = None,
    file_size: int | None = None,
    extracted_text: str | None = None,
) -> Material:
    """Создаёт материал."""
    material = Material(
        collection_id=collection_id,
        material_name=material_name,
        source_type=source_type,
        text_content=text_content,
        file_path=file_path,
        file_size=file_size,
        extracted_text=extracted_text,
    )
    db.add(material)
    await db.flush()
    return material


_UPDATABLE_MATERIAL_FIELDS = {
    "material_name",
    "text_content",
    "collection_id",
    "is_important",
}


async def update_material(
    db: AsyncSession,
    material: Material,
    **fields,
) -> Material:
    """Обновляет разрешённые поля материала."""
    for key, value in fields.items():
        if key in _UPDATABLE_MATERIAL_FIELDS:
            setattr(material, key, value)
    await db.flush()
    return material


async def delete_material(
    db: AsyncSession,
    material: Material,
) -> None:
    """Удаляет материал. Связи material_tags чистятся каскадом FK."""
    await db.delete(material)
    await db.flush()
