"""Unit-тесты локализации ошибок валидации (баг №5)."""

from app.core.validation import translate_validation_errors


class TestTranslateValidationErrors:

    def test_custom_value_error_used(self):
        """Приоритет 1: русский текст из @field_validator берётся как есть."""
        errors = [{
            "loc": ("body", "material_name"),
            "type": "value_error",
            "msg": "Value error, Название материала не может быть пустым",
        }]
        result = translate_validation_errors(errors)
        assert result == [{
            "field": "material_name",
            "message": "Название материала не может быть пустым",
        }]

    def test_email_translated_by_field(self):
        """Приоритет 2: ошибка EmailStr (value_error без нашего префикса)
        переводится по имени поля, а не уходит в английский msg."""
        errors = [{
            "loc": ("body", "email"),
            "type": "value_error",
            "msg": "value is not a valid email address: ...",
        }]
        result = translate_validation_errors(errors)
        assert result[0]["message"] == "Некорректный адрес электронной почты"

    def test_translated_by_type(self):
        """Приоритет 3: перевод по типу ошибки Pydantic."""
        errors = [{
            "loc": ("body", "text_content"),
            "type": "missing",
            "msg": "Field required",
        }]
        result = translate_validation_errors(errors)
        assert result[0]["message"] == "Обязательное поле не заполнено"

    def test_fallback_to_original_msg(self):
        """Приоритет 4: неизвестный тип → исходный msg."""
        errors = [{
            "loc": ("body", "weird"),
            "type": "some_unknown_type",
            "msg": "Some original message",
        }]
        result = translate_validation_errors(errors)
        assert result[0]["message"] == "Some original message"

    def test_empty_loc_handled(self):
        """Пустой loc не должен ронять функцию."""
        errors = [{"loc": (), "type": "missing", "msg": "Field required"}]
        result = translate_validation_errors(errors)
        assert result[0]["field"] == ""
        assert result[0]["message"] == "Обязательное поле не заполнено"

    def test_multiple_errors(self):
        """Несколько ошибок переводятся пачкой."""
        errors = [
            {"loc": ("body", "email"), "type": "value_error",
             "msg": "value is not a valid email address"},
            {"loc": ("body", "name"), "type": "missing", "msg": "Field required"},
        ]
        result = translate_validation_errors(errors)
        assert len(result) == 2
        assert result[0]["message"] == "Некорректный адрес электронной почты"
        assert result[1]["message"] == "Обязательное поле не заполнено"
