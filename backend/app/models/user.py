"""Модель пользователя.

Пользователь — это «личность» в системе. Способы входа (email, VK, Yandex)
вынесены в отдельную таблицу `auth_accounts` — так один юзер может иметь
несколько способов входа, и архитектура чистая.

Пароль здесь НЕ хранится — он лежит в auth_accounts.password_hash
только для строк с provider_auth='email'.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.auth_account import AuthAccount
    from app.models.collection import Collection
    from app.models.tag import Tag


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Email — основное удостоверение личности.
    # Уникальный + индекс: логин по email будет дёргать этот индекс.
    # Нормализация (lowercase + strip) делается на уровне сервиса.
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    # Отображаемое имя. Nullable, потому что:
    #  - при OAuth провайдер мог не вернуть имя;
    #  - на UI можно показать fallback (часть email до @).
    display_name: Mapped[str | None] = mapped_column(String(100), default=None)

    # Относительный путь к аватару, например "/uploads/avatars/123_abc.jpg".
    # NULL = фронт показывает placeholder.
    avatar_path: Mapped[str | None] = mapped_column(String(500), default=None)

    # Soft-disable: блокируем без DELETE, чтобы сохранить связи.
    # server_default нужен для миграции существующих строк.
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Связи ──
    # При удалении юзера каскадом сносим всё его. passive_deletes=True →
    # ORM не загружает строки в Python, а доверяет CASCADE в БД (быстрее).
    auth_accounts: Mapped[list[AuthAccount]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    collections: Mapped[list[Collection]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    tags: Mapped[list[Tag]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )