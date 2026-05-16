"""
Сервис тегов.

Бизнес-правила:
  - тег принадлежит юзеру (поле user_id);
  - имя тега уникально внутри юзера;
  - присвоение/снятие тега — m2m через таблицу material_tags;
  - все теги в bulk-операциях должны принадлежать тому же юзеру.

Защита от race condition:
  - все операции, нарушающие UniqueConstraint, защищены try/except
    IntegrityError. Это нужно потому, что между check и insert может
    проскочить параллельный запрос (двойной клик, два таба).
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    tag_access_denied,
    tag_already_assigned,
    tag_name_duplicate,
    tag_not_assigned,
    tag_not_found,
)
from app.crud.tag import (
    create_tag,
    delete_tag,
    get_material_tag_ids,
    get_tag_by_id,
    get_tag_by_name,
    get_tags_by_ids,
    get_tags_by_user,
    get_tags_for_material,
    link_material_tag,
    set_material_tags,
    unlink_material_tag,
    update_tag,
)
from app.models.tag import Tag
from app.models.user import User
from app.services.material import get_owned_material


# ══════════════════════════════════════════════════════════
# Хелперы
# ══════════════════════════════════════════════════════════

async def _get_own_tag(db: AsyncSession, tag_id: int, user: User) -> Tag:
    """Достаёт тег с проверкой владельца."""
    tag = await get_tag_by_id(db, tag_id)
    if not tag:
        tag_not_found()
    if tag.user_id != user.id:
        tag_access_denied()
    return tag


async def _ensure_tags_belong_to_user(
    db: AsyncSession, tag_ids: list[int], user: User,
) -> None:
    """
    Батч-проверка владельца для списка тегов.
    Один SQL вместо N. Райзит на первой проблеме.
    """
    unique_ids = list(set(tag_ids))
    if not unique_ids:
        return

    tags = await get_tags_by_ids(db, unique_ids)

    if len(tags) != len(unique_ids):
        tag_not_found()

    if any(t.user_id != user.id for t in tags):
        tag_access_denied()


async def _check_unique_name(
    db: AsyncSession,
    user_id: int,
    name: str,
    exclude_id: int | None = None,
) -> None:
    """Проверяет, что имя тега ещё не занято у этого юзера.

    Это "оптимистичная" проверка — между ней и INSERT может проскочить
    параллельный запрос. Поэтому в caller'ах есть страховка через
    try/except IntegrityError.
    """
    dup = await get_tag_by_name(db, user_id, name)
    if dup and dup.id != exclude_id:
        tag_name_duplicate()


# ══════════════════════════════════════════════════════════
# CRUD тегов
# ══════════════════════════════════════════════════════════

async def list_tags(db: AsyncSession, user: User) -> list[Tag]:
    """Все теги юзера."""
    return await get_tags_by_user(db, user.id)


async def get_tag(db: AsyncSession, tag_id: int, user: User) -> Tag:
    """Один тег по ID."""
    return await _get_own_tag(db, tag_id, user)


async def create_new_tag(
    db: AsyncSession, user: User, tag_name: str,
) -> Tag:
    """Создаёт тег с уникальным именем в рамках юзера.

    Двойная защита от дублей:
      1. Быстрая проверка через SELECT (UX: понятная ошибка сразу).
      2. try/except IntegrityError — на случай race condition между
         SELECT и INSERT (двойной клик, два таба).
    """
    await _check_unique_name(db, user.id, tag_name)

    try:
        tag = await create_tag(db, user.id, tag_name)
        await db.commit()
    except IntegrityError:
        # Параллельный запрос успел вставить такой же тег между нашим
        # SELECT и INSERT. Откатываем и сообщаем юзеру.
        await db.rollback()
        tag_name_duplicate()

    await db.refresh(tag)
    return tag


async def update_existing_tag(
    db: AsyncSession,
    tag_id: int,
    user: User,
    tag_name: str,
) -> Tag:
    """Переименование тега.

    Если имя не меняется — early return, не дёргаем БД зря.
    Защита от race condition аналогична create_new_tag.
    """
    tag = await _get_own_tag(db, tag_id, user)

    # Имя не изменилось — нечего делать.
    if tag.tag_name == tag_name:
        return tag

    await _check_unique_name(db, user.id, tag_name, exclude_id=tag.id)

    try:
        await update_tag(db, tag, tag_name=tag_name)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        tag_name_duplicate()

    await db.refresh(tag)
    return tag


async def delete_existing_tag(
    db: AsyncSession, tag_id: int, user: User,
) -> None:
    """Удаление тега. Связи в material_tags падают каскадом из БД."""
    tag = await _get_own_tag(db, tag_id, user)
    await delete_tag(db, tag)
    await db.commit()


# ══════════════════════════════════════════════════════════
# Привязка тегов к материалам
# ══════════════════════════════════════════════════════════

async def assign_tag(
    db: AsyncSession, user: User, material_id: int, tag_id: int,
) -> None:
    """Привязывает тег к материалу. Райзит, если уже привязан.

    Защита от race condition: между SELECT существующих связей
    и INSERT может проскочить параллельный запрос (двойной клик).
    Composite PK (material_id, tag_id) в material_tags поймает его
    через IntegrityError.
    """
    await get_owned_material(db, material_id, user)
    await _get_own_tag(db, tag_id, user)

    existing_ids = await get_material_tag_ids(db, material_id)
    if tag_id in existing_ids:
        tag_already_assigned()

    try:
        await link_material_tag(db, material_id, tag_id)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        tag_already_assigned()


async def unassign_tag(
    db: AsyncSession, user: User, material_id: int, tag_id: int,
) -> None:
    """Снимает тег с материала. Райзит, если не был привязан."""
    await get_owned_material(db, material_id, user)
    await _get_own_tag(db, tag_id, user)

    existing_ids = await get_material_tag_ids(db, material_id)
    if tag_id not in existing_ids:
        tag_not_assigned()

    await unlink_material_tag(db, material_id, tag_id)
    await db.commit()


async def get_material_tags(
    db: AsyncSession, user: User, material_id: int,
) -> list[Tag]:
    """Все теги, привязанные к материалу."""
    await get_owned_material(db, material_id, user)
    return await get_tags_for_material(db, material_id)


async def set_material_tags_bulk(
    db: AsyncSession,
    user: User,
    material_id: int,
    tag_ids: list[int],
) -> list[int]:
    """
    Полная замена тегов у материала.
    Проверяет владельца материала и всех тегов одним батчем.
    """
    await get_owned_material(db, material_id, user)
    await _ensure_tags_belong_to_user(db, tag_ids, user)

    result_ids = await set_material_tags(db, material_id, tag_ids)
    await db.commit()
    return result_ids