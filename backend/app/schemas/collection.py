"""Схемы для коллекций (папок материалов) с поддержкой иерархии."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ══════════════════════════════════════════════════════════
# Валидаторы (переиспользуемые)
# ══════════════════════════════════════════════════════════
def _strip_required_name(v: str) -> str:
    """Триммим пробелы; пустая строка после strip недопустима.

    Зачем: юзер вводит "  Физика  " → сохраняем "Физика".
    А "   " (одни пробелы) — это явная ошибка, отклоняем сразу,
    а не сохраняем в БД мусор и не падаем потом на UNIQUE.
    """
    v = v.strip()
    if not v:
        raise ValueError("Имя коллекции не может быть пустым")
    return v


def _strip_optional_name(v: str | None) -> str | None:
    """Версия для PATCH: None пропускаем (поле не передано — не трогаем),
    непустую строку триммим, пустую после strip отклоняем."""
    if v is None:
        return None
    return _strip_required_name(v)


def _strip_icon(v: str | None) -> str | None:
    """Иконка: триммим, пустую строку трактуем как None (сброс иконки)."""
    if v is None:
        return None
    v = v.strip()
    return v or None


# ══════════════════════════════════════════════════════════
# Схемы
# ══════════════════════════════════════════════════════════
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

    @field_validator("name")
    @classmethod
    def _v_name(cls, v: str) -> str:
        return _strip_required_name(v)

    @field_validator("icon")
    @classmethod
    def _v_icon(cls, v: str | None) -> str | None:
        return _strip_icon(v)


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

    @field_validator("name")
    @classmethod
    def _v_name(cls, v: str | None) -> str | None:
        return _strip_optional_name(v)

    @field_validator("icon")
    @classmethod
    def _v_icon(cls, v: str | None) -> str | None:
        return _strip_icon(v)


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