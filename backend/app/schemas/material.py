"""Схемы для материалов (заметки, тексты, файлы)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.tag import TagResponse


class MaterialCreateText(BaseModel):
    """Создание текстового материала через POST /materials/text."""

    collection_id: int
    material_name: str = Field(..., min_length=1, max_length=255)
    text_content: str = Field(..., min_length=1)


class MaterialUpdate(BaseModel):
    """Тело PATCH /materials/{id}. Все поля опциональны.

    Юзер может:
      - переименовать материал (material_name)
      - отредактировать содержимое текста (text_content) — только для source_type='text'
      - переместить в другую коллекцию (collection_id)
      - пометить как важное (is_important)
    """

    material_name: str | None = Field(None, min_length=1, max_length=255)
    text_content: str | None = Field(None, min_length=1)
    collection_id: int | None = Field(
        None,
        description="Переместить в другую коллекцию",
    )
    is_important: bool | None = None


class MaterialRead(BaseModel):
    """Материал в ответах API (с тегами).

    extracted_text НЕ выдаётся в списках — он тяжёлый. Только в отдельном
    эндпоинте превью (если понадобится).
    """

    id: int
    collection_id: int
    material_name: str
    source_type: Literal["text", "file"]
    text_content: str | None = None
    file_path: str | None = None
    file_size: int | None = None
    is_important: bool
    created_at: datetime
    updated_at: datetime | None = None
    tags: list[TagResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)