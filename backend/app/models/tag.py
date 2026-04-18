from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

if TYPE_CHECKING:
    from models.user import User
    from models.material import Material


class Tag(Base):
    """
    Тег — метка для группировки материалов.

    Теги принадлежат конкретному пользователю.
    Один материал может иметь несколько тегов,
    один тег может быть на нескольких материалах (Many-to-Many).

    UNIQUE(user_id, tag_name) — у одного юзера не может быть двух одинаковых тегов.
    """
    __tablename__ = "tags"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "tag_name",
            name = "uq_tag_user_name"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    tag_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped[User] = relationship(back_populates="tags")
    materials: Mapped[list[Material]] = relationship(secondary="material_tags", back_populates="tags")