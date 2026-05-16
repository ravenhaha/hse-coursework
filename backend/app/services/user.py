"""Сервис пользователей: работа с профилем, аватарами и удалением аккаунта.

Принципы:
    - Бизнес-логика и валидация бизнес-правил.
    - Файловые операции (запись/удаление аватара/материалов) — атомарно с БД-операциями.
    - Все изменения в одной транзакции: либо всё, либо ничего.
    - Удаление файлов с диска — best-effort (после успешного коммита).
"""

import secrets
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import ALLOWED_AVATAR_TYPES, EXT_BY_MIME
from app.core.exceptions import bad_request, payload_too_large
from app.crud.material import list_all_user_materials
from app.crud.user import update_user
from app.models.user import User
from app.schemas.user import UserUpdate


# ══════════════════════════════════════════════════════════
# Профиль
# ══════════════════════════════════════════════════════════

async def update_user_profile(
    db: AsyncSession,
    user: User,
    payload: UserUpdate,
) -> User:
    """Обновляет редактируемые поля профиля.

    Сейчас это только display_name. Email и пароль меняются через
    отдельные endpoint'ы с подтверждением (на будущее).
    """
    # exclude_unset=True → в kwargs попадут только реально переданные поля.
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        # Ничего не передали — не делаем лишний SQL.
        return user

    await update_user(db, user, **update_data)
    await db.commit()
    await db.refresh(user)
    return user


# ══════════════════════════════════════════════════════════
# Аватары — вспомогательные функции
# ══════════════════════════════════════════════════════════

def _build_avatar_filename(user_id: int, mime: str) -> str:
    """Генерирует уникальное имя файла для аватара.

    Формат: <user_id>_<random>.<ext>
        - user_id для быстрой связки на диске;
        - secrets.token_hex(8) — 16 hex-символов случайности
          (защита от коллизий и от прямого угадывания URL);
        - расширение по MIME (а не по имени из браузера — оно ненадёжно).
    """
    ext = EXT_BY_MIME[mime]
    random_part = secrets.token_hex(8)
    return f"{user_id}_{random_part}.{ext}"


def _safe_unlink(path: Path) -> None:
    """Удаляет файл, игнорируя ошибки "файл не найден" и проблемы доступа.

    Используется для best-effort очистки диска: если файл не удалится,
    БД всё равно остаётся консистентной (это допустимый "мусор").
    """
    try:
        path.unlink(missing_ok=True)
    except OSError:
        # Например, нет прав на удаление — не критично, не блокируем апдейт.
        # В проде имеет смысл логировать.
        pass


def _public_path_to_disk_path(public_path: str, base_dir: Path) -> Path:
    """Превращает публичный путь вида '/uploads/avatars/x.png' в путь на диске.

    Берём только basename, чтобы исключить любые попытки выхода
    за пределы base_dir (защита от path traversal, если в БД что-то странное).
    """
    return base_dir / Path(public_path).name


async def _read_and_validate_avatar(file: UploadFile) -> tuple[bytes, str]:
    """Читает файл в память, проверяет MIME и размер.

    Возвращает (содержимое, mime).

    Почему читаем в память:
        - аватар <= 8MB, не страшно;
        - позволяет проверить РЕАЛЬНЫЙ размер (не верим заголовку Content-Length);
        - запись на диск делается одной операцией → меньше шанс «битого файла»
          из-за обрыва соединения.
    """
    # Content-Type приходит от клиента → не доверяем безоговорочно,
    # но как первичная отсечка — норм.
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        bad_request(
            f"Недопустимый формат изображения. "
            f"Разрешены: {', '.join(sorted(ALLOWED_AVATAR_TYPES))}"
        )

    content = await file.read()

    if len(content) == 0:
        bad_request("Пустой файл")

    if len(content) > settings.MAX_AVATAR_SIZE:
        max_mb = settings.MAX_AVATAR_SIZE // (1024 * 1024)
        payload_too_large(f"Файл слишком большой. Максимум: {max_mb} MB")

    return content, file.content_type


# ══════════════════════════════════════════════════════════
# Аватары — публичные операции
# ══════════════════════════════════════════════════════════

async def update_user_avatar(
    db: AsyncSession,
    user: User,
    file: UploadFile,
) -> User:
    """Загружает аватар: запись на диск + обновление user.avatar_path.

    Порядок операций важен:
        1. Валидируем + читаем в память (если упадёт — БД не тронута).
        2. Пишем новый файл на диск.
        3. Обновляем БД и коммитим.
        4. Только ПОСЛЕ успешного коммита удаляем старый файл.

    Если шаг 3 упадёт — у нас будет один «осиротевший» файл на диске,
    но БД целая. Это лучше, чем сломанная ссылка в БД на удалённый файл.
    """
    content, mime = await _read_and_validate_avatar(file)

    # ── 1. Готовим новый файл ──
    filename = _build_avatar_filename(user.id, mime)
    new_path_on_disk = settings.AVATARS_DIR / filename
    new_path_public = f"/uploads/avatars/{filename}"  # это пойдёт в avatar_path

    # Запоминаем старый, чтобы удалить ПОСЛЕ коммита.
    old_path_public = user.avatar_path

    # ── 2. Пишем файл на диск ──
    new_path_on_disk.write_bytes(content)

    # ── 3. Обновляем БД ──
    try:
        await update_user(db, user, avatar_path=new_path_public)
        await db.commit()
        await db.refresh(user)
    except Exception:
        # Если коммит упал — откатываем файл (был только что записан).
        _safe_unlink(new_path_on_disk)
        raise

    # ── 4. Чистим старый файл (best-effort) ──
    if old_path_public:
        _safe_unlink(_public_path_to_disk_path(old_path_public, settings.AVATARS_DIR))

    return user


async def remove_user_avatar(db: AsyncSession, user: User) -> User:
    """Удаляет аватар: сбрасывает avatar_path и чистит файл с диска.

    Если у юзера не было аватара — ничего не делаем, не ошибка.
    """
    if not user.avatar_path:
        return user

    old_path_public = user.avatar_path

    # Сначала БД (источник истины), потом файл.
    await update_user(db, user, avatar_path=None)
    await db.commit()
    await db.refresh(user)

    # Чистим файл best-effort.
    _safe_unlink(_public_path_to_disk_path(old_path_public, settings.AVATARS_DIR))

    return user


# ══════════════════════════════════════════════════════════
# Удаление аккаунта
# ══════════════════════════════════════════════════════════

async def delete_user_account(db: AsyncSession, user: User) -> None:
    """Полное удаление аккаунта со всеми данными.

    Что удаляется:
        - User (каскадом: AuthAccount, Collection, Material, Tag, material_tags);
        - все файлы материалов с диска;
        - файл аватара.

    Порядок:
        1. Собираем пути файлов (БД ещё цела).
        2. Удаляем User из БД и коммитим (каскады делают своё дело).
        3. Best-effort удаление файлов с диска.

    Если шаг 3 частично упадёт — на диске останется "мусор",
    но БД консистентна. Это допустимо.
    """
    # ── 1. Собираем все пути файлов ДО удаления из БД ──
    files_to_delete: list[Path] = []

    # 1а. Файлы материалов.
    materials = await list_all_user_materials(db, user.id)
    for material in materials:
        if material.source_type == "file" and material.file_path:
            files_to_delete.append(
                _public_path_to_disk_path(material.file_path, settings.MATERIALS_DIR)
            )

    # 1б. Аватар.
    if user.avatar_path:
        files_to_delete.append(
            _public_path_to_disk_path(user.avatar_path, settings.AVATARS_DIR)
        )

    # ── 2. Удаляем User → каскад сносит всё связанное ──
    await db.delete(user)
    await db.commit()

    # ── 3. Чистим диск (best-effort, в любом порядке) ──
    for path in files_to_delete:
        _safe_unlink(path)