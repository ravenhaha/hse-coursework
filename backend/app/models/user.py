from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

if TYPE_CHECKING:
    from models.collection import Collection
    from models.tag import Tag
    from models.auth_account import AuthAccount


class User(Base):
    """
    Пользователь системы.

    Авторизация:
    - Локальная: email + hashed_password
    - OAuth (VK, Яндекс): email + связь с AuthAccount

    hashed_password = NULL для OAuth-пользователей,
    так как они входят без пароля.

    При удалении пользователя каскадно удаляются
    все его коллекции, теги и привязанные OAuth-аккаунты.
    Материалы удаляются каскадно через коллекции.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), default=None)
    display_name: Mapped[str] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(500), default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    collections: Mapped[list[Collection]] = relationship(back_populates="user", cascade="all, delete-orphan")
    tags: Mapped[list[Tag]] = relationship(back_populates="user", cascade="all, delete-orphan")
    auth_accounts: Mapped[list[AuthAccount]] = relationship(back_populates="user", cascade="all, delete-orphan")