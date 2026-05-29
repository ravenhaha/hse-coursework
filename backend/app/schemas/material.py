"""Схемы для материалов (заметки, тексты, файлы)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.material import SourceType  # ← единый источник истины
from app.schemas.tag import TagResponse


class MaterialCreateText(BaseModel):
    """Создание текстового материала через POST /materials/text."""

    collection_id: int = Field(..., gt=0)
    material_name: str = Field(..., min_length=1, max_length=255)
    text_content: str = Field(..., min_length=1)


class MaterialUpdate(BaseModel):
    """Тело PATCH /materials/{id}. Все поля опциональны.

    Семантика "поле не передано" vs "поле = null":
      - Pydantic не различает их на уровне типов.
      - Для различения роут использует body.model_fields_set
        и передаёт в сервис флаги *_provided (как в update_collection).

    Ограничения (валидируются в сервисном слое):
      - text_content разрешён только для source_type='text'
      - collection_id должен принадлежать текущему юзеру
    """

    material_name: str | None = Field(None, min_length=1, max_length=255)
    text_content: str | None = Field(None, min_length=1)
    collection_id: int | None = Field(
        None,
        gt=0,
        description="Переместить в другую коллекцию",
    )
    is_important: bool | None = None


class MaterialRead(BaseModel):
    """Материал в ответах API (с тегами).

    extracted_text НЕ выдаётся в списках — он тяжёлый. Только в отдельном
    эндпоинте превью (если понадобится).

    Инвариант (поддерживается БД, не схемой):
      - source_type='text' → text_content NOT NULL, file_path IS NULL
      - source_type='file' → file_path NOT NULL, text_content IS NULL
    """

    id: int
    collection_id: int
    material_name: str
    source_type: SourceType
    text_content: str | None = None
    file_path: str | None = None
    file_size: int | None = None
    is_important: bool
    created_at: datetime
    updated_at: datetime | None = None
    tags: list[TagResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)