"""Схемы для тегов и привязки тегов к материалам.

Регистр имени:
  Сохраняем оригинальный регистр как ввёл юзер ("Физика", "PYTHON").
  Уникальность проверяется case-insensitive — на уровне БД через
  функциональный UNIQUE INDEX (user_id, lower(tag_name)).
  Поэтому здесь только trim, без lower().
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip_tag_name(v: str) -> str:
    """Триммим пробелы; пустую строку отклоняем."""
    v = v.strip()
    if not v:
        raise ValueError("Имя тега не может быть пустым")
    return v


class TagBase(BaseModel):
    """Общие поля тега."""

    tag_name: str = Field(..., min_length=1, max_length=50)

    @field_validator("tag_name")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return _strip_tag_name(v)


class TagCreate(TagBase):
    """Тело POST /tags."""


class TagUpdate(BaseModel):
    """Тело PATCH /tags/{id}.

    Сейчас у тега только одно редактируемое поле — имя. Поэтому
    делаем его обязательным: PATCH без tag_name бессмыслен.
    Если когда-то появятся другие поля (color, icon) — сделаем
    все Optional и проверим в сервисе.
    """

    tag_name: str = Field(..., min_length=1, max_length=50)

    @field_validator("tag_name")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return _strip_tag_name(v)


class TagResponse(BaseModel):
    """Тег в ответах API."""

    id: int
    user_id: int
    tag_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TagAssign(BaseModel):
    """Тело POST /materials/{id}/tags — привязать один тег."""

    tag_id: int


class MaterialTagsSet(BaseModel):
    """Тело PUT /tags/materials/{material_id} — bulk-замена набора тегов.

    max_length=100 — защита от DoS: если юзер пришлёт огромный список,
    мы быстро его отклоним без похода в БД. 100 тегов на материал —
    с запасом для любых реальных сценариев.
    """

    tag_ids: list[int] = Field(default_factory=list, max_length=100)