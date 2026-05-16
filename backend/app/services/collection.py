"""Сервисный слой для коллекций.

Здесь живёт ВСЯ бизнес-логика:
  - проверка прав (юзер видит только свои коллекции)
  - проверка дублей (имя уникально внутри одного parent_id)
  - защита от циклов (нельзя сделать родителем своего потомка)
  - построение дерева для сайдбара

Слой ничего не знает про HTTP — только про доменные ошибки
из app.core.exceptions.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    collection_access_denied,
    collection_name_duplicate,
    collection_not_found,
    collection_self_parent,
)
from app.crud import collection as crud_collection
from app.models.collection import Collection
from app.models.user import User
from app.schemas.collection import CollectionTreeNode


# ─────────────────────────────────────
# Внутренние хелперы (приватные)
# ────────────────────────────────────
async def _get_owned_collection(
    db: AsyncSession,
    collection_id: int,
    user_id: int,
) -> Collection:
    """Возвращает коллекцию, если она существует И принадлежит юзеру.

    Иначе бросает 404 или 403. Используется во всех операциях,
    где нужно убедиться, что юзер имеет право на коллекцию.
    """
    collection = await crud_collection.get_collection_by_id(db, collection_id)
    if collection is None:
        collection_not_found()
    if collection.user_id != user_id:
        collection_access_denied()
    return collection


async def get_owned_collection(
    db: AsyncSession,
    collection_id: int,
    user: User,
) -> Collection:
    """Публичная обёртка для кросс-сервисных вызовов.

    Используется в `services/material.py` и других сервисах, где
    нужно убедиться, что юзер владеет коллекцией перед операцией
    над её содержимым. Принимает объект User (а не user_id) —
    это удобнее для роутов, которые получают user из CurrentUser.
    """
    return await _get_owned_collection(db, collection_id, user.id)


async def _ensure_parent_valid(
    db: AsyncSession,
    user_id: int,
    parent_id: int | None,
    *,
    moving_collection_id: int | None = None,
) -> None:
    """Проверяет, что parent_id валиден:
      - если None → ок (корневая коллекция)
      - если указан → коллекция существует и принадлежит юзеру
      - если идёт перемещение (moving_collection_id != None) →
        нельзя сделать родителем самого себя или своего потомка.
    """
    if parent_id is None:
        return

    parent = await crud_collection.get_collection_by_id(db, parent_id)
    if parent is None:
        collection_not_found()
    if parent.user_id != user_id:
        collection_access_denied()

    if moving_collection_id is not None:
        if parent_id == moving_collection_id:
            collection_self_parent()
        is_desc = await crud_collection.is_descendant(
            db,
            collection_id=moving_collection_id,
            potential_ancestor_id=parent_id,
        )
        if is_desc:
            collection_self_parent()


async def _ensure_name_unique(
    db: AsyncSession,
    user_id: int,
    parent_id: int | None,
    name: str,
    *,
    exclude_id: int | None = None,
) -> None:
    """Проверяет, что на уровне (user_id, parent_id) нет коллекции
    с таким же именем.

    exclude_id — id коллекции, которую исключить из проверки
    (нужно при апдейте: переименовываем себя, и сами с собой
    конфликтовать не должны).
    """
    duplicate = await crud_collection.get_duplicate(
        db,
        user_id=user_id,
        parent_id=parent_id,
        name=name,
    )
    if duplicate is not None and duplicate.id != exclude_id:
        collection_name_duplicate()


# ─────────────────────────────────────
# Публичные сервисные функции
# ─────────────────────────────────────
async def get_collection(
    db: AsyncSession,
    collection_id: int,
    user_id: int,
) -> Collection:
    """Получить коллекцию по id (с проверкой владения)."""
    return await _get_owned_collection(db, collection_id, user_id)


async def list_root_collections(
    db: AsyncSession,
    user_id: int,
) -> list[Collection]:
    """Коллекции верхнего уровня (parent_id IS NULL)."""
    return await crud_collection.list_user_collections(db, user_id, parent_id=None)


async def list_children(
    db: AsyncSession,
    user_id: int,
    parent_id: int,
) -> list[Collection]:
    """Дочерние коллекции указанного parent_id.

    Проверяем, что родитель существует и принадлежит юзеру.
    """
    await _get_owned_collection(db, parent_id, user_id)
    return await crud_collection.list_user_collections(db, user_id, parent_id=parent_id)


async def search_collections(
    db: AsyncSession,
    user_id: int,
    query_str: str,
) -> list[Collection]:
    """Поиск коллекций по подстроке в названии."""
    return await crud_collection.search_collections_by_name(db, user_id, query_str)


def _sort_tree(nodes: list[CollectionTreeNode]) -> None:
    """Рекурсивная сортировка дерева по имени (in-place).

    БД уже отдаёт строки в нужном порядке, но явная сортировка
    в Python — дополнительная страховка:
      - не зависит от того, поменяет ли кто-то ORDER BY в CRUD;
      - сортируем регистронезависимо (БД может ронять кириллицу
        в зависимости от collation).
    """
    nodes.sort(key=lambda n: n.name.casefold())
    for node in nodes:
        if node.children:
            _sort_tree(node.children)


async def build_tree(
    db: AsyncSession,
    user_id: int,
) -> list[CollectionTreeNode]:
    """Строит дерево коллекций юзера для рендеринга сайдбара.

    Алгоритм:
      1. Достаём ВСЕ коллекции юзера одним запросом.
      2. В памяти строим словарь {id → CollectionTreeNode}.
      3. Раскладываем по родителям, формируем дерево.
      4. Сортируем регистронезависимо на каждом уровне.

    Этот подход в разы эффективнее рекурсивных запросов,
    т.к. БД хитуется один раз, остальное — Python в памяти.
    """
    rows = await crud_collection.list_all_user_collections(db, user_id)

    nodes: dict[int, CollectionTreeNode] = {
        row.id: CollectionTreeNode(
            id=row.id,
            name=row.name,
            icon=row.icon,
            parent_id=row.parent_id,
            created_at=row.created_at,
            children=[],
        )
        for row in rows
    }

    roots: list[CollectionTreeNode] = []
    for node in nodes.values():
        if node.parent_id is None:
            roots.append(node)
        else:
            parent = nodes.get(node.parent_id)
            if parent is not None:
                parent.children.append(node)

    _sort_tree(roots)
    return roots


async def create_collection(
    db: AsyncSession,
    *,
    user_id: int,
    name: str,
    parent_id: int | None,
    icon: str | None,
) -> Collection:
    """Создание коллекции с проверкой родителя и дублей."""
    await _ensure_parent_valid(db, user_id, parent_id)
    await _ensure_name_unique(db, user_id, parent_id, name)

    return await crud_collection.create_collection(
        db,
        user_id=user_id,
        name=name,
        parent_id=parent_id,
        icon=icon,
    )


async def update_collection(
    db: AsyncSession,
    *,
    collection_id: int,
    user_id: int,
    new_name: str | None,
    new_parent_id: int | None,
    new_icon: str | None,
    parent_id_provided: bool,
    icon_provided: bool,
) -> Collection:
    """Обновление коллекции (имя / родитель / иконка).

    Особенность параметров `*_provided`:
      В PATCH семантика тонкая: `None` может означать "сбросить значение"
      или "поле не передано". Чтобы их различать, роут передаёт явные
      флаги, основанные на model_fields_set.

      - parent_id_provided=True + new_parent_id=None → переместить в корень
      - parent_id_provided=False → не трогать parent
      - icon_provided=True + new_icon=None → сбросить иконку
      - icon_provided=False → не трогать иконку
    """
    collection = await _get_owned_collection(db, collection_id, user_id)

    fields_to_update: dict = {}

    if new_name is not None:
        target_parent_id = (
            new_parent_id if parent_id_provided else collection.parent_id
        )
        await _ensure_name_unique(
            db,
            user_id=user_id,
            parent_id=target_parent_id,
            name=new_name,
            exclude_id=collection.id,
        )
        fields_to_update["name"] = new_name

    if parent_id_provided:
        await _ensure_parent_valid(
            db,
            user_id=user_id,
            parent_id=new_parent_id,
            moving_collection_id=collection.id,
        )
        if new_name is None:
            await _ensure_name_unique(
                db,
                user_id=user_id,
                parent_id=new_parent_id,
                name=collection.name,
                exclude_id=collection.id,
            )
        fields_to_update["parent_id"] = new_parent_id

    if icon_provided:
        fields_to_update["icon"] = new_icon

    if fields_to_update:
        await crud_collection.update_collection(db, collection, **fields_to_update)

    return collection


async def delete_collection(
    db: AsyncSession,
    *,
    collection_id: int,
    user_id: int,
) -> None:
    """Удаление коллекции (каскадно — со всеми детьми и материалами)."""
    collection = await _get_owned_collection(db, collection_id, user_id)
    await crud_collection.delete_collection(db, collection)