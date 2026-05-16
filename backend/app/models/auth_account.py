"""Модель способа аутентификации.

Один пользователь может иметь несколько строк здесь:
  - provider_auth="email",  provider_user_id=<email>,  password_hash=<argon2>
  - provider_auth="vk",     provider_user_id=<vk_id>,  password_hash=NULL
  - provider_auth="yandex", provider_user_id=<ya_id>,  password_hash=NULL

Уникальность пары (provider_auth, provider_user_id) гарантирует, что один и тот же
внешний аккаунт не может быть привязан к двум разным юзерам у нас.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AuthProvider(StrEnum):
    """Перечисление поддерживаемых провайдеров.

    Используется в коде как enum, но в БД хранится как обычная строка —
    чтобы добавлять новых провайдеров без миграций SQL ENUM.
    """
    EMAIL = "email"
    VK = "vk"
    YANDEX = "yandex"


class AuthAccount(Base):
    __tablename__ = "auth_accounts"

    __table_args__ = (
        # Глобальная уникальность связки "провайдер + id у провайдера".
        # Имя совпадает с тем, что было в твоей текущей модели — миграция не нужна.
        UniqueConstraint(
            "provider_auth",
            "provider_user_id",
            name="uq_auth_accounts_provider_auth_provider_user_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    # ondelete="CASCADE" → при удалении юзера БД сама сносит все его auth-привязки.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # "email" / "vk" / "yandex" — значения AuthProvider.
    provider_auth: Mapped[str] = mapped_column(String(50), nullable=False)

    # Для email — сам email; для OAuth — id юзера у провайдера.
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Хэш Argon2id. NULL для OAuth-провайдеров (там пароля нет).
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="auth_accounts")