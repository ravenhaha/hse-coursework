import os
import uuid
import aiofiles

# Базовая директория для загрузок
UPLOAD_DIR = "uploads"


async def save_file(user_id: int, filename: str, content: bytes) -> str:
    """
    Сохраняет файл на диск.
    Возвращает относительный путь к файлу.

    Структура: uploads/{user_id}/{uuid}_{original_name}
    UUID в начале — чтобы не было коллизий имён.
    """
    user_dir = os.path.join(UPLOAD_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    # UUID-префикс чтобы два файла "доклад.pdf" не перезаписали друг друга
    safe_name = f"{uuid.uuid4().hex[:8]}_{filename}"
    file_path = os.path.join(user_dir, safe_name)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    return file_path


async def delete_file(file_path: str) -> None:
    """Удаляет файл с диска, если существует."""
    if file_path and os.path.exists(file_path):
        os.remove(file_path)