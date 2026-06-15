"""Сервис пользователей: работа с профилем, аватарами и удалением аккаунта.

Принципы:
    - Бизнес-логика и валидация бизнес-правил.
    - Файловые операции вынесены в core/file_storage.py — единая точка
      входа для всех загрузок (материалы + аватары). Это даёт:
        * единый формат путей в БД (относительный от UPLOADS_DIR);
        * единую защиту от path traversal;
        * единый механизм проверок и логирования.
    - Изменения в БД — атомарны: либо всё, либо ничего.
    - Удаление файлов с диска — best-effort после успешного коммита:
      «осиротевший» файл лучше, чем битая ссылка в БД на удалённый файл.

Безопасность аватаров:
    - MIME проверяется по РЕАЛЬНОМУ содержимому (magic bytes), а не по
      Content-Type из заголовка — клиент мог его подделать.
    - Имя файла генерируется сервером в core/file_storage.py (uuid + ext
      по белому списку) — никаких пользовательских имён.
"""

from typing import Final

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import ALLOWED_AVATAR_TYPES
from app.core.exceptions import bad_request, payload_too_large
from app.core.file_storage import delete_file, save_avatar
from app.crud.material import list_all_user_materials
from app.crud.user import update_user
from app.models.material import SourceType
from app.models.user import User
from app.schemas.user import UserUpdate

_IMAGE_MAGIC_PREFIX_BYTES: Final[int] = 16


# ─────────────────────────────────────────────────────────────────────────────
# Профиль
# ─────────────────────────────────────────────────────────────────────────────

async def update_user_profile(
    db: AsyncSession,
    user: User,
    payload: UserUpdate,
) -> User:
    """Обновляет редактируемые поля профиля.

    Сейчас это только display_name. Email и пароль меняются через
    отдельные endpoint'ы с подтверждением (на будущее).

    Если в payload нет ни одного значимого поля — no-op без коммита.
    """
    fields_to_update = payload.model_dump(exclude_unset=True)
    if not fields_to_update:
        return user

    await update_user(db, user, **fields_to_update)
    await db.commit()
    await db.refresh(user)
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Аватары — валидация
# ─────────────────────────────────────────────────────────────────────────────

def _detect_image_mime_by_magic_bytes(content: bytes) -> str | None:
    """Определяет MIME изображения по magic bytes (file signature).

    Зачем: Content-Type из заголовка приходит от клиента и может быть
    подделан. Без этой проверки атакующий мог бы загрузить SVG/HTML/JS
    с заголовком 'image/png' → файл сохранился бы как .png, но при
    отдаче через статику браузер мог бы (через MIME-sniffing) выполнить
    его → stored XSS.

    Распознаём: JPEG, PNG, GIF (87a/89a), WEBP.
    """
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _read_and_validate_avatar_file(uploaded_file: UploadFile) -> tuple[bytes, str]:
    """Читает аватар в память, валидирует размер и реальный формат.

    Returns:
        (file_content, real_mime), где real_mime определён по magic bytes,
        а НЕ по заголовку Content-Type.

    Почему читаем в память целиком:
        - аватары небольшие (≤ MAX_AVATAR_SIZE = 8 MB);
        - позволяет проверить РЕАЛЬНЫЙ размер (заголовку Content-Length
          доверять нельзя — клиент может врать);
        - magic bytes нужны до записи на диск.
    """
    file_content = await uploaded_file.read()

    if len(file_content) == 0:
        bad_request("Пустой файл")

    if len(file_content) > settings.MAX_AVATAR_SIZE:
        max_size_mb = settings.MAX_AVATAR_SIZE // (1024 * 1024)
        payload_too_large(f"Файл слишком большой. Максимум: {max_size_mb} MB")

    real_mime = _detect_image_mime_by_magic_bytes(file_content[:_IMAGE_MAGIC_PREFIX_BYTES])
    if real_mime is None or real_mime not in ALLOWED_AVATAR_TYPES:
        bad_request(
            "Файл не является поддерживаемым изображением. "
            f"Разрешены: {', '.join(sorted(ALLOWED_AVATAR_TYPES))}"
        )

    return file_content, real_mime


# ─────────────────────────────────────────────────────────────────────────────
# Аватары — публичные операции
# ─────────────────────────────────────────────────────────────────────────────

async def update_user_avatar(
    db: AsyncSession,
    user: User,
    uploaded_file: UploadFile,
) -> User:
    """Загружает аватар: запись на диск + обновление user.avatar_path.

    Хранение в БД:
        Путь относительный, формата 'avatars/{user_id}/{uuid}.png'.
        Публичный URL собирается в UserResponse через computed_field
        как '/uploads/' + avatar_path.

    Порядок операций:
        1. Валидируем + читаем в память. Если упадёт — БД и диск целы.
        2. Сохраняем новый файл через save_avatar() (генерирует имя сам).
        3. Обновляем БД и коммитим.
        4. Только ПОСЛЕ успешного коммита удаляем старый файл.

    Что если шаг N упадёт:
        - 2 (диск): БД целая, ничего восстанавливать не надо;
        - 3 (БД): откатываем — удаляем новый файл, старый avatar_path
          в БД остаётся актуальным;
        - 4 (удаление старого): «осиротевший» файл на диске,
          БД консистентна — допустимая ситуация.
    """
    file_content, _mime = await _read_and_validate_avatar_file(uploaded_file)

    new_avatar_path = await save_avatar(
        user_id=user.id,
        original_filename=uploaded_file.filename or "avatar",
        file_content=file_content,
    )
    old_avatar_path = user.avatar_path

    try:
        await update_user(db, user, avatar_path=new_avatar_path)
        await db.commit()
        await db.refresh(user)
    except Exception:
        await db.rollback()
        await delete_file(new_avatar_path)
        raise

    if old_avatar_path:
        await delete_file(old_avatar_path)

    return user


async def remove_user_avatar(db: AsyncSession, user: User) -> User:
    """Удаляет аватар: сбрасывает avatar_path и чистит файл с диска.

    Если у юзера не было аватара — no-op (идемпотентность).
    Порядок: сначала БД, потом диск.
    """
    if not user.avatar_path:
        return user

    old_avatar_path = user.avatar_path

    await update_user(db, user, avatar_path=None)
    await db.commit()
    await db.refresh(user)

    await delete_file(old_avatar_path)
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Удаление аккаунта
# ─────────────────────────────────────────────────────────────────────────────

async def delete_user_account(db: AsyncSession, user: User) -> None:
    """Полное удаление аккаунта со всеми данными.

    Что удаляется:
        - User (каскадом БД: AuthAccount, Collection, Material, Tag,
          material_tags);
        - все файлы материалов с диска;
        - файл аватара.

    Порядок:
        1. Собираем относительные пути файлов из БД (пока юзер ещё жив).
        2. Удаляем User и коммитим — каскады в БД делают своё дело.
        3. Best-effort удаление файлов с диска через delete_file()
           (он сам защищает от path traversal и игнорирует отсутствующие
           файлы).

    Почему собираем пути ДО удаления юзера:
        После db.delete(user) каскад снесёт записи материалов из БД, и мы
        потеряем ссылки на их file_path. Поэтому сначала собираем список
        путей в память, потом удаляем, потом чистим диск.

    Best-effort на диске:
        Если файл уже отсутствует или удаление не удалось — это НЕ
        проваливает операцию. Главное, что в БД юзера больше нет.
        «Осиротевший» файл на диске лучше, чем юзер, которого нельзя
        удалить из-за сбоя файловой системы.
    """
    files_to_delete: list[str] = []

    user_materials = await list_all_user_materials(db, user.id)
    for material in user_materials:
        if material.source_type == SourceType.FILE and material.file_path:
            files_to_delete.append(material.file_path)

    if user.avatar_path:
        files_to_delete.append(user.avatar_path)

    await db.delete(user)
    await db.commit()

    for relative_path in files_to_delete:
        await delete_file(relative_path)
