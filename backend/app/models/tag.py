from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.material import Material


class Tag(Base):
    __tablename__ = "tags"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "tag_name",
            name="uq_tags_user_id_tag_name",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    tag_name: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="tags")
    materials: Mapped[list[Material]] = relationship(
        secondary="material_tags",
        back_populates="tags",
    )