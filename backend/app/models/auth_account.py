from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base

if TYPE_CHECKING:
    from models.user import User


class AuthAccount(Base):
    """
    Внешний OAuth-аккаунт, привязанный к пользователю.

    Один пользователь может иметь несколько провайдеров (VK + Яндекс).
    UNIQUE(provider_auth, provider_user_id) — один аккаунт провайдера
    не может быть привязан к двум пользователям.
    """
    __tablename__ = "auth_accounts"

    __table_args__ = (
        UniqueConstraint(
            "provider_auth",
            "provider_user_id",
            name="uq_auth_provider_user_id"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider_auth: Mapped[str] = mapped_column(String(50))
    provider_user_id: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped[User] = relationship(back_populates="auth_accounts")