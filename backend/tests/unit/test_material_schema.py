"""Юнит-тесты валидации имени материала (баг №6: пустое имя).

Проверяем оба пути:
  - MaterialCreateText  → имя обязательно (_strip_required_name);
  - MaterialUpdate      → имя опционально (_strip_optional_name).
БД и HTTP не нужны — валидация живёт в Pydantic-схеме.
"""

import pytest
from pydantic import ValidationError

from app.schemas.material import MaterialCreateText, MaterialUpdate


# ─────────────────────────────────────────────
# MaterialCreateText: имя обязательно
# ─────────────────────────────────────────────
class TestCreateTextName:
    def test_valid_name_passes(self):
        model = MaterialCreateText(
            collection_id=1,
            material_name="Лекция 1",
            text_content="текст",
        )
        assert model.material_name == "Лекция 1"

    def test_name_is_trimmed(self):
        """'  Лекция 1  ' → 'Лекция 1' (пробелы по краям срезаются)."""
        model = MaterialCreateText(
            collection_id=1,
            material_name="  Лекция 1  ",
            text_content="текст",
        )
        assert model.material_name == "Лекция 1"

    def test_empty_string_rejected(self):
        """'' не проходит min_length=1 (тип ошибки string_too_short)."""
        with pytest.raises(ValidationError) as exc_info:
            MaterialCreateText(
                collection_id=1,
                material_name="",
                text_content="текст",
            )
        assert exc_info.value.error_count() == 1

    def test_whitespace_only_rejected(self):
        """'   ' проходит min_length, но валидатор ловит пустоту после strip."""
        with pytest.raises(ValidationError) as exc_info:
            MaterialCreateText(
                collection_id=1,
                material_name="   ",
                text_content="текст",
            )
        # сообщение из нашего ValueError — на русском
        assert "не может быть пустым" in str(exc_info.value)

    def test_too_long_name_rejected(self):
        """> 255 символов — max_length."""
        with pytest.raises(ValidationError):
            MaterialCreateText(
                collection_id=1,
                material_name="x" * 256,
                text_content="текст",
            )


# ─────────────────────────────────────────────
# MaterialUpdate: имя опционально (PATCH)
# ─────────────────────────────────────────────
class TestUpdateName:
    def test_name_omitted_is_none(self):
        """Поле не передано → остаётся None, валидатор не падает."""
        model = MaterialUpdate(is_important=True)
        assert model.material_name is None

    def test_valid_name_trimmed(self):
        model = MaterialUpdate(material_name="  Новое имя ")
        assert model.material_name == "Новое имя"

    def test_whitespace_only_rejected(self):
        """Передали '   ' явно → отклоняем, визуально пустое имя в БД не уедет."""
        with pytest.raises(ValidationError) as exc_info:
            MaterialUpdate(material_name="   ")
        assert "не может быть пустым" in str(exc_info.value)

    def test_empty_string_rejected(self):
        """'' не проходит min_length=1."""
        with pytest.raises(ValidationError):
            MaterialUpdate(material_name="")
