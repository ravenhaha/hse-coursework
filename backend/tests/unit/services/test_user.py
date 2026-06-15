"""Unit-тесты сервиса пользователей.

Фокус:
    - update_user_profile: no-op при пустом payload, обновление display_name;
    - валидация аватара по РЕАЛЬНЫМ magic bytes (защита от подмены
      Content-Type → stored XSS);
    - remove_user_avatar: идемпотентность;
    - delete_user_account: сбор путей файлов ДО удаления.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

import app.services.user as user_service
from app.schemas.user import UserUpdate


# Минимальные валидные magic bytes для каждого формата
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
JPEG_BYTES = b"\xff\xd8\xff" + b"\x00" * 13
GIF_BYTES = b"GIF89a" + b"\x00" * 10
WEBP_BYTES = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 4
# То, что НЕ изображение (например, SVG/HTML с подделанным Content-Type)
SVG_BYTES = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"


def _make_user(user_id=42, avatar_path=None):
    u = MagicMock()
    u.id = user_id
    u.avatar_path = avatar_path
    return u


@pytest.fixture
def db():
    return AsyncMock()


@pytest.fixture
def patched(monkeypatch):
    mocks = {}
    for name in ["update_user", "save_avatar", "delete_file",
                 "list_all_user_materials"]:
        m = AsyncMock()
        monkeypatch.setattr(user_service, name, m)
        mocks[name] = m
    return mocks


def _make_upload(content: bytes, filename="avatar.png"):
    """Мок UploadFile: .read() возвращает content, .filename задан."""
    upload = MagicMock()
    upload.filename = filename
    upload.read = AsyncMock(return_value=content)
    return upload


class TestUpdateProfile:
    async def test_empty_payload_is_noop(self, db, patched):
        user = _make_user()
        result = await user_service.update_user_profile(
            db, user, UserUpdate(),
        )
        assert result is user
        patched["update_user"].assert_not_called()
        db.commit.assert_not_called()

    async def test_updates_display_name(self, db, patched):
        user = _make_user()
        await user_service.update_user_profile(
            db, user, UserUpdate(display_name="Новое Имя"),
        )
        patched["update_user"].assert_awaited_once()
        db.commit.assert_awaited_once()


class TestAvatarMagicBytes:
    """Главная ценность: формат проверяется по содержимому, не по заголовку.

    Сервис принимает только JPEG и PNG (whitelist). Всё остальное,
    включая валидные GIF/WEBP, отклоняется.
    """

    @pytest.mark.parametrize("content", [PNG_BYTES, JPEG_BYTES])
    async def test_valid_image_accepted(self, db, patched, content):
        user = _make_user()
        patched["save_avatar"].return_value = "avatars/42/abc.png"
        await user_service.update_user_avatar(db, user, _make_upload(content))
        patched["save_avatar"].assert_awaited_once()
        db.commit.assert_awaited_once()

    @pytest.mark.parametrize("content", [GIF_BYTES, WEBP_BYTES])
    async def test_non_whitelisted_image_rejected(self, db, patched, content):
        """GIF/WEBP — валидные изображения, но НЕ в whitelist → 400."""
        user = _make_user()
        with pytest.raises(HTTPException) as exc:
            await user_service.update_user_avatar(db, user, _make_upload(content))
        assert exc.value.status_code == 400
        patched["save_avatar"].assert_not_called()

    async def test_svg_with_fake_name_rejected(self, db, patched):
        """SVG/HTML под видом .png → 400, на диск НЕ пишем."""
        user = _make_user()
        upload = _make_upload(SVG_BYTES, filename="evil.png")
        with pytest.raises(HTTPException) as exc:
            await user_service.update_user_avatar(db, user, upload)
        assert exc.value.status_code == 400
        patched["save_avatar"].assert_not_called()

    async def test_empty_file_rejected(self, db, patched):
        user = _make_user()
        with pytest.raises(HTTPException) as exc:
            await user_service.update_user_avatar(db, user, _make_upload(b""))
        assert exc.value.status_code == 400

    async def test_oversized_file_rejected(self, db, patched, monkeypatch):
        """Файл больше MAX_AVATAR_SIZE → 413."""
        from app.core.config import settings
        monkeypatch.setattr(settings, "MAX_AVATAR_SIZE", 10)
        user = _make_user()
        big = PNG_BYTES + b"\x00" * 100
        with pytest.raises(HTTPException) as exc:
            await user_service.update_user_avatar(db, user, _make_upload(big))
        assert exc.value.status_code == 413

    async def test_old_avatar_deleted_after_commit(self, db, patched):
        user = _make_user(avatar_path="avatars/42/old.png")
        patched["save_avatar"].return_value = "avatars/42/new.png"
        await user_service.update_user_avatar(db, user, _make_upload(PNG_BYTES))
        patched["delete_file"].assert_awaited_once_with("avatars/42/old.png")

    async def test_db_error_rolls_back_and_deletes_new_file(self, db, patched):
        user = _make_user(avatar_path="avatars/42/old.png")
        patched["save_avatar"].return_value = "avatars/42/new.png"
        patched["update_user"].side_effect = RuntimeError("db down")

        with pytest.raises(RuntimeError):
            await user_service.update_user_avatar(db, user, _make_upload(PNG_BYTES))

        db.rollback.assert_awaited_once()
        patched["delete_file"].assert_awaited_once_with("avatars/42/new.png")
        

class TestRemoveAvatar:
    async def test_no_avatar_is_noop(self, db, patched):
        user = _make_user(avatar_path=None)
        result = await user_service.remove_user_avatar(db, user)
        assert result is user
        patched["update_user"].assert_not_called()
        patched["delete_file"].assert_not_called()

    async def test_removes_avatar(self, db, patched):
        user = _make_user(avatar_path="avatars/42/a.png")
        await user_service.remove_user_avatar(db, user)
        patched["update_user"].assert_awaited_once()
        db.commit.assert_awaited_once()
        patched["delete_file"].assert_awaited_once_with("avatars/42/a.png")


class TestDeleteAccount:
    async def test_collects_files_before_delete(self, db, patched):
        """Пути файлов собираются ДО удаления юзера, потом чистится диск."""
        from app.models.material import SourceType

        user = _make_user(avatar_path="avatars/42/me.png")

        file_mat = MagicMock()
        file_mat.source_type = SourceType.FILE
        file_mat.file_path = "uploads/42/doc.pdf"
        text_mat = MagicMock()
        text_mat.source_type = SourceType.TEXT
        text_mat.file_path = None

        patched["list_all_user_materials"].return_value = [file_mat, text_mat]

        await user_service.delete_user_account(db, user)

        db.delete.assert_awaited_once_with(user)
        db.commit.assert_awaited_once()
        # удалены: файл материала + аватар (текстовый материал без файла — пропущен)
        deleted_paths = {call.args[0] for call in patched["delete_file"].await_args_list}
        assert deleted_paths == {"uploads/42/doc.pdf", "avatars/42/me.png"}
