"""HTTP-эндпоинты для коллекций (папок материалов).

Все эндпоинты требуют авторизации (CurrentUser).
Проверки владения и бизнес-правила — в сервисном слое.
"""

from fastapi import APIRouter, Query, status

from app.core.dependencies import CurrentUser, DB
from app.schemas.collection import (
    CollectionCreate,
    CollectionResponse,
    CollectionTreeNode,
    CollectionUpdate,
)
from app.services import collection as collection_service

router = APIRouter(prefix="/collections", tags=["Collections"])


# ══════════════════════════════════════════
# READ
# ══════════════════════════════════════════

@router.get(
    "/tree",
    response_model=list[CollectionTreeNode],
    summary="Дерево коллекций юзера",
)
async def get_tree(db: DB, user: CurrentUser):
    """Все коллекции юзера в виде иерархического дерева — для сайдбара."""
    return await collection_service.build_tree(db, user.id)


@router.get(
    "",
    response_model=list[CollectionResponse],
    summary="Список коллекций (плоский)",
)
async def list_collections(
    db: DB,
    user: CurrentUser,
    parent_id: int | None = Query(
        None,
        description="ID родителя; не передавай для корневых коллекций",
    ),
    search: str | None = Query(
        None,
        min_length=1,
        max_length=200,
        description="Поиск по подстроке (приоритетнее parent_id)",
    ),
):
    """Плоский список коллекций. Три режима:

      - `?search=физик` → поиск по всем уровням
      - `?parent_id=42` → дети коллекции 42
      - без параметров   → корневые коллекции (parent_id IS NULL)
    """
    if search is not None:
        return await collection_service.search_collections(db, user.id, search)
    if parent_id is not None:
        return await collection_service.list_children(db, user.id, parent_id)
    return await collection_service.list_root_collections(db, user.id)


@router.get(
    "/{collection_id}",
    response_model=CollectionResponse,
    summary="Получить коллекцию по id",
)
async def get_collection(collection_id: int, db: DB, user: CurrentUser):
    return await collection_service.get_collection(db, collection_id, user.id)


# ══════════════════════════════════════════
# CREATE
# ══════════════════════════════════════════

@router.post(
    "",
    response_model=CollectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать коллекцию",
)
async def create_collection(body: CollectionCreate, db: DB, user: CurrentUser):
    return await collection_service.create_collection(
        db,
        user_id=user.id,
        name=body.name,
        parent_id=body.parent_id,
        icon=body.icon,
    )


# ══════════════════════════════════════════
# UPDATE
# ══════════════════════════════════════════

@router.patch(
    "/{collection_id}",
    response_model=CollectionResponse,
    summary="Обновить коллекцию (имя / родитель / иконка)",
)
async def update_collection(
    collection_id: int,
    body: CollectionUpdate,
    db: DB,
    user: CurrentUser,
):
    """PATCH-семантика: передавай только те поля, что меняешь.

    Важно: чтобы отличить «поле не передано» от «передано null»
    (например, переместить в корень → parent_id=null), сервис
    получает флаги `*_provided`, основанные на model_fields_set.
    """
    fields_set = body.model_fields_set
    return await collection_service.update_collection(
        db,
        collection_id=collection_id,
        user_id=user.id,
        new_name=body.name,
        new_parent_id=body.parent_id,
        new_icon=body.icon,
        parent_id_provided="parent_id" in fields_set,
        icon_provided="icon" in fields_set,
    )


# ══════════════════════════════════════════
# DELETE
# ══════════════════════════════════════════

@router.delete(
    "/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить коллекцию (каскадно — со всеми детьми и материалами)",
)
async def delete_collection(collection_id: int, db: DB, user: CurrentUser):
    await collection_service.delete_collection(
        db,
        collection_id=collection_id,
        user_id=user.id,
    )
    return None