"""Unit-тесты схем материалов (app.schemas.material).

Фокус — регрессия бага #6 (создание материала с пустым именем):
проверяем, что пустое / пробельное имя отклоняется на уровне схемы,
а не доходит до БД.
"""

import pytest
from pydantic import ValidationError

from app.schemas.material import MaterialCreateText, MaterialUpdate


class TestMaterialCreateText:
    def test_valid_material(self):
        """Корректные данные проходят валидацию."""
        m = MaterialCreateText(
            collection_id=1,
            material_name="Лекция 1",
            text_content="Какой-то текст",
        )
        assert m.material_name == "Лекция 1"
        assert m.collection_id == 1

    def test_name_is_trimmed(self):
        """Пробелы по краям имени убираются."""
        m = MaterialCreateText(
            collection_id=1,
            material_name="  Лекция 1  ",
            text_content="текст",
        )
        assert m.material_name == "Лекция 1"

    def test_empty_name_rejected(self):
        """БАГ #6: пустое имя ('') отклоняется (min_length=1)."""
        with pytest.raises(ValidationError):
            MaterialCreateText(
                collection_id=1,
                material_name="",
                text_content="текст",
            )

    def test_whitespace_only_name_rejected(self):
        """БАГ #6: имя из одних пробелов отклоняется (валидатор strip)."""
        with pytest.raises(ValidationError) as exc:
            MaterialCreateText(
                collection_id=1,
                material_name="   ",
                text_content="текст",
            )
        assert "пустым" in str(exc.value)

    def test_empty_content_rejected(self):
        """Пустой text_content недопустим (min_length=1)."""
        with pytest.raises(ValidationError):
            MaterialCreateText(
                collection_id=1,
                material_name="Лекция",
                text_content="",
            )

    def test_too_long_name_rejected(self):
        """Имя длиннее 255 символов отклоняется."""
        with pytest.raises(ValidationError):
            MaterialCreateText(
                collection_id=1,
                material_name="x" * 256,
                text_content="текст",
            )

    def test_nonpositive_collection_id_rejected(self):
        """collection_id должен быть > 0 (gt=0)."""
        with pytest.raises(ValidationError):
            MaterialCreateText(
                collection_id=0,
                material_name="Лекция",
                text_content="текст",
            )


class TestMaterialUpdate:
    def test_all_fields_optional(self):
        """PATCH без полей валиден (ничего не меняем)."""
        m = MaterialUpdate()
        assert m.material_name is None
        assert m.text_content is None

    def test_partial_update_name_only(self):
        """Можно обновить только имя."""
        m = MaterialUpdate(material_name="Новое имя")
        assert m.material_name == "Новое имя"

    def test_name_trimmed_on_update(self):
        """Имя триммится и при обновлении."""
        m = MaterialUpdate(material_name="  Имя  ")
        assert m.material_name == "Имя"

    def test_whitespace_name_rejected_on_update(self):
        """БАГ #6: пробельное имя при обновлении тоже отклоняется."""
        with pytest.raises(ValidationError):
            MaterialUpdate(material_name="   ")

    def test_none_name_passes(self):
        """None имя означает 'не трогать' — валидатор пропускает."""
        m = MaterialUpdate(material_name=None)
        assert m.material_name is None
