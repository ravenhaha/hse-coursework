"""Схемы для аутентификации: выдача и обновление JWT-токенов.

Эти схемы описывают ТЕЛО запросов/ответов на /auth/*.
Сами токены кладутся в httpOnly-cookies — фронту они не возвращаются
в JSON (защита от XSS). Поэтому TokenResponse в коде НЕ используется,
оставлен на будущее для мобильного клиента или CLI.
"""

from pydantic import BaseModel, ConfigDict, Field


class TokenResponse(BaseModel):
    """Ответ с парой токенов (для не-cookie клиентов).

    В текущем веб-приложении НЕ используется: токены ходят в cookies.
    Зарезервировано для мобильного / CLI клиента.
    """

    access_token: str = Field(..., description="Короткоживущий JWT (~24ч)")
    refresh_token: str = Field(..., description="Долгоживущий JWT (~30 дней)")
    token_type: str = "bearer"

    model_config = ConfigDict(extra="forbid")


class RefreshRequest(BaseModel):
    """Тело запроса POST /auth/refresh.

    Сейчас refresh_token читается из cookie (см. dependencies.RefreshToken),
    эта схема — на случай, если решим принимать его в JSON-теле.
    """

    refresh_token: str

    model_config = ConfigDict(extra="forbid")