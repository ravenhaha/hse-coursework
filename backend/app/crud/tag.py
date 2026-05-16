"""
CRUD-слой для тегов и связки material_tags.

Здесь ТОЛЬКО работа с БД: SELECT/INSERT/UPDATE/DELETE.
Никаких бизнес-правил, проверок владельца, raise HTTPException —
всё это живёт в services/tag.py.

Commit здесь не делается — это ответственность вызывающего сервиса
(чтобы можно было собирать несколько CRUD-операций в одну транзакцию).
"""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.models.material_tag import material_tags


# ══════════════════════════════════════════════════════════
# CRUD тегов
# ══════════════════════════════════════════════════════════

async def create_tag(
    db: AsyncSession,
    user_id: int,
    tag_name: str,
) -> Tag:
    """Создаёт тег. flush() — чтобы получить id без commit."""
    tag = Tag(user_id=user_id, tag_name=tag_name)
    db.add(tag)
    await db.flush()
    return tag


async def get_tag_by_id(db: AsyncSession, tag_id: int) -> Tag | None:
    """Один тег по PK. Проверка владельца — на стороне сервиса."""
    return await db.get(Tag, tag_id)


async def get_tag_by_name(
    db: AsyncSession,
    user_id: int,
    tag_name: str,
) -> Tag | None:
    """Тег по (user_id, tag_name). Для проверки уникальности имени."""
    stmt = select(Tag).where(
        Tag.user_id == user_id,
        Tag.tag_name == tag_name,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_tags_by_user(db: AsyncSession, user_id: int) -> list[Tag]:
    """Все теги юзера, отсортированные по id (стабильный порядок)."""
    stmt = select(Tag).where(Tag.user_id == user_id).order_by(Tag.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_tags_by_ids(
    db: AsyncSession,
    tag_ids: list[int],
) -> list[Tag]:
    """
    Батч-выборка тегов по списку id. Используется для bulk-проверок
    владельца (один SQL вместо N).
    """
    if not tag_ids:
        return []
    stmt = select(Tag).where(Tag.id.in_(tag_ids))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_tag(
    db: AsyncSession,
    tag: Tag,
    tag_name: str,
) -> Tag:
    """Переименовать тег. flush — чтобы изменения попали в БД до commit."""
    tag.tag_name = tag_name
    await db.flush()
    return tag


async def delete_tag(db: AsyncSession, tag: Tag) -> None:
    """
    Удалить тег. Связи в material_tags чистятся каскадом
    (ondelete='CASCADE' в модели MaterialTag).
    """
    await db.delete(tag)
    await db.flush()


# ══════════════════════════════════════════════════════════
# Связка material_tags
# ══════════════════════════════════════════════════════════

async def get_material_tag_ids(
    db: AsyncSession,
    material_id: int,
) -> list[int]:
    """ID тегов, привязанных к материалу. Лёгкий запрос — без JOIN-а с tags."""
    stmt = select(material_tags.c.tag_id).where(
        material_tags.c.material_id == material_id,
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_tags_for_material(
    db: AsyncSession,
    material_id: int,
) -> list[Tag]:
    """Полные объекты Tag, привязанные к материалу. Сортировка по id."""
    stmt = (
        select(Tag)
        .join(material_tags, material_tags.c.tag_id == Tag.id)
        .where(material_tags.c.material_id == material_id)
        .order_by(Tag.id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def link_material_tag(
    db: AsyncSession,
    material_id: int,
    tag_id: int,
) -> None:
    """Привязать тег к материалу (INSERT в material_tags)."""
    stmt = material_tags.insert().values(
        material_id=material_id,
        tag_id=tag_id,
    )
    await db.execute(stmt)


async def unlink_material_tag(
    db: AsyncSession,
    material_id: int,
    tag_id: int,
) -> None:
    """Снять тег с материала (DELETE из material_tags)."""
    stmt = delete(material_tags).where(
        material_tags.c.material_id == material_id,
        material_tags.c.tag_id == tag_id,
    )
    await db.execute(stmt)


async def set_material_tags(
    db: AsyncSession,
    material_id: int,
    tag_ids: list[int],
) -> list[int]:
    """
    Полная замена набора тегов у материала.
    Стратегия: снести всё → вставить новое.

    Возвращает фактически вставленные id (с дедупликацией),
    чтобы роут мог отдать клиенту итоговое состояние.
    """
    # 1. Удаляем все текущие связи у этого материала.
    await db.execute(
        delete(material_tags).where(
            material_tags.c.material_id == material_id,
        ),
    )

    # 2. Дедуплицируем входящие id, сохраняя порядок.
    unique_ids = list(dict.fromkeys(tag_ids))

    # 3. Вставляем пачкой, если есть что вставлять.
    if unique_ids:
        await db.execute(
            material_tags.insert(),
            [
                {"material_id": material_id, "tag_id": tid}
                for tid in unique_ids
            ],
        )

    return unique_ids