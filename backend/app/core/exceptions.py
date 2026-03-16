from fastapi import HTTPException


# === Auth ===
def email_taken():
    raise HTTPException(status_code=400, detail="Email уже занят")


def username_taken():
    raise HTTPException(status_code=400, detail="Username уже занят")


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


# === User ===
def user_not_found():
    raise HTTPException(status_code=404, detail="Пользователь не найден")


def user_inactive():
    raise HTTPException(status_code=403, detail="Аккаунт деактивирован")


# === Collection ===
def collection_not_found():
    raise HTTPException(status_code=404, detail="Коллекция не найдена")


def collection_access_denied():
    raise HTTPException(status_code=403, detail="Нет доступа к этой коллекции")


def collection_name_duplicate():
    raise HTTPException(status_code=400, detail="Коллекция с таким именем уже существует")


# === Material ===
def material_not_found():
    raise HTTPException(status_code=404, detail="Материал не найден")


def material_access_denied():
    raise HTTPException(status_code=403, detail="Нет доступа к этому материалу")


def invalid_source_type():
    raise HTTPException(status_code=400, detail="Неверный тип источника. Допустимые: text, file")


# === Tag ===
def tag_not_found():
    raise HTTPException(status_code=404, detail="Тег не найден")


def tag_name_duplicate():
    raise HTTPException(status_code=400, detail="Тег с таким именем уже существует")


# === General ===
def forbidden():
    raise HTTPException(status_code=403, detail="Доступ запрещён")


def bad_request(detail: str = "Некорректный запрос"):
    raise HTTPException(status_code=400, detail=detail)


def server_error():
    raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")