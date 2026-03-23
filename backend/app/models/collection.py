from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base

if TYPE_CHECKING:
    from models.user import User
    from models.material import Material


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped[User] = relationship(back_populates="collections")
    parent: Mapped[Collection | None] = relationship(back_populates="children", remote_side=[id])
    children: Mapped[list[Collection]] = relationship(back_populates="parent", cascade="all, delete-orphan")
    materials: Mapped[list[Material]] = relationship(back_populates="collection", cascade="all, delete-orphan")