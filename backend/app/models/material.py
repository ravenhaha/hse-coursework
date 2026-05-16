from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime
from sqlalchemy import (
    String, DateTime, ForeignKey, Text, Boolean,
    CheckConstraint, BigInteger, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.collection import Collection
    from app.models.tag import Tag


class Material(Base):
    """Материал — текстовая заметка ИЛИ загруженный файл.

    Семантика полей в зависимости от source_type:
      - "text": text_content = HTML от юзера; file_path/file_size/extracted_text = NULL
      - "file": file_path + file_size заполнены;
                extracted_text = HTML от парсера (опционально, для поиска/превью);
                text_content = NULL.

    material_name — название карточки в UI. Используется и при скачивании
    как имя файла. original_name НЕ хранится — это упрощает модель.
    """

    __tablename__ = "materials"

    __table_args__ = (
        # Допустимые значения source_type. CHECK вместо SQL ENUM —
        # чтобы добавлять новые типы без болезненного ALTER TYPE в Postgres.
        CheckConstraint(
            "source_type IN ('text', 'file')",
            name="source_type_valid",
        ),
        CheckConstraint(
            # Текстовый материал
            "(source_type = 'text' "
            " AND text_content IS NOT NULL "
            " AND file_path IS NULL "
            " AND file_size IS NULL "
            " AND extracted_text IS NULL) "
            "OR "
            # Файловый материал (extracted_text может быть NULL, если парсер не сработал)
            "(source_type = 'file' "
            " AND file_path IS NOT NULL "
            " AND file_size IS NOT NULL "
            " AND text_content IS NULL)",
            name="source_content_match",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"),
        index=True,
    )

    material_name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(20))

    # Содержимое — для source_type='text' (HTML от TipTap-редактора)
    text_content: Mapped[str | None] = mapped_column(Text, default=None)

    # Файл — для source_type='file'
    file_path: Mapped[str | None] = mapped_column(String(500), default=None)
    file_size: Mapped[int | None] = mapped_column(BigInteger, default=None)
    extracted_text: Mapped[str | None] = mapped_column(Text, default=None)

    is_important: Mapped[bool] = mapped_column(Boolean, default=False)
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