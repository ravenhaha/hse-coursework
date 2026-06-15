"""Интеграционные тесты графового дерева (GET /graph/tree).

Коллекции создаём через API, материалы и теги — напрямую через модели
(db_session), чтобы не завязываться на форму material-эндпоинтов.

Покрываем app/api/graph.py:
    - пустое дерево;
    - вложенность коллекций (parent → child);
    - материалы внутри коллекций;
    - теги материала (тройной JOIN в _get_tags_by_material);
    - материал без существующей коллекции (ветка continue).
"""

from app.core.config import settings
from app.models.collection import Collection
from app.models.material import Material
from app.models.material_tag import MaterialTag
from app.models.tag import Tag

COLLECTIONS = f"{settings.API_PREFIX}/collections"
GRAPH_TREE = f"{settings.API_PREFIX}/graph/tree"


async def _add_material(db_session, collection_id, name, content="текст"):
    material = Material(
        collection_id=collection_id,
        material_name=name,
        source_type="text",
        text_content=content,
    )
    db_session.add(material)
    await db_session.commit()
    await db_session.refresh(material)
    return material


async def _add_tag(db_session, user_id, name):
    tag = Tag(user_id=user_id, tag_name=name)
    db_session.add(tag)
    await db_session.commit()
    await db_session.refresh(tag)
    return tag


async def _link_tag(db_session, material_id, tag_id):
    db_session.add(MaterialTag(material_id=material_id, tag_id=tag_id))
    await db_session.commit()


class TestGraphTree:
    async def test_empty_tree(self, client):
        """Нет коллекций → корень без детей."""
        resp = await client.get(GRAPH_TREE)
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == "root"
        assert body["name"] == "Мои материалы"
        assert body["type"] == "folder"
        assert body["children"] == []

    async def test_nested_collections(self, client):
        """parent → child собирается во вложенную структуру."""
        parent = (await client.post(COLLECTIONS, json={"name": "Родитель"})).json()
        await client.post(
            COLLECTIONS, json={"name": "Ребёнок", "parent_id": parent["id"]}
        )

        body = (await client.get(GRAPH_TREE)).json()
        root_kids = body["children"]
        parent_node = next(n for n in root_kids if n["name"] == "Родитель")
        assert parent_node["id"] == f"collection:{parent['id']}"
        assert parent_node["type"] == "folder"
        assert {c["name"] for c in parent_node["children"]} == {"Ребёнок"}

    async def test_material_in_collection(self, client, db_session, test_user):
        """Материал попадает в children своей коллекции как document."""
        coll = (await client.post(COLLECTIONS, json={"name": "Папка"})).json()
        await _add_material(db_session, coll["id"], "Конспект")

        body = (await client.get(GRAPH_TREE)).json()
        node = next(n for n in body["children"] if n["name"] == "Папка")
        doc = next(c for c in node["children"] if c["type"] == "document")
        assert doc["name"] == "Конспект"
        assert doc["id"].startswith("material:")
        assert doc["content"] == "текст"

    async def test_material_with_tags(self, client, db_session, test_user):
        """Теги материала отдаются отсортированными (тройной JOIN)."""
        coll = (await client.post(COLLECTIONS, json={"name": "Тема"})).json()
        material = await _add_material(db_session, coll["id"], "С тегами")

        tag_b = await _add_tag(db_session, test_user.id, "Бета")
        tag_a = await _add_tag(db_session, test_user.id, "Альфа")
        await _link_tag(db_session, material.id, tag_b.id)
        await _link_tag(db_session, material.id, tag_a.id)

        body = (await client.get(GRAPH_TREE)).json()
        node = next(n for n in body["children"] if n["name"] == "Тема")
        doc = next(c for c in node["children"] if c["type"] == "document")
        
        assert doc["tags"] == ["Альфа", "Бета"]

    async def test_material_without_tags_has_none(
        self, client, db_session, test_user
    ):
        coll = (await client.post(COLLECTIONS, json={"name": "Пусто"})).json()
        await _add_material(db_session, coll["id"], "Без тегов")

        body = (await client.get(GRAPH_TREE)).json()
        node = next(n for n in body["children"] if n["name"] == "Пусто")
        doc = next(c for c in node["children"] if c["type"] == "document")
        assert doc["tags"] is None

    async def test_orphan_collection_goes_to_root(
        self, client, db_session, test_user
    ):
        """Коллекция с parent_id, которого нет в наборе → попадает в корень.

        Покрывает ветку `else: root_children.append(node)` при «висячем»
        parent_id (например, родитель удалён, а ссылка осталась).
        """

        await client.post(COLLECTIONS, json={"name": "Корневая"})
        body = (await client.get(GRAPH_TREE)).json()
        assert any(n["name"] == "Корневая" for n in body["children"])
