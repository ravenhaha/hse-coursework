"""Эндпоинт построения дерева «Мои материалы» для графовой визуализации."""

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import DB, CurrentUser
from app.models.collection import Collection
from app.models.material import Material
from app.models.material_tag import MaterialTag
from app.models.tag import Tag
from app.schemas.graph import GraphNode, GraphTreeResponse

router = APIRouter(prefix="/graph", tags=["Graph"])


@router.get("/tree", response_model=GraphTreeResponse)
async def get_graph_tree(
    user: CurrentUser,
    db: DB,
) -> GraphTreeResponse:
    """Собирает дерево коллекций и материалов текущего пользователя."""
    # 1. Коллекции — стабильный порядок (created_at, id).
    collections_result = await db.execute(
        select(Collection)
        .where(Collection.user_id == user.id)
        .order_by(Collection.created_at, Collection.id)
    )
    collections = list(collections_result.scalars().all())

    # 2. Материалы — фильтр по user через JOIN с Collection.
    materials_result = await db.execute(
        select(Material)
        .join(Collection, Material.collection_id == Collection.id)
        .where(Collection.user_id == user.id)
        .order_by(Material.created_at, Material.id)
    )
    materials = list(materials_result.scalars().all())

    # 3. Теги по материалам — один запрос, группировка в Python.
    # ⚠️ ВАЖНО: имя переменной НЕ должно совпадать с импортируемой
    # таблицей material_tags (хоть тут её и нет — это защита в глубину).
    tags_by_material_id = await _get_tags_by_material(db, user.id)

    # ── Сборка дерева ──
    collection_nodes: dict[int, GraphNode] = {
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
        if parent is None:
            continue

        parent.children = parent.children or []
        parent.children.append(
            GraphNode(
                id=f"material:{material.id}",
                name=material.material_name,
                type="document",
                tags=tags_by_material_id.get(material.id) or None,
                content=material.text_content,
            )
        )

    return GraphTreeResponse(
        id="root",
        name="Мои материалы",
        type="folder",
        children=root_children,
    )


async def _get_tags_by_material(
    db: AsyncSession,
    user_id: int,
) -> dict[int, list[str]]:
    """Возвращает {material_id: [tag_name, ...]} одним запросом.

    Защита в глубину: тройной JOIN
    Tag → MaterialTag → Material → Collection
    с фильтром по Collection.user_id гарантирует, что не утечёт
    тег чужого юзера даже при битых связях в material_tags.
    """
    result = await db.execute(
        select(MaterialTag.material_id, Tag.tag_name)
        .join(Tag, MaterialTag.tag_id == Tag.id)
        .join(Material, MaterialTag.material_id == Material.id)
        .join(Collection, Material.collection_id == Collection.id)
        .where(Collection.user_id == user_id)
        .order_by(Tag.tag_name)
    )

    tags_by_material: dict[int, list[str]] = {}
    for material_id, tag_name in result.all():
        tags_by_material.setdefault(material_id, []).append(tag_name)

    return tags_by_material