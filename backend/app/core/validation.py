"""Локализация ошибок валидации (422) на русский язык.

Логика вынесена из main.py в чистую функцию, чтобы покрыть её
unit-тестами без подъёма HTTP-слоя.
"""

_VALIDATION_MESSAGES_RU: dict[str, str] = {
    "value_error": "Некорректное значение",
    "string_too_short": "Значение слишком короткое",
    "string_too_long": "Значение слишком длинное",
    "missing": "Обязательное поле не заполнено",
    "int_parsing": "Ожидается целое число",
    "greater_than": "Значение должно быть больше допустимого минимума",
    "greater_than_equal": "Значение меньше допустимого минимума",
    "less_than_equal": "Значение больше допустимого максимума",
}

_FIELD_MESSAGES_RU: dict[str, str] = {
    "email": "Некорректный адрес электронной почты",
}


def translate_validation_errors(errors: list[dict]) -> list[dict]:
    """Переводит список ошибок Pydantic (exc.errors()) на русский.

    Приоритет сообщений:
        1) кастомный текст из @field_validator (raise ValueError("...")) —
           он уже на русском и самый точный;
        2) перевод по имени поля (email и т.п.);
        3) перевод по типу ошибки Pydantic;
        4) исходный msg как фолбэк.

    Про шаг 1: и наши ValueError, и ошибки EmailStr приходят с
    type="value_error". Различаем по префиксу: Pydantic v2 оборачивает
    наши raise ValueError("...") строго как "Value error, <текст>", а
    email-validator даёт "value is not a valid email address: ...".
    Берём custom_msg ТОЛЬКО при наличии префикса.
    """
    result = []
    for error in errors:
        field = error["loc"][-1] if error["loc"] else ""
        error_type = error["type"]

        custom_msg = None
        raw = error.get("msg", "")
        if error_type == "value_error" and raw.startswith("Value error, "):
            custom_msg = raw.removeprefix("Value error, ").strip() or None

        message = (
            custom_msg
            or _FIELD_MESSAGES_RU.get(str(field))
            or _VALIDATION_MESSAGES_RU.get(error_type)
            or error["msg"]
        )
        result.append({"field": field, "message": message})

    return result
