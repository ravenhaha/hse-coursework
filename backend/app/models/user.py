"""Модель пользователя.

Пользователь — это «личность» в системе. Способы входа (email, VK, Yandex)
вынесены в отдельную таблицу `auth_accounts` — так один юзер может иметь
несколько способов входа, и архитектура чистая.

Пароль здесь НЕ хранится — он лежит в auth_accounts.password_hash
только для строк с provider_auth='email'.

Инварианты:
    1. Email хранится в lowercase.
       - Нормализация: Pydantic-схемы (UserRegister/UserLogin) приводят
         к lowercase на входе в систему.
       - Гарантия: CHECK constraint `email = LOWER(email)` на уровне БД
         не даст вставить нарушающую строку даже в обход ORM
         (миграции, seed-скрипты, ручной SQL).
       Это defense in depth: правило подкреплено на двух уровнях.

    2. У каждого активного пользователя должен быть хотя бы один
       auth_account. Проверяется в сервисном слое при отвязке провайдера.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.auth_account import AuthAccount
    from app.models.collection import Collection
    from app.models.tag import Tag


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "email = LOWER(email)",
            name="email_lowercase",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    display_name: Mapped[str | None] = mapped_column(String(100), default=None)
    avatar_path: Mapped[str | None] = mapped_column(String(500), default=None)

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
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
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