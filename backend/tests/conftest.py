"""Корневые фикстуры и настройка окружения.

ВАЖНО: app.core.config создаёт singleton `settings` на этапе импорта,
причём POSTGRES_* и SECRET_KEY — обязательные поля без значений по умолчанию.
Поэтому переменные окружения должны быть выставлены ДО любого импорта из app.*.

Этот файл pytest импортирует раньше тестов, поэтому установка env здесь
гарантированно опережает импорт config.
"""

import os

os.environ.setdefault("POSTGRES_DB", "test_db")
os.environ.setdefault("POSTGRES_USER", "test_user")
os.environ.setdefault("POSTGRES_PASSWORD", "test_password")

os.environ.setdefault(
    "SECRET_KEY",
    "test-secret-key-for-unit-tests-only-0123456789",  # 46 символов
)

os.environ.setdefault("IS_PRODUCTION", "False")
os.environ.setdefault("CSRF_ENABLED", "False")
