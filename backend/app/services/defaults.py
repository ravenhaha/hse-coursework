"""
Дефолтные данные для новых пользователей.

При регистрации (локальной или через OAuth) каждому юзеру
автоматически создаются эти теги в БД, чтобы он сразу мог
ими пользоваться без необходимости создавать вручную.

Юзер может их свободно удалять, переименовывать или
добавлять свои — это обычные теги в таблице `tags`.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.tag import create_tag, get_tags_by_user

DEFAULT_TAG_NAMES: tuple[str, ...] = (
    "лекция",
    "семинар",
    "домашка",
    "экзамен",
    "конспект",
    "формула",
    "важно",
    "повторить",
)


async def create_default_tags_for_user(
    db: AsyncSession,
    user_id: int,
) -> None:
    """
    Создаёт дефолтные теги для пользователя.

    Идемпотентна: безопасно вызывать повторно — уже существующие
    теги пропускаются без ошибок UNIQUE.

    ВАЖНО: НЕ делает commit — это ответственность вызывающего кода.
    Регистрация юзера и создание тегов должны быть в ОДНОЙ транзакции,
    чтобы при сбое откатилось всё разом.
    """
    
    existing_tags = await get_tags_by_user(db, user_id)
    existing_names = {t.tag_name for t in existing_tags}

    for tag_name in dict.fromkeys(DEFAULT_TAG_NAMES):
        if tag_name in existing_names:
            continue
        await create_tag(db, user_id, tag_name)