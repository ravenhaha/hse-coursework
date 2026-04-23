from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crud.tag import (
    get_tag_by_id,
    get_tags_by_user,
    get_tag_by_name,
    create_tag,
    update_tag,
    delete_tag,
)
from models.tag import Tag
from models.material_tag import material_tags
from models.user import User
from services.material import _check_material_owner
from core.exceptions import (
    tag_not_found,
    tag_access_denied,
    tag_name_duplicate,
    tag_already_assigned,
    tag_not_assigned,
)


async def _get_own_tag(db: AsyncSession, tag_id: int, user: User) -> Tag:
    tag = await get_tag_by_id(db, tag_id)
    if not tag:
        tag_not_found()
    if tag.user_id != user.id:
        tag_access_denied()
    return tag


async def list_tags(db: AsyncSession, user: User) -> list[Tag]:
    return await get_tags_by_user(db, user.id)


async def get_tag(db: AsyncSession, tag_id: int, user: User) -> Tag:
    return await _get_own_tag(db, tag_id, user)


async def create_new_tag(db: AsyncSession, user: User, tag_name: str) -> Tag:
    dup = await get_tag_by_name(db, user.id, tag_name)
    if dup:
        tag_name_duplicate()

    tag = await create_tag(db, user.id, tag_name)
    await db.commit()
    await db.refresh(tag)
    return tag


async def update_existing_tag(
    db: AsyncSession,
    tag_id: int,
    user: User,
    tag_name: str,
) -> Tag:
    tag = await _get_own_tag(db, tag_id, user)

    dup = await get_tag_by_name(db, user.id, tag_name)
    if dup and dup.id != tag.id:
        tag_name_duplicate()

    await update_tag(db, tag, tag_name=tag_name)
    await db.commit()
    await db.refresh(tag)
    return tag


async def delete_existing_tag(
    db: AsyncSession,
    tag_id: int,
    user: User,
) -> None:
    tag = await _get_own_tag(db, tag_id, user)
    await delete_tag(db, tag)
    await db.commit()


async def assign_tag(
    db: AsyncSession,
    user: User,
    material_id: int,
    tag_id: int,
) -> None:
    await _check_material_owner(db, material_id, user)
    await _get_own_tag(db, tag_id, user)

    stmt = select(material_tags).where(
        material_tags.c.material_id == material_id,
        material_tags.c.tag_id == tag_id,
    )
    result = await db.execute(stmt)
    if result.first():
        tag_already_assigned()

    await db.execute(
        material_tags.insert().values(
            material_id=material_id, tag_id=tag_id,
        )
    )
    await db.commit()


async def unassign_tag(
    db: AsyncSession,
    user: User,
    material_id: int,
    tag_id: int,
) -> None:
    await _check_material_owner(db, material_id, user)
    await _get_own_tag(db, tag_id, user)

    stmt = select(material_tags).where(
        material_tags.c.material_id == material_id,
        material_tags.c.tag_id == tag_id,
    )
    result = await db.execute(stmt)
    if not result.first():
        tag_not_assigned()

    await db.execute(
        material_tags.delete().where(
            material_tags.c.material_id == material_id,
            material_tags.c.tag_id == tag_id,
        )
    )
    await db.commit()


async def get_material_tags(
    db: AsyncSession,
    user: User,
    material_id: int,
) -> list[Tag]:
    await _check_material_owner(db, material_id, user)

    stmt = (
        select(Tag)
        .join(material_tags, Tag.id == material_tags.c.tag_id)
        .where(material_tags.c.material_id == material_id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())