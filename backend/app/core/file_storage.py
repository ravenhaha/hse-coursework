"""Хранилище загружаемых файлов на локальной ФС.

Структура на диске:
    {UPLOADS_DIR}/materials/{user_id}/{uuid}{ext}
    {UPLOADS_DIR}/avatars/{user_id}/{uuid}{ext}

В БД сохраняется ОТНОСИТЕЛЬНЫЙ путь от UPLOADS_DIR — это удобно:
    - можно перенести uploads/ в другое место без миграции БД
    - легко строить публичные URL: f"/uploads/{relative_path}"

Оригинальное имя файла НЕ используется в пути на диске:
    - защита от path traversal ("../../../etc/passwd")
    - защита от опасных расширений (.exe, .sh)
    - защита от коллизий имён
Имя для скачивания юзеру формируется в роуте из Material.material_name
плюс расширение из file_path.
"""

import logging
import uuid
from pathlib import Path

import aiofiles
import aiofiles.os

from app.core.config import settings
from app.core.constants import ALLOWED_MATERIAL_EXTENSIONS

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════
# Белые списки расширений
# ══════════════════════════════════════════
# Для материалов — берём из constants.py (единый источник истины).
_MATERIAL_SAFE_EXT: frozenset[str] = frozenset(ALLOWED_MATERIAL_EXTENSIONS)

# Для аватаров — только картинки. Локальная константа,
# т.к. для аватаров основная валидация по MIME-типу (в роуте).
_AVATAR_SAFE_EXT: frozenset[str] = frozenset({
    ".png", ".jpg", ".jpeg", ".webp",
})


def _safe_extension(filename: str, allowed: frozenset[str]) -> str:
    """Возвращает безопасное расширение в нижнем регистре.

    Если расширения нет или оно не в белом списке — возвращает '.bin'.
    Для аватаров вызывающий код обычно сначала валидирует MIME-тип,
    так что до .bin дело не дойдёт.
    """
    ext = Path(filename).suffix.lower()
    return ext if ext in allowed else ".bin"


def _resolve_full_path(relative_path: str | Path) -> Path | None:
    """Преобразует относительный путь в абсолютный с проверкой границ.

    Защита от path traversal: если итоговый путь выходит за пределы
    UPLOADS_DIR (через '..' и т.п.), возвращает None.
    """
    try:
        full = (settings.UPLOADS_DIR / Path(relative_path)).resolve()
        uploads_root = settings.UPLOADS_DIR.resolve()
        full.relative_to(uploads_root)
        return full
    except (ValueError, OSError):
        logger.warning("Path traversal attempt blocked: %s", relative_path)
        return None


async def _save_bytes(
    target_dir: Path,
    filename: str,
    content: bytes,
    allowed_ext: frozenset[str],
) -> tuple[Path, int]:
    """Внутренний хелпер: пишет байты в target_dir под uuid-именем.

    Returns:
        (относительный_путь, размер_в_байтах).
    """
    await aiofiles.os.makedirs(target_dir, exist_ok=True)

    new_name = f"{uuid.uuid4().hex}{_safe_extension(filename, allowed_ext)}"
    file_path = target_dir / new_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    return file_path.relative_to(settings.UPLOADS_DIR), len(content)


# ══════════════════════════════════════════
# Публичный API: материалы
# ══════════════════════════════════════════

async def save_material(
    user_id: int,
    filename: str,
    content: bytes,
) -> tuple[Path, int]:
    """Сохраняет файл материала.

    Returns:
        (относительный_путь, размер_в_байтах).
        Путь вида `materials/42/a3f5...c1.pdf`.
    """
    user_dir = settings.MATERIALS_DIR / str(user_id)
    relative, size = await _save_bytes(user_dir, filename, content, _MATERIAL_SAFE_EXT)
    logger.info("Saved material user_id=%s path=%s size=%d",
                user_id, relative, size)
    return relative, size


# ══════════════════════════════════════════
# Публичный API: аватары
# ══════════════════════════════════════════

async def save_avatar(
    user_id: int,
    filename: str,
    content: bytes,
) -> Path:
    """Сохраняет аватар пользователя и возвращает путь относительно UPLOADS_DIR.

    Returns:
        Относительный путь вида `avatars/42/a3f5...c1.png`.

    Note:
        Размер и MIME-тип валидируются на уровне роута/сервиса
        (settings.MAX_AVATAR_SIZE). Размер файла наружу не возвращаем —
        для аватаров он не нужен в БД.
    """
    user_dir = settings.AVATARS_DIR / str(user_id)
    relative, _ = await _save_bytes(user_dir, filename, content, _AVATAR_SAFE_EXT)
    logger.info("Saved avatar user_id=%s path=%s", user_id, relative)
    return relative


# ══════════════════════════════════════════
# Общие операции
# ══════════════════════════════════════════

async def delete_file(relative_path: str | Path | None) -> bool:
    """Удаляет файл с диска по относительному пути.

    Returns:
        True  — файл успешно удалён.
        False — пути нет, файл не существует или удаление заблокировано.
    """
    if not relative_path:
        return False

    full_path = _resolve_full_path(relative_path)
    if full_path is None:
        return False

    try:
        if not await aiofiles.os.path.exists(full_path):
            return False
        await aiofiles.os.remove(full_path)
        logger.info("Deleted file: %s", relative_path)
        return True
    except OSError:
        logger.exception("Failed to delete file: %s", relative_path)
        return False


async def file_exists(relative_path: str | Path | None) -> bool:
    """Проверяет существование файла по относительному пути."""
    if not relative_path:
        return False
    full_path = _resolve_full_path(relative_path)
    if full_path is None:
        return False
    return await aiofiles.os.path.exists(full_path)


def get_full_path(relative_path: str | Path) -> Path | None:
    """Возвращает абсолютный путь для отдачи через FileResponse.

    Используется в эндпоинтах скачивания материалов:
        full = get_full_path(material.file_path)
        if full is None:
            material_not_found()
        return FileResponse(full, filename=<имя_для_юзера>)
    """
    return _resolve_full_path(relative_path)