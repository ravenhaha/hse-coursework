from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from core.dependencies import get_current_user
from core.constants import UNSET
from models.user import User
from schemas.collection import CollectionCreate, CollectionUpdate, CollectionResponse
from services.collection import (
    list_collections,
    get_collection,
    create_new_collection,
    update_existing_collection,
    delete_existing_collection,
    search_collections,  # ДОБАВЛЕНО
)

router = APIRouter(prefix="/collections", tags=["Collections"])


# ДОБАВЛЕНО: поиск — ВАЖНО: этот роут ВЫШЕ /{collection_id}
# иначе FastAPI воспримет "search" как collection_id
@router.get("/search", response_model=list[CollectionResponse])
async def search_collections_route(
    q: str = Query(..., min_length=1, max_length=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await search_collections(db, user, q)


@router.get("/", response_model=list[CollectionResponse])
async def get_collections(
    parent_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await list_collections(db, user, parent_id)


@router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection_detail(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await get_collection(db, collection_id, user)


@router.post("/", response_model=CollectionResponse, status_code=201)
async def create_collection_route(
    body: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await create_new_collection(
        db, user, body.collection_name, body.parent_id,
    )


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection_route(
    collection_id: int,
    body: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    parent_id = body.parent_id if "parent_id" in body.model_fields_set else UNSET
    return await update_existing_collection(
        db, collection_id, user, body.collection_name, parent_id,
    )


@router.delete("/{collection_id}", status_code=204)
async def delete_collection_route(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await delete_existing_collection(db, collection_id, user)