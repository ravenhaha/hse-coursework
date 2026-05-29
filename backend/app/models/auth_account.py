"""Модель способа аутентификации.

Один пользователь (`User`) может иметь несколько `AuthAccount` — по одной
строке на каждый способ входа: email+password, VK OAuth, Yandex OAuth и т.д.

Такая модель решает несколько задач:
    - Юзер может привязать несколько способов входа к одному аккаунту.
    - При отвязке провайдера сам юзер не удаляется.
    - Добавление нового провайдера = одна новая строка, без изменения
      схемы таблицы users.

Про AuthProvider:
    StrEnum, поэтому AuthProvider.EMAIL == "email" → True. В колонке БД
    хранится как обычная строка (String(50)), это даёт совместимость:
        - можно сравнивать с enum-членом: provider_auth == AuthProvider.VK;
        - можно сравнивать со строкой: provider_auth == 'vk';
        - схема БД остаётся неизменной даже при добавлении новых провайдеров
          (в отличие от PG ENUM type, который требует ALTER TYPE).

Инварианты:
    1. (provider_auth, provider_user_id) — уникальная пара. Один и тот же
       VK-аккаунт не может быть привязан к двум юзерам.
       Гарантия: UNIQUE constraint в БД.

    2. password_hash IS NOT NULL ⇔ provider_auth = 'email'.
       Для OAuth-провайдеров (VK, Yandex) пароля нет — там доверие
       внешнему провайдеру.
       Гарантия: сервисный слой (AuthService) — не CHECK, потому что
       правило может эволюционировать (magic-link, passwordless).

    3. last_login_at обновляется только при успешном входе через данный
       провайдер. Обновление выполняется в AuthService.login(), а не через
       onupdate — иначе метка обновлялась бы при любом изменении строки
       (например, при смене пароля).
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
    """Поддерживаемые способы аутентификации.

    Значения совпадают с тем, что хранится в колонке provider_auth.
    Добавление нового провайдера — одна строка тут, без миграции БД
    (колонка остаётся String(50)).
    """

    EMAIL = "email"
    VK = "vk"
    YANDEX = "yandex"


class AuthAccount(Base):
    __tablename__ = "auth_accounts"

    __table_args__ = (
        UniqueConstraint(
            "provider_auth",
            "provider_user_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    provider_auth: Mapped[str] = mapped_column(String(50), nullable=False)

    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)

    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
    )

    user: Mapped[User] = relationship(back_populates="auth_accounts")