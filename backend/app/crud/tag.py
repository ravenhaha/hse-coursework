from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.tag import Tag
from models.material_tag import MaterialTag


async def get_tag_by_id(db: AsyncSession, tag_id: int) -> Tag | None:
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    return result.scalar_one_or_none()


async def get_tags_by_user(db: AsyncSession, user_id: int) -> list[Tag]:
    result = await db.execute(select(Tag).where(Tag.user_id == user_id))
    return list(result.scalars().all())


async def get_tag_by_name(
    db: AsyncSession, user_id: int, tag_name: str,
) -> Tag | None:
    result = await db.execute(
        select(Tag).where(Tag.user_id == user_id, Tag.tag_name == tag_name)
    )
    return result.scalar_one_or_none()


async def create_tag(db: AsyncSession, user_id: int, tag_name: str) -> Tag:
    tag = Tag(user_id=user_id, tag_name=tag_name)
    db.add(tag)
    await db.flush()
    return tag


async def update_tag(db: AsyncSession, tag: Tag, **kwargs) -> Tag:
    for k, v in kwargs.items():
        if v is not None:
            setattr(tag, k, v)
    await db.flush()
    return tag


async def delete_tag(db: AsyncSession, tag: Tag) -> None:
    await db.delete(tag)
    await db.flush()