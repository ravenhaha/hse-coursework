"""Unit-тесты создания дефолтных тегов для нового пользователя.

Фокус:
    - создание всех дефолтных тегов с чистого листа;
    - идемпотентность: повторный вызов не плодит дубли;
    - регистронезависимость (соответствие UNIQUE-индексу
      uq_tags_user_lower_name);
    - сохранение порядка тегов (важно для UI);
    - функция НЕ делает commit (транзакция — забота вызывающего).
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

import app.services.defaults as defaults_service
from app.services.defaults import (
    DEFAULT_TAG_NAMES,
    create_default_tags_for_user,
)

USER_ID = 7


@pytest.fixture
def db():
    return AsyncMock()


@pytest.fixture
def patched(monkeypatch):
    """Мокаем CRUD-функции, которые дёргает сервис."""
    get_tags = AsyncMock()
    create_tag = AsyncMock()
    monkeypatch.setattr(defaults_service, "get_tags_by_user", get_tags)
    monkeypatch.setattr(defaults_service, "create_tag", create_tag)
    return {"get_tags_by_user": get_tags, "create_tag": create_tag}


def _tag(name: str):
    """Мок ORM-тега с нужным именем."""
    t = MagicMock()
    t.tag_name = name
    return t


class TestCreateDefaultTags:
    async def test_creates_all_on_empty(self, db, patched):
        """У нового юзера тегов нет → создаются все дефолтные."""
        patched["get_tags_by_user"].return_value = []

        await create_default_tags_for_user(db, USER_ID)

        assert patched["create_tag"].await_count == len(DEFAULT_TAG_NAMES)
        # передаётся правильный user_id
        for call in patched["create_tag"].await_args_list:
            assert call.args[0] is db
            assert call.args[1] == USER_ID

    async def test_preserves_order(self, db, patched):
        """Теги создаются в объявленном порядке (важно для UI)."""
        patched["get_tags_by_user"].return_value = []

        await create_default_tags_for_user(db, USER_ID)

        created_names = [c.args[2] for c in patched["create_tag"].await_args_list]
        assert created_names == list(DEFAULT_TAG_NAMES)

    async def test_idempotent_skips_existing(self, db, patched):
        """Все теги уже есть → не создаётся ничего (нет дублей)."""
        patched["get_tags_by_user"].return_value = [
            _tag(name) for name in DEFAULT_TAG_NAMES
        ]

        await create_default_tags_for_user(db, USER_ID)

        patched["create_tag"].assert_not_called()

    async def test_creates_only_missing(self, db, patched):
        """Часть тегов есть → создаются только недостающие."""
        existing = ["лекция", "важно"]
        patched["get_tags_by_user"].return_value = [_tag(n) for n in existing]

        await create_default_tags_for_user(db, USER_ID)

        created_names = [c.args[2] for c in patched["create_tag"].await_args_list]
        assert "лекция" not in created_names
        assert "важно" not in created_names
        assert len(created_names) == len(DEFAULT_TAG_NAMES) - len(existing)

    async def test_case_insensitive_match(self, db, patched):
        """Существующий тег в другом регистре → дубль не создаётся."""
        # юзер уже имеет "ЛЕКЦИЯ" — дефолтный "лекция" должен пропуститься
        patched["get_tags_by_user"].return_value = [_tag("ЛЕКЦИЯ")]

        await create_default_tags_for_user(db, USER_ID)

        created_names = [c.args[2] for c in patched["create_tag"].await_args_list]
        assert "лекция" not in created_names
        assert len(created_names) == len(DEFAULT_TAG_NAMES) - 1

    async def test_does_not_commit(self, db, patched):
        """Функция НЕ коммитит — это ответственность вызывающего."""
        patched["get_tags_by_user"].return_value = []

        await create_default_tags_for_user(db, USER_ID)

        db.commit.assert_not_called()
