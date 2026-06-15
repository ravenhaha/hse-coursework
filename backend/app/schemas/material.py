"""Схемы для материалов (заметки, тексты, файлы)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.material import SourceType
from app.schemas.tag import TagResponse


def _strip_required_name(value: str) -> str:
    """Убирает пробелы по краям; строка из одних пробелов недопустима.

    Аналогично коллекциям и тегам: "  Лекция 1  " → "Лекция 1",
    а "   " отклоняем сразу, чтобы не сохранять в БД визуально пустое имя.
    """
    value = value.strip()
    if not value:
        raise ValueError("Название материала не может быть пустым")
    return value


def _strip_optional_name(value: str | None) -> str | None:
    """Версия для PATCH: None не трогаем (поле не передано),
    непустую строку триммим, пустую после strip отклоняем."""
    if value is None:
        return None
    return _strip_required_name(value)


class MaterialCreateText(BaseModel):
    """Создание текстового материала через POST /materials/text."""

    collection_id: int = Field(..., gt=0)
    material_name: str = Field(..., min_length=1, max_length=255)
    text_content: str = Field(..., min_length=1)

    @field_validator("material_name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        return _strip_required_name(value)


class MaterialUpdate(BaseModel):
    """Тело PATCH /materials/{id}. Все поля опциональны."""

    material_name: str | None = Field(None, min_length=1, max_length=255)
    text_content: str | None = Field(None, min_length=1)
    collection_id: int | None = Field(
        None,
        gt=0,
        description="Переместить в другую коллекцию",
    )
    is_important: bool | None = None

    @field_validator("material_name")
    @classmethod
    def _validate_name(cls, value: str | None) -> str | None:
        return _strip_optional_name(value)


class MaterialRead(BaseModel):
    """Материал в ответах API (с тегами)."""

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


class MaterialsSummaryTypeCounts(BaseModel):
    text: int = 0
    file: int = 0


class MaterialsSummaryItem(BaseModel):
    id: int
    name: str
    count: int


class MaterialsSummary(BaseModel):
    total: int
    byType: MaterialsSummaryTypeCounts = Field(default_factory=MaterialsSummaryTypeCounts)
    byCollection: list[MaterialsSummaryItem] = Field(default_factory=list)
    byTag: list[MaterialsSummaryItem] = Field(default_factory=list)
