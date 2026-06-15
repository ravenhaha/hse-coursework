"""Unit-тесты схем тегов (app.schemas.tag)."""

import pytest
from pydantic import ValidationError

from app.schemas.tag import TagCreate, TagUpdate, MaterialTagsSet


class TestTagCreate:
    def test_valid(self):
        t = TagCreate(tag_name="Python")
        assert t.tag_name == "Python"

    def test_name_trimmed(self):
        t = TagCreate(tag_name="  Python  ")
        assert t.tag_name == "Python"

    def test_case_preserved(self):
        """Регистр сохраняется (нормализация только trim, без lower)."""
        t = TagCreate(tag_name="PYTHON")
        assert t.tag_name == "PYTHON"

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            TagCreate(tag_name="")

    def test_whitespace_name_rejected(self):
        with pytest.raises(ValidationError):
            TagCreate(tag_name="   ")

    def test_too_long_rejected(self):
        with pytest.raises(ValidationError):
            TagCreate(tag_name="x" * 51)


class TestTagUpdate:
    def test_name_required(self):
        """tag_name обязателен — PATCH без него невалиден."""
        with pytest.raises(ValidationError):
            TagUpdate()

    def test_valid(self):
        t = TagUpdate(tag_name="NewName")
        assert t.tag_name == "NewName"


class TestMaterialTagsSet:
    def test_empty_list_valid(self):
        """Пустой список тегов валиден (снять все теги)."""
        s = MaterialTagsSet(tag_ids=[])
        assert s.tag_ids == []

    def test_default_empty(self):
        s = MaterialTagsSet()
        assert s.tag_ids == []

    def test_too_many_tags_rejected(self):
        """Защита от DoS: больше 100 тегов отклоняется."""
        with pytest.raises(ValidationError):
            MaterialTagsSet(tag_ids=list(range(101)))
