"""Глобальные константы и sentinel-значения приложения.

Принципы:
    - Здесь только то, что НЕ зависит от окружения (.env).
    - Конфиг (пути, размеры файлов) — в core/config.py.
    - Группировка по доменам: PATCH-sentinel / аватары / материалы.
"""

from typing import Final


# ══════════════════════════════════════════
# Sentinel для PATCH-операций
# ══════════════════════════════════════════
# Отличает "поле не передано" от "поле передано как None".
# Пример: PATCH юзера может явно обнулить parent_id (None) или вообще не трогать его.
UNSET: Final = object()


# ══════════════════════════════════════════
# Аватары
# ══════════════════════════════════════════

ALLOWED_AVATAR_TYPES: Final[set[str]] = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
"""MIME-типы, разрешённые для аватара. Проверяются в роуте загрузки."""

EXT_BY_MIME: Final[dict[str, str]] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
"""Соответствие MIME → расширение для сохранения файла на диск."""


# ══════════════════════════════════════════
# Материалы — расширения файлов
# ══════════════════════════════════════════
# Сгруппированы по категориям: фронт будет рендерить превью по-разному
# (PDF.js / HTML-таблица / <img> / TipTap-редактор).

MATERIAL_TEXT_EXT: Final[frozenset[str]] = frozenset({
    ".txt", ".md",
})
"""Простой текст — редактируется в TipTap, превью = HTML."""

MATERIAL_DOC_EXT: Final[frozenset[str]] = frozenset({
    ".pdf", ".docx", ".rtf",
})
"""Документы — превью (PDF через PDF.js, DOCX/RTF через парсер) + скачивание."""

MATERIAL_TABLE_EXT: Final[frozenset[str]] = frozenset({
    ".xlsx", ".csv",
})
"""Таблицы — превью первого листа как HTML-таблица + скачивание."""

MATERIAL_IMAGE_EXT: Final[frozenset[str]] = frozenset({
    ".jpg", ".jpeg", ".png",
})
"""Картинки — превью <img> + скачивание (зум на фронте)."""

# Объединение всех разрешённых расширений для материалов.
# Используется в роутах для валидации загружаемых файлов.
ALLOWED_MATERIAL_EXTENSIONS: Final[frozenset[str]] = (
    MATERIAL_TEXT_EXT
    | MATERIAL_DOC_EXT
    | MATERIAL_TABLE_EXT
    | MATERIAL_IMAGE_EXT
)


# ══════════════════════════════════════════
# Excel-превью — лимиты на парсинг
# ══════════════════════════════════════════
# Если таблица больше — превью обрезается, юзер видит плашку
# "Файл слишком большой для превью, скачайте оригинал".

EXCEL_PREVIEW_MAX_ROWS: Final[int] = 1000
EXCEL_PREVIEW_MAX_COLS: Final[int] = 50


# ══════════════════════════════════════════
# Источники материала
# ══════════════════════════════════════════

SOURCE_TYPE_TEXT: Final[str] = "text"
SOURCE_TYPE_FILE: Final[str] = "file"
ALLOWED_SOURCE_TYPES: Final[set[str]] = {SOURCE_TYPE_TEXT, SOURCE_TYPE_FILE}