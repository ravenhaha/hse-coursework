"""Модель Material — текстовая заметка или загруженный файл.

(... твой исходный docstring без изменений ...)
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from enum import StrEnum
from datetime import datetime

from sqlalchemy import (
    String, DateTime, ForeignKey, Text, Boolean,
    CheckConstraint, BigInteger, func, Index,
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

    # 🆕 server_default — чтобы прямые INSERT'ы и старые миграции не падали
    # с NOT NULL violation. ORM-default остаётся для удобства Python-кода.
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