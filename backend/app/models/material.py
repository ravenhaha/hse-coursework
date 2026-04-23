# models/material.py
from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

if TYPE_CHECKING:
    from models.collection import Collection
    from models.tag import Tag


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), index=True,
    )
    material_name: Mapped[str] = mapped_column(String(100))
    source_type: Mapped[str] = mapped_column(
        Enum("text", "file", name="source_type_enum"),
    )
    text_content: Mapped[str | None] = mapped_column(Text, default=None)
    file_path: Mapped[str | None] = mapped_column(String(500), default=None)
    is_important: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
        onupdate=lambda: datetime.now(timezone.utc),
    )

    collection: Mapped[Collection] = relationship(back_populates="materials")
    tags: Mapped[list[Tag]] = relationship(
        secondary="material_tags", back_populates="materials",
    )