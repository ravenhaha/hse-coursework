"""CRUD для материалов."""

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db_utils import escape_like
from app.models.collection import Collection
from app.models.material import Material
from app.models.material_tag import material_tags


# ─────────────────────────────────────
# READ
# ────────────────────────────────────
async def get_material_by_id(
    db: AsyncSession,
    material_id: int,
) -> Material | None:
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
    stmt = (
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .options(selectinload(Material.tags))
        .where(Collection.user_id == user_id)
        .order_by(Material.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def search_materials(
    db: AsyncSession,
    user_id: int,
    *,
    query_str: str = "",
    collection_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> list[Material]:
    """Поиск материалов с опциональными фильтрами.

    query_str ищется по:
      - material_name (название карточки)
      - text_content (для текстов)
      - extracted_text (для файлов — извлечённый текст)

    Спецсимволы LIKE (%, _) экранируются, чтобы юзер не мог
    управлять шаблоном через ввод.
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
                Material.material_name.ilike(pattern, escape="\\"),
                Material.text_content.ilike(pattern, escape="\\"),
                Material.extracted_text.ilike(pattern, escape="\\"),
            )
        )

    if tag_ids:
        for tag_id in tag_ids:
            sub = select(material_tags.c.material_id).where(
                material_tags.c.tag_id == tag_id
            )
            stmt = stmt.where(Material.id.in_(sub))

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
    source_type: str,
    text_content: str | None = None,
    file_path: str | None = None,
    file_size: int | None = None,
    extracted_text: str | None = None,
) -> Material:
    """Создаёт материал. Все file_* поля передавать только для source_type='file'."""
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
    for key, value in fields.items():
        if key in _UPDATABLE_MATERIAL_FIELDS:
            setattr(material, key, value)
    await db.flush()
    return material


async def delete_material(
    db: AsyncSession,
    material: Material,
) -> None:
    await db.delete(material)
    await db.flush()