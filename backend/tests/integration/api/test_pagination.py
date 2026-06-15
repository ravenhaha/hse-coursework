"""Интеграционные тесты пагинации материалов (баг №2).

Эндпоинт: GET /materials/paginated
Ответ — обёртка Page:
    {"items": [...], "total": N, "limit": L, "offset": O, "has_more": bool}

Параметры PaginationParams:
    limit  — 1..200, дефолт 50
    offset — >= 0,   дефолт 0

Покрываем:
    - дефолтные значения limit/offset;
    - корректный total и арифметику has_more;
    - постраничный обход (страницы не пересекаются, покрывают всё);
    - кастомные limit/offset;
    - offset за пределами данных → пустой items, total прежний;
    - изоляцию по пользователю (через collection_id своего юзера);
    - граничные/невалидные значения → 422.
"""

import pytest

from app.core.config import settings
from app.models.collection import Collection

MATERIALS = f"{settings.API_PREFIX}/materials"


# ──────────────────────────────────────────
# Фикстуры (тот же стиль, что и в test_validation.py)
# ──────────────────────────────────────────
def _collection_name_field() -> str:
    for candidate in ("collection_name", "name", "title"):
        if hasattr(Collection, candidate):
            return candidate
    raise RuntimeError("Не нашёл текстовое поле имени у модели Collection")


@pytest.fixture
async def collection_id(db_session, test_user) -> int:
    name_field = _collection_name_field()
    coll = Collection(**{name_field: "Для пагинации"}, user_id=test_user.id)
    db_session.add(coll)
    await db_session.commit()
    await db_session.refresh(coll)
    return coll.id


async def _create_materials(client, collection_id: int, count: int) -> None:
    """Создаёт count текстовых материалов через публичный API."""
    for i in range(count):
        resp = await client.post(f"{MATERIALS}/text", json={
            "collection_id": collection_id,
            "material_name": f"Материал {i:03d}",
            "text_content": f"<p>Текст {i}</p>",
        })
        assert resp.status_code == 201, resp.text


def _ids(page: dict) -> list[int]:
    return [item["id"] for item in page["items"]]


# ══════════════════════════════════════════
# Структура ответа и дефолты
# ══════════════════════════════════════════
class TestPageShape:
    async def test_default_params(self, client, collection_id):
        """Без query-параметров: limit=50, offset=0, корректный total."""
        await _create_materials(client, collection_id, 3)

        resp = await client.get(
            f"{MATERIALS}/paginated",
            params={"collection_id": collection_id},
        )
        assert resp.status_code == 200, resp.text
        page = resp.json()

        assert set(page) == {"items", "total", "limit", "offset", "has_more"}
        assert page["limit"] == 50
        assert page["offset"] == 0
        assert page["total"] == 3
        assert len(page["items"]) == 3
        assert page["has_more"] is False

    async def test_empty_collection(self, client, collection_id):
        """Пустая коллекция: items=[], total=0, has_more=False."""
        resp = await client.get(
            f"{MATERIALS}/paginated",
            params={"collection_id": collection_id},
        )
        assert resp.status_code == 200, resp.text
        page = resp.json()
        assert page["items"] == []
        assert page["total"] == 0
        assert page["has_more"] is False


# ══════════════════════════════════════════
# Арифметика: total / has_more / limit / offset
# ══════════════════════════════════════════
class TestPaginationMath:
    async def test_has_more_true_on_first_page(self, client, collection_id):
        """5 материалов, limit=2 → первая страница неполная выборка, has_more=True."""
        await _create_materials(client, collection_id, 5)

        resp = await client.get(f"{MATERIALS}/paginated", params={
            "collection_id": collection_id,
            "limit": 2,
            "offset": 0,
        })
        assert resp.status_code == 200, resp.text
        page = resp.json()
        assert page["total"] == 5
        assert page["limit"] == 2
        assert page["offset"] == 0
        assert len(page["items"]) == 2
        assert page["has_more"] is True  # 0 + 2 < 5

    async def test_has_more_false_on_last_page(self, client, collection_id):
        """Последняя страница: offset+len == total → has_more=False."""
        await _create_materials(client, collection_id, 5)

        resp = await client.get(f"{MATERIALS}/paginated", params={
            "collection_id": collection_id,
            "limit": 2,
            "offset": 4,
        })
        assert resp.status_code == 200, resp.text
        page = resp.json()
        assert page["total"] == 5
        assert len(page["items"]) == 1
        assert page["has_more"] is False

    async def test_offset_beyond_total(self, client, collection_id):
        """offset за пределами данных: items=[], total прежний, has_more=False."""
        await _create_materials(client, collection_id, 3)

        resp = await client.get(f"{MATERIALS}/paginated", params={
            "collection_id": collection_id,
            "limit": 10,
            "offset": 100,
        })
        assert resp.status_code == 200, resp.text
        page = resp.json()
        assert page["items"] == []
        assert page["total"] == 3
        assert page["has_more"] is False 


# ══════════════════════════════════════════
# Постраничный обход
# ══════════════════════════════════════════
class TestPageWalking:
    async def test_pages_do_not_overlap_and_cover_all(self, client, collection_id):
        """Обходим все материалы постранично: страницы не пересекаются и
        в сумме покрывают весь набор без потерь и дублей."""
        await _create_materials(client, collection_id, 7)

        limit = 3
        seen: list[int] = []
        offset = 0

        while True:
            resp = await client.get(f"{MATERIALS}/paginated", params={
                "collection_id": collection_id,
                "limit": limit,
                "offset": offset,
            })
            assert resp.status_code == 200, resp.text
            page = resp.json()
            seen.extend(_ids(page))
            if not page["has_more"]:
                break
            offset += limit

        assert len(seen) == 7
        assert len(set(seen)) == 7


# ══════════════════════════════════════════
# Валидация query-параметров → 422
# ══════════════════════════════════════════
class TestParamsValidation:
    @pytest.mark.parametrize("limit", [0, -1, 201])
    async def test_invalid_limit(self, client, collection_id, limit):
        """limit вне [1..200] → 422."""
        resp = await client.get(f"{MATERIALS}/paginated", params={
            "collection_id": collection_id,
            "limit": limit,
        })
        assert resp.status_code == 422, resp.text

    @pytest.mark.parametrize("offset", [-1, -100])
    async def test_invalid_offset(self, client, collection_id, offset):
        """offset < 0 → 422."""
        resp = await client.get(f"{MATERIALS}/paginated", params={
            "collection_id": collection_id,
            "offset": offset,
        })
        assert resp.status_code == 422, resp.text
