"""Билдеры доменных объектов для тестов — без обращения к БД.

Создают ORM-объекты с проставленными полями (включая id),
как будто они уже сохранены и прочитаны из БД.
"""

from datetime import datetime, timezone

from app.models.collection import Collection
from app.models.material import Material, SourceType
from app.models.tag import Tag
from app.models.user import User


def _now() -> datetime:
    return datetime(2026, 1, 1, tzinfo=timezone.utc)


def make_user(
    *,
    user_id: int = 1,
    email: str = "user@example.com",
    display_name: str | None = "user",
    is_active: bool = True,
    avatar_path: str | None = None,
) -> User:
    user = User(
        email=email,
        display_name=display_name,
        avatar_path=avatar_path,
    )
    user.id = user_id
    user.is_active = is_active
    user.created_at = _now()
    user.updated_at = _now()
    return user


def make_collection(
    *,
    collection_id: int = 1,
    user_id: int = 1,
    name: str = "Физика",
    parent_id: int | None = None,
    icon: str | None = None,
) -> Collection:
    collection = Collection(
        user_id=user_id,
        name=name,
        parent_id=parent_id,
        icon=icon,
    )
    collection.id = collection_id
    collection.created_at = _now()
    return collection


def make_material(
    *,
    material_id: int = 1,
    collection_id: int = 1,
    name: str = "Лекция 1",
    source_type: SourceType = SourceType.TEXT,
    text_content: str | None = "<p>текст</p>",
) -> Material:
    material = Material(
        collection_id=collection_id,
        material_name=name,
        source_type=source_type,
        text_content=text_content,
    )
    material.id = material_id
    material.is_important = False
    material.created_at = _now()
    material.updated_at = None
    material.tags = []
    return material


def make_tag(
    *,
    tag_id: int = 1,
    user_id: int = 1,
    name: str = "лекция",
) -> Tag:
    tag = Tag(user_id=user_id, tag_name=name)
    tag.id = tag_id
    tag.created_at = _now()
    return tag
