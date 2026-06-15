"""Модель Material — текстовая заметка или загруженный файл.

Материал принадлежит коллекции (collection_id), коллекция — пользователю.
Доступ к материалу определяется через владение коллекцией.

Два типа источника (source_type):
    - TEXT: заметка из редактора. Контент в text_content (HTML).
    - FILE: загруженный файл. Путь в file_path, размер в file_size,
      извлечённый для поиска текст — в extracted_text.

Целостность типа и контента гарантируется CHECK-констрейнтами на уровне БД
(source_type_valid и source_content_match).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.collection import Collection
    from app.models.tag import Tag


class SourceType(StrEnum):
    TEXT = "text"
    FILE = "file"


class Material(Base):
    __tablename__ = "materials"

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('text', 'file')",
            name="source_type_valid",
        ),
        CheckConstraint(
            "(source_type = 'text' "
            " AND text_content IS NOT NULL "
            " AND file_path IS NULL "
            " AND file_size IS NULL "
            " AND extracted_text IS NULL) "
            "OR "
            "(source_type = 'file' "
            " AND file_path IS NOT NULL "
            " AND file_size IS NOT NULL "
            " AND text_content IS NULL)",
            name="source_content_match",
        ),
        Index(
            None,
            "collection_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"),
        index=True,
    )

    material_name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[SourceType] = mapped_column(String(20))

    text_content: Mapped[str | None] = mapped_column(Text, default=None)

    file_path: Mapped[str | None] = mapped_column(String(500), default=None)
    file_size: Mapped[int | None] = mapped_column(BigInteger, default=None)
    extracted_text: Mapped[str | None] = mapped_column(Text, default=None)

    is_important: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
        onupdate=func.now(),
    )

    collection: Mapped[Collection] = relationship(back_populates="materials")

    tags: Mapped[list[Tag]] = relationship(
        secondary="material_tags",
        back_populates="materials",
        lazy="selectin",
    )
