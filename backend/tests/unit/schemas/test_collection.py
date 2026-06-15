"""Unit-тесты схем коллекций (app.schemas.collection).

Проверяем валидацию имени (баг #6), нормализацию иконки (пустая → None)
и опциональность полей в PATCH.
"""

import pytest
from pydantic import ValidationError

from app.schemas.collection import CollectionCreate, CollectionUpdate


class TestCollectionCreate:
    def test_valid(self):
        c = CollectionCreate(name="Физика", icon="📚", parent_id=None)
        assert c.name == "Физика"
        assert c.icon == "📚"

    def test_name_trimmed(self):
        c = CollectionCreate(name="  Физика  ")
        assert c.name == "Физика"

    def test_empty_name_rejected(self):
        """БАГ #6: пустое имя отклоняется."""
        with pytest.raises(ValidationError):
            CollectionCreate(name="")

    def test_whitespace_name_rejected(self):
        """БАГ #6: имя из пробелов отклоняется."""
        with pytest.raises(ValidationError):
            CollectionCreate(name="   ")

    def test_empty_icon_becomes_none(self):
        """Пустая/пробельная иконка нормализуется в None."""
        c = CollectionCreate(name="Физика", icon="   ")
        assert c.icon is None

    def test_none_icon_stays_none(self):
        c = CollectionCreate(name="Физика", icon=None)
        assert c.icon is None

    def test_too_long_name_rejected(self):
        with pytest.raises(ValidationError):
            CollectionCreate(name="x" * 101)


class TestCollectionUpdate:
    def test_empty_patch_valid(self):
        c = CollectionUpdate()
        assert c.name is None

    def test_name_trimmed(self):
        c = CollectionUpdate(name="  Алгебра  ")
        assert c.name == "Алгебра"

    def test_whitespace_name_rejected(self):
        """БАГ #6: пробельное имя при PATCH отклоняется."""
        with pytest.raises(ValidationError):
            CollectionUpdate(name="   ")
