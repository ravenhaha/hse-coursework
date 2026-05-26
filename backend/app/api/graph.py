from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import token_invalid, token_missing, user_not_found
from app.core.security import decode_token
from app.db.session import get_db
from app.models.collection import Collection
from app.models.material import Material
from app.models.material_tag import MaterialTag
from app.models.tag import Tag
from app.models.user import User
from app.schemas.graph import GraphNode, GraphTreeResponse

router = APIRouter(prefix="/graph", tags=["Graph"])


async def get_current_user(request: Request, db: AsyncSession) -> User:
    token = request.cookies.get("access_token")
    if not token:
        token_missing()

    payload = decode_token(token)
    if not payload:
        token_invalid()

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        user_not_found()

    return user


@router.get("/tree", response_model=GraphTreeResponse)
async def get_graph_tree(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> GraphTreeResponse:
    user = await get_current_user(request, db)

    collections_result = await db.execute(
        select(Collection)
        .where(Collection.user_id == user.id)
        .order_by(Collection.created_at, Collection.id)
    )
    collections = list(collections_result.scalars().all())

    materials_result = await db.execute(
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .where(Collection.user_id == user.id)
        .order_by(Material.created_at, Material.id)
    )
    materials = list(materials_result.scalars().all())

    material_tags = await get_material_tags(db, user.id)
    collection_nodes = {
        collection.id: GraphNode(
            id=f"collection:{collection.id}",
            name=collection.name,
            type="folder",
            children=[],
        )
        for collection in collections
    }

    root_children: list[GraphNode] = []
    for collection in collections:
        node = collection_nodes[collection.id]
        if collection.parent_id and collection.parent_id in collection_nodes:
            parent = collection_nodes[collection.parent_id]
            parent.children = parent.children or []
            parent.children.append(node)
        else:
            root_children.append(node)

    for material in materials:
        parent = collection_nodes.get(material.collection_id)
        if not parent:
            continue

        parent.children = parent.children or []
        parent.children.append(
            GraphNode(
                id=f"material:{material.id}",
                name=material.material_name,
                type="document",
                tags=material_tags.get(material.id) or None,
                content=material.text_content,
            )
        )

    return GraphTreeResponse(
        id="root",
        name="Мои материалы",
        type="folder",
        children=root_children,
    )


async def get_material_tags(db: AsyncSession, user_id: int) -> dict[int, list[str]]:
    result = await db.execute(
        select(MaterialTag.material_id, Tag.tag_name)
        .join(Tag, MaterialTag.tag_id == Tag.id)
        .where(Tag.user_id == user_id)
        .order_by(Tag.tag_name)
    )

    tags_by_material: dict[int, list[str]] = {}
    for material_id, tag_name in result.all():
        tags_by_material.setdefault(material_id, []).append(tag_name)

    return tags_by_material
