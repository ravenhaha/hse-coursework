"""Интеграционные тесты локализации ошибок валидации (баг №5).

Проверяем, что 422 возвращается в русифицированном формате:
    {"detail": [{"field": "...", "message": "..."}]}

Покрываем:
    - формат ответа (detail = список объектов field/message);
    - кастомный текст из @field_validator (пробельное имя материала);
    - перевод по типу ошибки Pydantic (пустое имя → string_too_short);
    - missing — обязательное поле не передано;
    - перевод по имени поля (email при регистрации).
"""

import pytest

from app.core.config import settings
from app.models.collection import Collection

MATERIALS = f"{settings.API_PREFIX}/materials"
AUTH = f"{settings.API_PREFIX}/auth"


# ──────────────────────────────────────────
# Фикстура коллекции — тем же способом, что и в test_tag.py
# ──────────────────────────────────────────
def _collection_name_field() -> str:
    for candidate in ("collection_name", "name", "title"):
        if hasattr(Collection, candidate):
            return candidate
    raise RuntimeError("Не нашёл текстовое поле имени у модели Collection")


@pytest.fixture
async def collection_id(db_session, test_user) -> int:
    name_field = _collection_name_field()
    coll = Collection(**{name_field: "Для валидации"}, user_id=test_user.id)
    db_session.add(coll)
    await db_session.commit()
    await db_session.refresh(coll)
    return coll.id


# ──────────────────────────────────────────
# Хелпер: {"detail": [{"field": x, "message": y}]} -> {x: y}
# ──────────────────────────────────────────
def _messages_by_field(payload: dict) -> dict[str, str]:
    detail = payload["detail"]
    assert isinstance(detail, list), f"detail должен быть списком, а не {type(detail)}"
    result = {}
    for item in detail:
        assert "field" in item and "message" in item, item
        result[str(item["field"])] = item["message"]
    return result


# ══════════════════════════════════════════
# Формат ответа
# ══════════════════════════════════════════
class TestFormat:
    async def test_422_returns_list_of_field_message(self, client, collection_id):
        """detail — список объектов {field, message}, а не сырой Pydantic-формат."""
        resp = await client.post(f"{MATERIALS}/text", json={
            "collection_id": collection_id,
            "material_name": "",
            "text_content": "<p>x</p>",
        })
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert isinstance(detail, list)
        assert all({"field", "message"} <= set(item) for item in detail)


# ══════════════════════════════════════════
# Сообщения для материалов
# ══════════════════════════════════════════
class TestMaterialMessages:
    async def test_empty_name_string_too_short(self, client, collection_id):
        """Пустая строка → constraint min_length → 'Значение слишком короткое'."""
        resp = await client.post(f"{MATERIALS}/text", json={
            "collection_id": collection_id,
            "material_name": "",
            "text_content": "<p>x</p>",
        })
        assert resp.status_code == 422
        messages = _messages_by_field(resp.json())
        assert messages["material_name"] == "Значение слишком короткое"

    async def test_whitespace_name_custom_validator_message(self, client, collection_id):
        """Пробелы проходят min_length, но падают в @field_validator →
        отдаётся кастомный русский текст (приоритет №1)."""
        resp = await client.post(f"{MATERIALS}/text", json={
            "collection_id": collection_id,
            "material_name": "   ",
            "text_content": "<p>x</p>",
        })
        assert resp.status_code == 422
        messages = _messages_by_field(resp.json())
        assert messages["material_name"] == "Название материала не может быть пустым"

    async def test_missing_required_field(self, client, collection_id):
        """Не передали material_name → 'Обязательное поле не заполнено'."""
        resp = await client.post(f"{MATERIALS}/text", json={
            "collection_id": collection_id,
            "text_content": "<p>x</p>",
        })
        assert resp.status_code == 422
        messages = _messages_by_field(resp.json())
        assert messages["material_name"] == "Обязательное поле не заполнено"

    async def test_message_is_russian(self, client, collection_id):
        """В сообщении нет английских заглушек Pydantic."""
        resp = await client.post(f"{MATERIALS}/text", json={
            "collection_id": collection_id,
            "material_name": "",
            "text_content": "<p>x</p>",
        })
        for item in resp.json()["detail"]:
            assert not item["message"].lower().startswith("string")
            assert "field required" not in item["message"].lower()

# ══════════════════════════════════════════
# Сообщения для email (баг №5 — основной кейс из ТЗ)
# ══════════════════════════════════════════
class TestEmailMessages:
    """Невалидный email при регистрации должен возвращать русское сообщение.

    Регистрация под @limiter.limit("3/minute") — поэтому здесь МИНИМУМ
    запросов к /register (по одному на тест), чтобы не словить 429.
    """

    async def test_invalid_email_is_422(self, client):
        resp = await client.post(f"{AUTH}/register", json={
            "email": "не-валидный-емейл",
            "password": "Password123",
        })
        assert resp.status_code == 422, resp.text
        messages = _messages_by_field(resp.json())
        assert "email" in messages, messages

    async def test_invalid_email_message_is_russian(self, client):
        """Главная проверка бага №5: текст НЕ английский."""
        resp = await client.post(f"{AUTH}/register", json={
            "email": "abc@@bad",
            "password": "Password123",
        })
        assert resp.status_code == 422, resp.text
        messages = _messages_by_field(resp.json())
        email_msg = messages["email"]

        lowered = email_msg.lower()
        assert "value is not a valid email" not in lowered, email_msg
        assert "not a valid email address" not in lowered, email_msg
        assert "value_error" not in lowered, email_msg
        assert any("а" <= c.lower() <= "я" or c.lower() == "ё" for c in email_msg), email_msg
