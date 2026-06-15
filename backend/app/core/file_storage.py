"""Хранилище загружаемых файлов на локальной файловой системе.

═══════════════════════════════════════════════════════════════════════
КАК ХРАНИМ СЕЙЧАС (локальный диск)
═══════════════════════════════════════════════════════════════════════

Структура на диске:
    {UPLOADS_DIR}/materials/{user_id}/{uuid}{ext}
    {UPLOADS_DIR}/avatars/{user_id}/{uuid}{ext}

В БД сохраняется ОТНОСИТЕЛЬНЫЙ путь от UPLOADS_DIR, например:
    materials/42/a3f5...c1.pdf
    avatars/42/b7e2...d9.png

Публичный URL для фронта собирается простой склейкой:
    /uploads/ + relative_path  →  /uploads/avatars/42/b7e2...d9.png

Раздачей файлов занимается StaticFiles, примонтированный в main.py
на путь /uploads.

═══════════════════════════════════════════════════════════════════════
ПОЧЕМУ ИМЕННО ТАК
═══════════════════════════════════════════════════════════════════════

1. Имя файла на диске генерируется сервером (uuid + расширение из
   белого списка) — НИКОГДА не используется имя от пользователя.
   Это защищает от:
     - path traversal: "../../etc/passwd";
     - опасных расширений: ".exe", ".sh";
     - коллизий имён: два юзера загружают "лекция.pdf";
     - юникодных трюков с RTL-символами в имени файла.

2. Путь в БД хранится относительный (а не абсолютный):
     - можно перенести папку uploads/ — миграция БД не нужна;
     - можно сменить хостинг — БД остаётся валидной;
     - один и тот же путь работает и на Windows-разработчике,
       и на Linux-проде (мы форсим POSIX-слеши через .as_posix()).

3. Файлы юзеров разложены по подпапкам {user_id}/ — чтобы:
     - удобно было дампить/удалять данные одного юзера;
     - в одной папке не копились миллионы файлов (FS-tax на listdir);
     - проще было считать квоту на юзера в будущем.

═══════════════════════════════════════════════════════════════════════
ЧТО БУДЕТ ПОТОМ (миграция на S3-совместимое хранилище)
═══════════════════════════════════════════════════════════════════════

Локальный диск ок для MVP и одного бэкенд-инстанса, но для прода
понадобится объектное хранилище (S3 / Yandex Object Storage / MinIO),
потому что:
    - локальный диск не шарится между несколькими инстансами бэкенда;
    - резервное копирование и масштабирование объёма проще в S3;
    - можно отдавать файлы напрямую с CDN, минуя бэкенд.

Архитектурно мы к этому ГОТОВЫ: весь код приложения работает с
относительным путём как с непрозрачным идентификатором. Чтобы
переехать, потребуется поменять ТОЛЬКО этот модуль:

    save_material/save_avatar  → upload в бакет, вернуть object_key
    delete_file                → delete_object в бакете
    get_full_path              → выпуск presigned URL (или редирект)

Плюс убрать StaticFiles из main.py и поменять схему UserResponse
(avatar_url будет либо публичным URL CDN, либо presigned URL S3).

Прикладной код (сервисы, роуты, схемы) менять НЕ придётся — он
дёргает только публичные функции этого модуля.

═══════════════════════════════════════════════════════════════════════
ВАЖНО: оригинальное имя файла НЕ участвует в пути на диске
═══════════════════════════════════════════════════════════════════════

Для скачивания материалов юзеру (когда фронт жмёт «Скачать») имя файла
формируется в роуте материала: берётся material.material_name +
расширение из file_path. Никакого user-controlled input в путях ФС нет.
"""

import logging
import uuid
from pathlib import Path

import aiofiles
import aiofiles.os

from app.core.config import settings
from app.core.constants import ALLOWED_MATERIAL_EXTENSIONS

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Белые списки расширений
# ─────────────────────────────────────────────────────────────────────────────

_MATERIAL_SAFE_EXTENSIONS: frozenset[str] = frozenset(ALLOWED_MATERIAL_EXTENSIONS)

_AVATAR_SAFE_EXTENSIONS: frozenset[str] = frozenset({
    ".png", ".jpg", ".jpeg",
})


# ─────────────────────────────────────────────────────────────────────────────
# Внутренние утилиты
# ─────────────────────────────────────────────────────────────────────────────

def _get_safe_extension(filename: str, allowed_extensions: frozenset[str]) -> str:
    """Возвращает безопасное расширение файла в нижнем регистре.

    Если расширения нет или оно не в белом списке — возвращает '.bin'.
    Для аватаров вызывающий код перед этим ВСЕГДА валидирует MIME-тип
    по magic bytes, так что до '.bin' дело не дойдёт.
    """
    extension = Path(filename).suffix.lower()
    return extension if extension in allowed_extensions else ".bin"


def _resolve_and_check_path(relative_path: str | Path) -> Path | None:
    """Преобразует относительный путь в абсолютный с проверкой границ.

    Защита от path traversal: если итоговый путь после resolve() выходит
    за пределы UPLOADS_DIR (например, в пути были '..'), возвращаем None.

    Используется при удалении и при отдаче файлов через FileResponse —
    везде, где принимаем путь и трогаем им файловую систему.
    """
    try:
        full_path = (settings.UPLOADS_DIR / Path(relative_path)).resolve()
        uploads_root = settings.UPLOADS_DIR.resolve()
        full_path.relative_to(uploads_root)
        return full_path
    except (ValueError, OSError):
        logger.warning("Попытка path traversal заблокирована: %s", relative_path)
        return None


async def _write_file_to_disk(
    target_directory: Path,
    original_filename: str,
    file_content: bytes,
    allowed_extensions: frozenset[str],
) -> tuple[str, int]:
    """Записывает байты в target_directory под безопасным uuid-именем.

    Returns:
        (relative_path_posix, file_size_bytes)

        relative_path_posix — путь относительно UPLOADS_DIR, всегда со
        слешами '/' (даже на Windows). Именно эта строка идёт в БД и
        склеивается в публичный URL.

    Почему форсим POSIX-разделители:
        На Windows Path.relative_to() даёт строку с '\\', что:
          - ломает URL (браузер не поймёт '/uploads/avatars\\1\\xxx.png');
          - не унифицируется с продом на Linux;
          - усложняет миграцию данных между ОС.
        Через .as_posix() в БД ВСЕГДА лежит 'avatars/42/xxx.png',
        независимо от ОС, на которой работал бэкенд.
    """
    await aiofiles.os.makedirs(target_directory, exist_ok=True)

    safe_filename = f"{uuid.uuid4().hex}{_get_safe_extension(original_filename, allowed_extensions)}"
    absolute_path = target_directory / safe_filename

    async with aiofiles.open(absolute_path, "wb") as f:
        await f.write(file_content)

    relative_path = absolute_path.relative_to(settings.UPLOADS_DIR).as_posix()
    return relative_path, len(file_content)


# ─────────────────────────────────────────────────────────────────────────────
# Публичный API: сохранение материалов
# ─────────────────────────────────────────────────────────────────────────────

async def save_material(
    user_id: int,
    original_filename: str,
    file_content: bytes,
) -> tuple[str, int]:
    """Сохраняет файл материала пользователя.

    Returns:
        (relative_path, file_size_bytes)
        Путь вида 'materials/42/a3f5...c1.pdf' — всегда со слешами '/'.
    """
    user_materials_directory = settings.MATERIALS_DIR / str(user_id)
    relative_path, file_size = await _write_file_to_disk(
        user_materials_directory,
        original_filename,
        file_content,
        _MATERIAL_SAFE_EXTENSIONS,
    )
    logger.info(
        "Сохранён материал user_id=%s path=%s size=%d",
        user_id, relative_path, file_size,
    )
    return relative_path, file_size


# ─────────────────────────────────────────────────────────────────────────────
# Публичный API: сохранение аватаров
# ─────────────────────────────────────────────────────────────────────────────

async def save_avatar(
    user_id: int,
    original_filename: str,
    file_content: bytes,
) -> str:
    """Сохраняет аватар пользователя.

    Returns:
        Относительный путь POSIX вида 'avatars/42/a3f5...c1.png'.
        Эта строка идёт в users.avatar_path как есть.
    """
    user_avatar_directory = settings.AVATARS_DIR / str(user_id)
    relative_path, _ = await _write_file_to_disk(
        user_avatar_directory,
        original_filename,
        file_content,
        _AVATAR_SAFE_EXTENSIONS,
    )
    logger.info("Сохранён аватар user_id=%s path=%s", user_id, relative_path)
    return relative_path


# ─────────────────────────────────────────────────────────────────────────────
# Публичный API: общие операции
# ─────────────────────────────────────────────────────────────────────────────

async def delete_file(relative_path: str | Path | None) -> bool:
    """Удаляет файл с диска по относительному пути.

    Returns:
        True  — файл успешно удалён.
        False — путь пустой, файл не существует или удаление заблокировано
                (защита от path traversal).

    Best-effort семантика: если файл уже удалён или не существует — это
    НЕ ошибка. Используется при удалении сущностей из БД, где главное
    чтобы файл не остался «жить» дольше своей записи в БД.
    """
    if not relative_path:
        return False

    full_path = _resolve_and_check_path(relative_path)
    if full_path is None:
        return False

    try:
        if not await aiofiles.os.path.exists(full_path):
            return False
        await aiofiles.os.remove(full_path)
        logger.info("Удалён файл: %s", relative_path)
        return True
    except OSError:
        logger.exception("Не удалось удалить файл: %s", relative_path)
        return False


async def file_exists(relative_path: str | Path | None) -> bool:
    """Проверяет существование файла по относительному пути."""
    if not relative_path:
        return False
    full_path = _resolve_and_check_path(relative_path)
    if full_path is None:
        return False
    return await aiofiles.os.path.exists(full_path)


def get_full_path(relative_path: str | Path) -> Path | None:
    """Возвращает абсолютный путь для отдачи файла через FileResponse.

    Используется в эндпоинтах скачивания материалов:
        full_path = get_full_path(material.file_path)
        if full_path is None:
            material_not_found()
        return FileResponse(full_path, filename=<имя_для_юзера>)

    Возвращает None при path traversal — это эквивалентно «файл не найден».
    """
    return _resolve_and_check_path(relative_path)
