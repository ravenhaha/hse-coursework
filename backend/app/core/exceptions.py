from fastapi import HTTPException


# ══════════════════════════════════════════
# Auth
# ══════════════════════════════════════════

def email_taken():
    raise HTTPException(status_code=409, detail="Email уже занят")


def invalid_credentials():
    raise HTTPException(status_code=401, detail="Неверный email или пароль")


def token_missing():
    raise HTTPException(status_code=401, detail="Токен не предоставлен")


def token_invalid():
    raise HTTPException(status_code=401, detail="Невалидный или просроченный токен")


def refresh_token_missing():
    raise HTTPException(status_code=401, detail="Refresh token отсутствует")


def not_authenticated():
    raise HTTPException(status_code=401, detail="Не авторизован")


# ══════════════════════════════════════════
# User
# ══════════════════════════════════════════

def user_not_found():
    raise HTTPException(status_code=404, detail="Пользователь не найден")


def user_inactive():
    raise HTTPException(status_code=403, detail="Аккаунт деактивирован")


# ══════════════════════════════════════════
# Collection
# ══════════════════════════════════════════

def collection_not_found():
    raise HTTPException(status_code=404, detail="Коллекция не найдена")


def collection_access_denied():
    raise HTTPException(status_code=403, detail="Нет доступа к этой коллекции")


def collection_name_duplicate():
    raise HTTPException(
        status_code=409,
        detail="Коллекция с таким именем уже существует на этом уровне",
    )


def collection_self_parent():
    raise HTTPException(
        status_code=400,
        detail="Нельзя переместить коллекцию в саму себя",
    )


# ══════════════════════════════════════════
# Material
# ══════════════════════════════════════════

def material_not_found():
    raise HTTPException(status_code=404, detail="Материал не найден")


def material_access_denied():
    raise HTTPException(status_code=403, detail="Нет доступа к этому материалу")


def invalid_source_type():
    raise HTTPException(
        status_code=400,
        detail="Неверный тип источника. Допустимые: text, file",
    )


# ИЗМЕНЕНО: принимает параметр чтобы сообщить лимит
def file_too_large(max_mb: int = 10):
    raise HTTPException(
        status_code=413,
        detail=f"Файл слишком большой. Максимум: {max_mb} MB",
    )


# ДОБАВЛЕНО: информативная ошибка — какое расширение не подошло
def file_type_not_allowed(ext: str, allowed: set[str]):
    raise HTTPException(
        status_code=400,
        detail=f"Тип файла '{ext}' не разрешён. Допустимые: {', '.join(sorted(allowed))}",
    )


# ══════════════════════════════════════════
# Tag
# ══════════════════════════════════════════

def tag_not_found():
    raise HTTPException(status_code=404, detail="Тег не найден")


def tag_access_denied():
    raise HTTPException(status_code=403, detail="Нет доступа к этому тегу")


def tag_name_duplicate():
    raise HTTPException(status_code=409, detail="Тег с таким именем уже существует")


def tag_already_assigned():
    raise HTTPException(status_code=409, detail="Тег уже привязан к материалу")


def tag_not_assigned():
    raise HTTPException(status_code=404, detail="Тег не привязан к материалу")


# ══════════════════════════════════════════
# General — для случаев когда нужна гибкость
# ══════════════════════════════════════════

def bad_request(detail: str = "Некорректный запрос"):
    raise HTTPException(status_code=400, detail=detail)


def forbidden(detail: str = "Доступ запрещён"):
    raise HTTPException(status_code=403, detail=detail)


def not_found(detail: str = "Не найдено"):
    raise HTTPException(status_code=404, detail=detail)


def conflict(detail: str = "Конфликт"):
    raise HTTPException(status_code=409, detail=detail)


# ИЗМЕНЕНО: тоже принимает параметр для гибкости
def server_error(detail: str = "Внутренняя ошибка сервера"):
    raise HTTPException(status_code=500, detail=detail)