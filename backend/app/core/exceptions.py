"""Фабрики типовых HTTP-исключений приложения.

Использование:
    from app.core.exceptions import user_not_found
    if not user:
        user_not_found()        # сразу райзит HTTPException(404)
"""

from typing import NoReturn

from fastapi import HTTPException, status


# ══════════════════════════════════════════
# Auth
# ══════════════════════════════════════════

def email_taken() -> NoReturn:
    raise HTTPException(status.HTTP_409_CONFLICT, "Email уже занят")


def invalid_credentials() -> NoReturn:
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")


def token_missing() -> NoReturn:
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Токен не предоставлен")


def token_invalid() -> NoReturn:
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный или просроченный токен")


def refresh_token_missing() -> NoReturn:
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token отсутствует")


def not_authenticated() -> NoReturn:
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Не авторизован")


# ══════════════════════════════════════════
# User
# ══════════════════════════════════════════

def user_not_found() -> NoReturn:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")


def user_inactive() -> NoReturn:
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт деактивирован")


# ══════════════════════════════════════════
# Collection
# ══════════════════════════════════════════

def collection_not_found() -> NoReturn:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Коллекция не найдена")


def collection_access_denied() -> NoReturn:
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к этой коллекции")


def collection_name_duplicate() -> NoReturn:
    raise HTTPException(
        status.HTTP_409_CONFLICT,
        "Коллекция с таким именем уже существует на этом уровне",
    )


def collection_self_parent() -> NoReturn:
    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        "Нельзя переместить коллекцию в саму себя",
    )


# ══════════════════════════════════════════
# Material
# ══════════════════════════════════════════

def material_not_found() -> NoReturn:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Материал не найден")


def material_access_denied() -> NoReturn:
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к этому материалу")


def invalid_source_type() -> NoReturn:
    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        "Неверный тип источника. Допустимые: text, file",
    )


def file_too_large(max_mb: int = 10) -> NoReturn:
    raise HTTPException(
        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        f"Файл слишком большой. Максимум: {max_mb} MB",
    )


def file_type_not_allowed(ext: str, allowed: set[str]) -> NoReturn:
    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        f"Тип файла '{ext}' не разрешён. Допустимые: {', '.join(sorted(allowed))}",
    )


def unsupported_media_type(detail: str = "Тип файла не поддерживается") -> NoReturn:
    """415 Unsupported Media Type. Используется при загрузке файла
    с расширением вне белого списка."""
    raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail)


# ══════════════════════════════════════════
# Tag
# ══════════════════════════════════════════

def tag_not_found() -> NoReturn:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Тег не найден")


def tag_access_denied() -> NoReturn:
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к этому тегу")


def tag_name_duplicate() -> NoReturn:
    raise HTTPException(status.HTTP_409_CONFLICT, "Тег с таким именем уже существует")


def tag_already_assigned() -> NoReturn:
    raise HTTPException(status.HTTP_409_CONFLICT, "Тег уже привязан к материалу")


def tag_not_assigned() -> NoReturn:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Тег не привязан к материалу")


# ══════════════════════════════════════════
# General
# ══════════════════════════════════════════

def bad_request(detail: str = "Некорректный запрос") -> NoReturn:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, detail)


def forbidden(detail: str = "Доступ запрещён") -> NoReturn:
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail)


def not_found(detail: str = "Не найдено") -> NoReturn:
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail)


def conflict(detail: str = "Конфликт") -> NoReturn:
    raise HTTPException(status.HTTP_409_CONFLICT, detail)


def payload_too_large(detail: str = "Файл слишком большой") -> NoReturn:
    """Универсальный 413. Для файлов с конкретным лимитом
    лучше использовать file_too_large(max_mb)."""
    raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail)


def server_error(detail: str = "Внутренняя ошибка сервера") -> NoReturn:
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail)