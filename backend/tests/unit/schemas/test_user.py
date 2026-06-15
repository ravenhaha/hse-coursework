"""Unit-тесты схем пользователей (app.schemas.user).

Покрывают:
    • нормализацию email (trim + lower);
    • валидацию надёжности пароля;
    • валидацию display_name (запрет пустого / управляющих символов).
"""

import pytest
from pydantic import ValidationError

from app.schemas.user import (
    UserRegister,
    UserLogin,
    UserUpdate,
    validate_password_strength,
)


class TestUserRegister:
    def test_valid(self):
        u = UserRegister(email="Test@Example.COM", password="secret123")
        assert u.email == "test@example.com"  # нормализован

    def test_email_trimmed_and_lowered(self):
        u = UserRegister(email="  USER@Mail.RU  ", password="secret123")
        assert u.email == "user@mail.ru"

    def test_invalid_email_rejected(self):
        """Некорректный email отклоняется (EmailStr)."""
        with pytest.raises(ValidationError):
            UserRegister(email="not-an-email", password="secret123")

    def test_extra_fields_forbidden(self):
        """extra='forbid' — лишние поля отклоняются."""
        with pytest.raises(ValidationError):
            UserRegister(email="a@b.com", password="secret123", role="admin")

    def test_short_password_rejected(self):
        with pytest.raises(ValidationError):
            UserRegister(email="a@b.com", password="ab1")

    def test_password_without_digit_rejected(self):
        with pytest.raises(ValidationError):
            UserRegister(email="a@b.com", password="onlyletters")

    def test_password_without_letter_rejected(self):
        with pytest.raises(ValidationError):
            UserRegister(email="a@b.com", password="12345678")


class TestPasswordStrength:
    def test_valid_password(self):
        assert validate_password_strength("secret123") == "secret123"

    def test_too_short(self):
        with pytest.raises(ValueError):
            validate_password_strength("ab1")

    def test_no_letter(self):
        with pytest.raises(ValueError, match="букву"):
            validate_password_strength("12345678")

    def test_no_digit(self):
        with pytest.raises(ValueError, match="цифру"):
            validate_password_strength("onlyletters")

    def test_nul_byte_rejected(self):
        with pytest.raises(ValueError):
            validate_password_strength("secret12\x003")

    def test_cyrillic_letter_counts(self):
        """Кириллическая буква засчитывается."""
        assert validate_password_strength("пароль12") == "пароль12"


class TestUserUpdate:
    def test_valid_name(self):
        u = UserUpdate(display_name="Иван Иванов")
        assert u.display_name == "Иван Иванов"

    def test_name_trimmed(self):
        u = UserUpdate(display_name="  Иван  ")
        assert u.display_name == "Иван"

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            UserUpdate(display_name="   ")

    def test_newline_in_name_rejected(self):
        """Переносы строк запрещены."""
        with pytest.raises(ValidationError):
            UserUpdate(display_name="Иван\nИванов")

    def test_tab_in_name_rejected(self):
        with pytest.raises(ValidationError):
            UserUpdate(display_name="Иван\tИванов")

    def test_none_name_valid(self):
        u = UserUpdate(display_name=None)
        assert u.display_name is None


class TestUserLogin:
    def test_email_normalized(self):
        u = UserLogin(email="  A@B.COM ", password="whatever")
        assert u.email == "a@b.com"
