from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.material import Material
from models.collection import Collection
from models.material_tag import material_tags


async def get_material_by_id(
    db: AsyncSession,
    material_id: int,
) -> Material | None:
    result = await db.execute(
        select(Material).where(Material.id == material_id)
    )
    return result.scalar_one_or_none()


async def get_materials_by_collection(
    db: AsyncSession,
    collection_id: int,
) -> list[Material]:
    """Коллекция уже проверена на владельца в сервисе — фильтр только по collection_id."""
    result = await db.execute(
        select(Material)
        .where(Material.collection_id == collection_id)
        .order_by(Material.created_at.desc())
    )
    return list(result.scalars().all())


async def search_materials_query(
    db: AsyncSession,
    user_id: int,
    query_str: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> list[Material]:
    """Поиск по всем материалам пользователя — через JOIN с collections."""
    stmt = (
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .where(Collection.user_id == user_id)
    )

    if collection_id is not None:
        stmt = stmt.where(Material.collection_id == collection_id)

    if query_str:
        stmt = stmt.where(Material.material_name.ilike(f"%{query_str}%"))

    if tag_ids:
        for tag_id in tag_ids:
            sub = select(material_tags.c.material_id).where(
                material_tags.c.tag_id == tag_id
            )
            stmt = stmt.where(Material.id.in_(sub))

    stmt = stmt.order_by(Material.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_material(
    db: AsyncSession,
    collection_id: int,
    material_name: str,
    source_type: str,
    text_content: str | None = None,
    file_path: str | None = None,
) -> Material:
    """Без user_id — материал привязан к коллекции."""
    material = Material(
        collection_id=collection_id,
        material_name=material_name,
        source_type=source_type,
        text_content=text_content,
        file_path=file_path,
    )
    db.add(material)
    return material


async def update_material(
    db: AsyncSession,
    material: Material,
    **kwargs,
) -> Material:
    for key, value in kwargs.items():
        setattr(material, key, value)
    return material


async def delete_material(
    db: AsyncSession,
    material: Material,
) -> None:
    await db.delete(material)