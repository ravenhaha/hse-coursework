"""Схемы для коллекций (папок материалов) с поддержкой иерархии."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CollectionBase(BaseModel):
    """Общие поля для создания и обновления коллекции."""

    name: str = Field(..., min_length=1, max_length=100)
    icon: str | None = Field(
        None,
        max_length=10,
        description="Emoji-иконка коллекции, например '📚'. null = без иконки.",
    )
    parent_id: int | None = Field(
        None,
        description="ID родительской коллекции; null = корень",
    )


class CollectionCreate(CollectionBase):
    """Тело POST /collections."""


class CollectionUpdate(BaseModel):
    """Тело PATCH /collections/{id}. Все поля опциональны.

    Семантика "не передано" vs "передано null":
      - поле отсутствует в JSON → не трогаем;
      - поле передано как null → сбрасываем (или перемещаем в корень для parent_id).

    Различение делается в роуте через `model_fields_set`.
    """

    name: str | None = Field(None, min_length=1, max_length=100)
    icon: str | None = Field(
        None,
        max_length=10,
        description="Emoji-иконка. Передать null, чтобы сбросить иконку.",
    )
    parent_id: int | None = Field(
        None,
        description="ID нового родителя. Передать null, чтобы переместить в корень.",
    )


class CollectionResponse(BaseModel):
    """Плоское представление коллекции (без вложенных детей)."""

    id: int
    user_id: int
    name: str
    icon: str | None = None
    parent_id: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CollectionTreeNode(BaseModel):
    """Узел дерева коллекций — рекурсивно содержит детей.

    Используется в GET /collections/tree для отрисовки сайдбара.
    """

    id: int
    name: str
    icon: str | None = None
    parent_id: int | None = None
    created_at: datetime
    children: list["CollectionTreeNode"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


CollectionTreeNode.model_rebuild()