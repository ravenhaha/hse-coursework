"""Модель Collection — иерархическая коллекция материалов пользователя.

Структура: дерево произвольной глубины (parent_id ссылается на ту же таблицу).
Корневые коллекции имеют parent_id=NULL.

Целостность дерева:
    - Циклы (A→B→A) на уровне БД НЕ запрещены — проверяются в сервисе
      при изменении parent_id.
    - Принадлежность parent.user_id == self.user_id тоже проверяется
      в сервисе (можно усилить композитным FK, но это усложняет миграции).
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.material import Material


class Collection(Base):
    __tablename__ = "collections"

    __table_args__ = (
        Index(
            None,
            "user_id", "parent_id", "name",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),

        Index(None, "user_id", "parent_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str | None] = mapped_column(String(16), default=None)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"),
        default=None,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="collections")
    parent: Mapped[Collection | None] = relationship(
        back_populates="children",
        remote_side="Collection.id",
    )
    children: Mapped[list[Collection]] = relationship(
        back_populates="parent",
        cascade="save-update, merge",
        passive_deletes=True,
        lazy="selectin",
    )
    materials: Mapped[list[Material]] = relationship(
        back_populates="collection",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )