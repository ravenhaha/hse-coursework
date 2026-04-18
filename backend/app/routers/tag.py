from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.tag import TagCreate, TagUpdate, TagResponse, TagAssign
from services.tag import (
    list_tags,
    get_tag,
    create_new_tag,
    update_existing_tag,
    delete_existing_tag,
    assign_tag,
    unassign_tag,
    get_material_tags,
)

router = APIRouter(prefix="/tags", tags=["Tags"])


# ─── Привязка тегов к материалам (ВЫШЕ чем /{tag_id}) ───

@router.get("/materials/{material_id}", response_model=list[TagResponse])
async def get_tags_for_material(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await get_material_tags(db, user, material_id)


@router.post("/materials/{material_id}", status_code=201)
async def assign_tag_route(
    material_id: int,
    body: TagAssign,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await assign_tag(db, user, material_id, body.tag_id)
    return {"detail": "Тег привязан"}


@router.delete("/materials/{material_id}/{tag_id}", status_code=204)
async def unassign_tag_route(
    material_id: int,
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await unassign_tag(db, user, material_id, tag_id)


# ─── CRUD тегов ───

@router.get("/", response_model=list[TagResponse])
async def get_tags(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await list_tags(db, user)


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag_detail(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await get_tag(db, tag_id, user)


@router.post("/", response_model=TagResponse, status_code=201)
async def create_tag_route(
    body: TagCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await create_new_tag(db, user, body.tag_name)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag_route(
    tag_id: int,
    body: TagUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await update_existing_tag(db, tag_id, user, body.tag_name)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag_route(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await delete_existing_tag(db, tag_id, user)