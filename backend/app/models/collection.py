from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

if TYPE_CHECKING:
    from models.user import User
    from models.material import Material


class Collection(Base):
    """
    Коллекция — папка для группировки материалов.

    Поддерживает вложенность (parent_id → self).
    Принадлежит конкретному пользователю.
    UNIQUE(user_id, parent_id, collection_name) — нельзя создать
    две коллекции с одинаковым именем на одном уровне вложенности.
    """
    __tablename__ = "collections"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "parent_id",
            "collection_name",
            name = "uq_collection_user_parent_name"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    collection_name: Mapped[str] = mapped_column(String(500))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), default=None,)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    user: Mapped[User] = relationship(back_populates="collections")
    parent: Mapped[Collection | None] = relationship(back_populates="children", remote_side="Collection.id")
    children: Mapped[list[Collection]] = relationship(back_populates="parent", cascade="all, delete-orphan", lazy="selectin",)
    materials: Mapped[list[Material]] = relationship(back_populates="collection", cascade="all, delete-orphan")