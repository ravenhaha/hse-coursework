"""Утилиты для работы с БД, не привязанные к конкретной модели."""

from typing import Final


LIKE_ESCAPE_CHAR: Final[str] = "\\"
"""Символ экранирования для использования совместно с SQLAlchemy:
    .ilike(pattern, escape=LIKE_ESCAPE_CHAR)
Должен совпадать с символом, которым escape_like экранирует спецсимволы."""


# Таблица трансляции: каждый "опасный" для LIKE/ILIKE символ заменяется
# на свою экранированную форму.
_LIKE_ESCAPE_TABLE: Final[dict[int, str]] = str.maketrans({
    "\\": "\\\\",
    "%":  "\\%",
    "_":  "\\_",
})


def escape_like(value: str) -> str:
    """Экранирует спецсимволы LIKE/ILIKE (`%`, `_`, `\\`) для безопасного поиска.

    Без экранирования пользователь мог бы передать "100%" и заматчить
    любую строку, а "_test" — любую строку из 5+ символов.

    Использование (поиск по подстроке):
        from sqlalchemy import select
        pattern = f"%{escape_like(user_query)}%"
        stmt = select(Material).where(
            Material.title.ilike(pattern, escape=LIKE_ESCAPE_CHAR)
        )

    Реализовано через str.translate (один проход), что гарантирует:
        • производительность не зависит от числа спецсимволов;
        • нет риска «двойного экранирования» при изменении порядка операций.
    """
    return value.translate(_LIKE_ESCAPE_TABLE)
