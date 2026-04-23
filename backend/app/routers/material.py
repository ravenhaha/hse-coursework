import os
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from core.dependencies import get_current_user
from core.exceptions import file_too_large, file_type_not_allowed
from core.file_storage import save_file
from models.user import User
from schemas.material import MaterialCreateText, MaterialRead, MaterialUpdate
from services.material import (
    list_materials,
    get_material,
    create_text_material,
    create_file_material,
    update_existing_material,
    delete_existing_material,
    search_materials,
)

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".md", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024

router = APIRouter(prefix="/materials", tags=["Materials"])


@router.get("/search", response_model=list[MaterialRead])
async def search_materials_route(
    q: str = Query("", max_length=200),
    collection_id: int | None = Query(None),
    tag_ids: list[int] = Query([]),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await search_materials(
        db, user, q, collection_id, tag_ids or None,
    )


@router.get("/", response_model=list[MaterialRead])
async def get_materials(
    collection_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await list_materials(db, user, collection_id)


@router.get("/{material_id}", response_model=MaterialRead)
async def get_material_detail(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await get_material(db, material_id, user)


@router.post("/text", response_model=MaterialRead, status_code=201)
async def create_text(
    body: MaterialCreateText,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await create_text_material(
        db, user, body.collection_id, body.material_name, body.text_content,
    )


@router.post("/file", response_model=MaterialRead, status_code=201)
async def create_from_file(
    collection_id: int = Form(...),
    material_name: str = Form(..., min_length=1, max_length=100),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        file_type_not_allowed(ext, ALLOWED_EXTENSIONS)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        file_too_large(MAX_FILE_SIZE // (1024 * 1024))

    file_path = await save_file(user.id, file.filename, content)

    return await create_file_material(
        db, user, collection_id, material_name, file_path,
    )


@router.patch("/{material_id}", response_model=MaterialRead)
async def update_material_route(
    material_id: int,
    body: MaterialUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await update_existing_material(
        db,
        material_id,
        user,
        material_name=body.material_name,
        text_content=body.text_content,
        collection_id=body.collection_id,    # ← НОВОЕ: перемещение
        is_important=body.is_important,       # ← НОВОЕ: пометка «важно»
    )


@router.delete("/{material_id}", status_code=204)
async def delete_material_route(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await delete_existing_material(db, material_id, user)