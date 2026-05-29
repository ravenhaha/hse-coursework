"""Модель Tag — пользовательский тег для материалов.

Теги ограничены пользователем: тег "python" у юзера A и тег "python"
у юзера B — это РАЗНЫЕ записи (изоляция по user_id). Это упрощает
приватность и удаление: при удалении юзера каскадно удаляются все его
теги, не затрагивая других.

Уникальность имени:
  Юзер видит свои теги в оригинальном регистре ("Физика", "PYTHON"),
  но не может создать два тега с одним смыслом ("физика" и "ФИЗИКА"
  считаются дублями).

  Реализация — через функциональный UNIQUE INDEX в БД:
      CREATE UNIQUE INDEX uq_tags_user_lower_name
          ON tags (user_id, lower(tag_name));

  Этот индекс создаётся миграцией Alembic, а не моделью SQLAlchemy.
  Декларативный UniqueConstraint(user_id, tag_name) НЕ годится —
  он различает регистр.

Нормализация имени (trim) выполняется в схемах Pydantic, а не в модели.
Модель хранит то, что пришло из сервиса.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.material import Material
    from app.models.user import User


class Tag(Base):
    __tablename__ = "tags"

    # UniqueConstraint здесь НЕ объявляем намеренно — уникальность
    # обеспечивается функциональным индексом lower(tag_name) в миграции.
    # См. alembic/versions/<...>_tag_name_case_insensitive_unique.py.

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