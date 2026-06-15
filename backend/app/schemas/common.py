"""Общие схемы: пагинация, обёртки ответов."""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Query-параметры пагинации.

    Используется через Depends() в роутах:
        async def list_(pagination: PaginationParams = Depends()):
            ...
    """
    limit: int = Field(50, ge=1, le=200, description="Размер страницы")
    offset: int = Field(0, ge=0, description="Смещение")


class Page(BaseModel, Generic[T]):
    """Стандартная обёртка для пагинированных ответов."""
    items: list[T]
    total: int = Field(..., description="Всего записей по фильтру")
    limit: int
    offset: int
    has_more: bool = Field(..., description="Есть ли ещё данные дальше")

    @classmethod
    def build(
        cls,
        items: list[T],
        total: int,
        limit: int,
        offset: int,
    ) -> "Page[T]":
        return cls(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(items) < total,
        )