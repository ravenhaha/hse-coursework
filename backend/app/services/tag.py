"""Сервис тегов.

Транзакции:
    Сервисный слой явно делает commit после успешных мутаций.
    CRUD-слой делает только flush() для получения server-generated
    полей. При IntegrityError (нарушение UNIQUE-индекса в БД)
    делаем rollback() — иначе сессия попадает в "failed" state.
    После rollback() райзим доменное исключение, и get_db просто
    завершит уже откаченную транзакцию.

Идемпотентные операции (assign/unassign) НЕ ловят IntegrityError:
    Соответствующие CRUD-функции (link_material_tag /
    unlink_material_tag) делают атомарные ON CONFLICT DO NOTHING /
    DELETE ... RETURNING и возвращают bool — «вставили / удалили
    на самом деле или нет». Это убирает race condition между
    pre-check и записью без try/except.
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
    get_tag_by_id,
    get_tag_by_name_ci,
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
    """Достаёт тег и проверяет, что он принадлежит юзеру.

    Два разных исключения (404 vs 403) специально:
        - tag_not_found — тега вообще нет в системе;
        - tag_access_denied — тег есть, но чужой.
    Для конечного API это можно унифицировать в 404 (чтобы не утекало
    «такой id существует»), но на уровне сервиса разделение полезно
    для логов и тестов.
    """
    tag = await get_tag_by_id(db, tag_id)
    if not tag:
        tag_not_found()
    if tag.user_id != user.id:
        tag_access_denied()
    return tag


async def _ensure_tags_belong_to_user(
    db: AsyncSession, tag_ids: list[int], user: User,
) -> None:
    """Проверка для bulk-операций: ВСЕ переданные теги существуют и НАШИ.

    Один SELECT вместо N — оптимизация для set_material_tags_bulk,
    где tag_ids может быть длинным.
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
    """Проверяет уникальность имени тега у юзера (case-insensitive).

    Реальная защита от race condition — UNIQUE INDEX на
    (user_id, lower(tag_name)) в БД. Эта проверка нужна только для
    дружелюбного UX-сообщения вместо «упс, IntegrityError».
    """
    dup = await get_tag_by_name_ci(db, user_id, name)
    if dup and dup.id != exclude_id:
        tag_name_duplicate()


# ══════════════════════════════════════════════════════════
# CRUD тегов
# ══════════════════════════════════════════════════════════
async def list_tags(db: AsyncSession, user: User) -> list[Tag]:
    return await get_tags_by_user(db, user.id)


async def get_tag(db: AsyncSession, tag_id: int, user: User) -> Tag:
    return await _get_own_tag(db, tag_id, user)


async def create_new_tag(
    db: AsyncSession, user: User, tag_name: str,
) -> Tag:
    """Создание тега с двойной защитой от дублей.

    Сначала pre-check для красивой ошибки. Если две параллельные
    транзакции прошли pre-check одновременно — вторая упадёт на
    UNIQUE-индексе → ловим IntegrityError, делаем rollback и
    райзим то же доменное исключение.
    """
    await _check_unique_name(db, user.id, tag_name)

    try:
        tag = await create_tag(db, user.id, tag_name)
        await db.commit()
        await db.refresh(tag)
        return tag
    except IntegrityError:
        await db.rollback()
        tag_name_duplicate()


async def update_existing_tag(
    db: AsyncSession,
    tag_id: int,
    user: User,
    tag_name: str,
) -> Tag:
    """Переименование тега.

    Кейсы:
        1. Имя не изменилось — возвращаем как есть, без UPDATE и commit'а.
        2. Изменился только регистр — UPDATE без проверки уникальности.
        3. Изменилось имя — проверяем уникальность.
    """
    tag = await _get_own_tag(db, tag_id, user)

    if tag.tag_name == tag_name:
        return tag

    if tag.tag_name.casefold() != tag_name.casefold():
        await _check_unique_name(db, user.id, tag_name, exclude_id=tag.id)

    try:
        await update_tag(db, tag, tag_name=tag_name)
        await db.commit()
        await db.refresh(tag)
    except IntegrityError:
        await db.rollback()
        tag_name_duplicate()

    return tag


async def delete_existing_tag(
    db: AsyncSession, tag_id: int, user: User,
) -> None:
    tag = await _get_own_tag(db, tag_id, user)
    await delete_tag(db, tag)
    await db.commit()


# ══════════════════════════════════════════════════════════
# Привязка тегов к материалам
# ══════════════════════════════════════════════════════════
async def assign_tag(
    db: AsyncSession, user: User, material_id: int, tag_id: int,
) -> None:
    """Привязать тег к материалу.

    Если link уже существовал (CRUD вернул False) — НЕ коммитим,
    райзим доменную ошибку. Иначе фиксируем вставку.
    """
    await get_owned_material(db, material_id, user)
    await _get_own_tag(db, tag_id, user)

    created = await link_material_tag(db, material_id, tag_id)
    if not created:
        tag_already_assigned()

    await db.commit()


async def unassign_tag(
    db: AsyncSession, user: User, material_id: int, tag_id: int,
) -> None:
    """Отвязать тег от материала.

    Зеркально assign_tag: коммитим только если реально удалили строку.
    """
    await get_owned_material(db, material_id, user)
    await _get_own_tag(db, tag_id, user)

    deleted = await unlink_material_tag(db, material_id, tag_id)
    if not deleted:
        tag_not_assigned()

    await db.commit()


async def get_material_tags(
    db: AsyncSession, user: User, material_id: int,
) -> list[Tag]:
    """Все теги конкретного материала."""
    await get_owned_material(db, material_id, user)
    return await get_tags_for_material(db, material_id)


async def set_material_tags_bulk(
    db: AsyncSession,
    user: User,
    material_id: int,
    tag_ids: list[int],
) -> list[int]:
    """Полностью заменить набор тегов у материала.

    Стратегия в CRUD: удалить все существующие связи → вставить новые
    (после дедупликации). Поэтому возвращаемый список — это
    ИТОГОВЫЙ НАБОР tag_id у материала, в порядке поступления
    (с убранными повторами).

    Фронт может использовать этот результат, чтобы синхронизировать
    локальное состояние без дополнительного GET.
    """
    await get_owned_material(db, material_id, user)
    await _ensure_tags_belong_to_user(db, tag_ids, user)

    result = await set_material_tags(db, material_id, tag_ids)
    await db.commit()
    return result