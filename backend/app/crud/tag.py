"""
CRUD-слой для тегов и связки material_tags.

Здесь ТОЛЬКО работа с БД: SELECT/INSERT/UPDATE/DELETE.
Никаких бизнес-правил, проверок владельца, raise HTTPException —
всё это живёт в services/tag.py.

Commit здесь не делается — это ответственность вызывающего сервиса
(чтобы можно было собирать несколько CRUD-операций в одну транзакцию).

Регистронезависимость:
    Уникальность tag_name внутри юзера обеспечивается функциональным
    UNIQUE-индексом uq_tags_user_lower_name (user_id, lower(tag_name)).
    Поэтому поиск тега по имени тоже идёт через lower() — он попадает
    в этот же индекс и работает за O(log n).
"""

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.material_tag import material_tags
from app.models.tag import Tag


# ══════════════════════════════════════════════════════════
# CRUD тегов
# ══════════════════════════════════════════════════════════
async def create_tag(
    db: AsyncSession,
    user_id: int,
    tag_name: str,
) -> Tag:
    """Создаёт тег. flush() — чтобы получить id без commit.

    На дубль (case-insensitive) выбросит IntegrityError —
    ловить его и переводить в доменное исключение должен сервис.
    """
    tag = Tag(user_id=user_id, tag_name=tag_name)
    db.add(tag)
    await db.flush()
    return tag


async def get_tag_by_id(db: AsyncSession, tag_id: int) -> Tag | None:
    """Один тег по PK. Проверка владельца — на стороне сервиса."""
    return await db.get(Tag, tag_id)


async def get_tag_by_name_ci(
    db: AsyncSession,
    user_id: int,
    tag_name: str,
) -> Tag | None:
    """Регистронезависимый поиск тега по имени.

    Использует функциональный индекс uq_tags_user_lower_name —
    тот же, что обеспечивает UNIQUE-проверку. Это значит:
        - O(log n) даже на больших объёмах;
        - результат гарантированно совпадает с тем, что
          увидит UNIQUE-констрейнт при INSERT, поэтому проверки
          в сервисе и в БД не разъезжаются.

    РАНЬШЕ функция называлась get_tag_by_name и сравнивала строки
    "как есть" — это давало баг: сервис проверял дубль по точному
    совпадению, не находил, делал INSERT, и БД ругалась
    IntegrityError-ом из-за UNIQUE по lower(). Сервис при этом
    делал rollback всей транзакции. Теперь проверка и индекс
    согласованы.
    """
    stmt = select(Tag).where(
        Tag.user_id == user_id,
        func.lower(Tag.tag_name) == tag_name.lower(),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_tags_by_user(db: AsyncSession, user_id: int) -> list[Tag]:
    """Все теги юзера, отсортированные по id (стабильный порядок)."""
    stmt = select(Tag).where(Tag.user_id == user_id).order_by(Tag.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_tags_by_ids(
    db: AsyncSession,
    tag_ids: list[int],
) -> list[Tag]:
    """Батч-выборка тегов по списку id.

    Используется сервисом для bulk-проверки владельца
    (один SQL вместо N запросов в цикле).
    """
    if not tag_ids:
        return []
    stmt = select(Tag).where(Tag.id.in_(tag_ids))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_tag(
    db: AsyncSession,
    tag: Tag,
    tag_name: str,
) -> Tag:
    """Переименовать тег. flush — чтобы изменения попали в БД до commit.

    Как и create_tag: на коллизию по lower() выбросит IntegrityError.
    """
    tag.tag_name = tag_name
    await db.flush()
    return tag


async def delete_tag(db: AsyncSession, tag: Tag) -> None:
    """Удалить тег.

    Связи в material_tags чистятся каскадом
    (ondelete='CASCADE' на FK material_tags.tag_id).
    """
    await db.delete(tag)
    await db.flush()


# ══════════════════════════════════════════════════════════
# Связка material_tags
# ══════════════════════════════════════════════════════════
async def get_material_tag_ids(
    db: AsyncSession,
    material_id: int,
) -> list[int]:
    """ID тегов, привязанных к материалу. Лёгкий запрос — без JOIN-а с tags."""
    stmt = select(material_tags.c.tag_id).where(
        material_tags.c.material_id == material_id,
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_tags_for_material(
    db: AsyncSession,
    material_id: int,
) -> list[Tag]:
    """Полные объекты Tag, привязанные к материалу. Сортировка по id."""
    stmt = (
        select(Tag)
        .join(material_tags, material_tags.c.tag_id == Tag.id)
        .where(material_tags.c.material_id == material_id)
        .order_by(Tag.id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def link_material_tag(
    db: AsyncSession,
    material_id: int,
    tag_id: int,
) -> bool:
    """Привязать тег к материалу.

    Идемпотентна на уровне SQL: ON CONFLICT DO NOTHING на PK
    (material_id, tag_id). Это:
        - убирает race condition (раньше было: SELECT существующих →
          INSERT; между ними другой запрос мог вставить эту же связь
          и получить дубль на UNIQUE);
        - избавляет сервис от лишнего предварительного SELECT;
        - не требует try/except IntegrityError + rollback в сервисе.

    Возвращает True, если связь была действительно вставлена,
    False — если уже существовала. Сервис сам решит, что с этим делать
    (тихо вернуть 200 или райзнуть 409).
    """
    stmt = (
        pg_insert(material_tags)
        .values(material_id=material_id, tag_id=tag_id)
        .on_conflict_do_nothing(
            index_elements=[
                material_tags.c.material_id,
                material_tags.c.tag_id,
            ],
        )
    )
    result = await db.execute(stmt)
    return result.rowcount > 0


async def unlink_material_tag(
    db: AsyncSession,
    material_id: int,
    tag_id: int,
) -> bool:
    """Снять тег с материала.

    Возвращает True, если связь существовала и была удалена,
    False — если такой связи и не было. Раньше сервис делал
    предварительный SELECT для проверки существования —
    теперь он не нужен.
    """
    stmt = delete(material_tags).where(
        material_tags.c.material_id == material_id,
        material_tags.c.tag_id == tag_id,
    )
    result = await db.execute(stmt)
    return result.rowcount > 0


async def set_material_tags(
    db: AsyncSession,
    material_id: int,
    tag_ids: list[int],
) -> list[int]:
    """Полная замена набора тегов у материала.

    Стратегия: снести всё → вставить новое. Это проще, чем считать
    diff (to_delete, to_insert), и для типичных объёмов (5–20 тегов
    на материал) не уступает в производительности.

    Дедупликация id — на уровне CRUD: если в роуте не отсеяли повторы,
    мы тут не упадём по UNIQUE.

    ВАЖНО: проверка владельца тегов (что все tag_ids принадлежат
    тому же юзеру, что и material) — обязанность сервиса.

    Возвращает фактически вставленные id (после дедупликации),
    в исходном порядке поступления — чтобы роут мог отдать клиенту
    итоговое состояние без дополнительного SELECT.
    """
    await db.execute(
        delete(material_tags).where(
            material_tags.c.material_id == material_id,
        ),
    )

    unique_ids = list(dict.fromkeys(tag_ids))

    if unique_ids:
        await db.execute(
            material_tags.insert(),
            [
                {"material_id": material_id, "tag_id": tid}
                for tid in unique_ids
            ],
        )

    return unique_ids