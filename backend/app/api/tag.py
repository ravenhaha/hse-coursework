from fastapi import APIRouter

from app.core.dependencies import CurrentUser, DB
from app.schemas.tag import (
    MaterialTagsSet,
    TagAssign,
    TagCreate,
    TagResponse,
    TagUpdate,
)
from app.services.tag import (
    assign_tag,
    create_new_tag,
    delete_existing_tag,
    get_material_tags,
    get_tag,
    list_tags,
    set_material_tags_bulk,
    unassign_tag,
    update_existing_tag,
)

router = APIRouter(prefix="/tags", tags=["Tags"])

@router.get("/materials/{material_id}", response_model=list[TagResponse])
async def list_material_tags_route(
    material_id: int,
    db: DB,
    user: CurrentUser,
):
    """Все теги, привязанные к материалу."""
    return await get_material_tags(db, user, material_id)


@router.post("/materials/{material_id}", status_code=201)
async def assign_tag_route(
    material_id: int,
    body: TagAssign,
    db: DB,
    user: CurrentUser,
):
    """Привязать один тег к материалу."""
    await assign_tag(db, user, material_id, body.tag_id)
    return {"detail": "Тег привязан"}


@router.put("/materials/{material_id}")
async def set_tags_for_material(
    material_id: int,
    body: MaterialTagsSet,
    db: DB,
    user: CurrentUser,
):
    """Bulk: полностью заменить набор тегов у материала."""
    tag_ids = await set_material_tags_bulk(db, user, material_id, body.tag_ids)
    return {"material_id": material_id, "tag_ids": tag_ids}


@router.delete("/materials/{material_id}/{tag_id}", status_code=204)
async def unassign_tag_route(
    material_id: int,
    tag_id: int,
    db: DB,
    user: CurrentUser,
):
    """Снять конкретный тег с материала."""
    await unassign_tag(db, user, material_id, tag_id)


# ─── CRUD тегов ───
@router.get("", response_model=list[TagResponse])
async def get_tags(
    db: DB,
    user: CurrentUser,
):
    """Все теги юзера (включая дефолтные)."""
    return await list_tags(db, user)


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag_detail(
    tag_id: int,
    db: DB,
    user: CurrentUser,
):
    """Один тег по id."""
    return await get_tag(db, tag_id, user)


@router.post("", response_model=TagResponse, status_code=201)
async def create_tag_route(
    body: TagCreate,
    db: DB,
    user: CurrentUser,
):
    """Создать новый тег."""
    return await create_new_tag(db, user, body.tag_name)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag_route(
    tag_id: int,
    body: TagUpdate,
    db: DB,
    user: CurrentUser,
):
    """Переименовать тег. tag_name теперь обязательный (см. схему)."""
    return await update_existing_tag(db, tag_id, user, body.tag_name)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag_route(
    tag_id: int,
    db: DB,
    user: CurrentUser,
):
    """Удалить тег. Связи в material_tags падают каскадом."""
    await delete_existing_tag(db, tag_id, user)