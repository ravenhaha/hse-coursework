"""Тесты локального файлового хранилища."""

import pytest

from app.core import file_storage
from app.core.file_storage import (
    _get_safe_extension,
    _resolve_and_check_path,
    delete_file,
    file_exists,
    get_full_path,
    save_avatar,
    save_material,
)


@pytest.fixture
def uploads_dir(tmp_path, monkeypatch):
    """Подменяет settings внутри file_storage на фейк с временными путями."""
    uploads = tmp_path / "uploads"
    materials = uploads / "materials"
    avatars = uploads / "avatars"
    for d in (uploads, materials, avatars):
        d.mkdir(parents=True, exist_ok=True)

    class _FakeSettings:
        UPLOADS_DIR = uploads
        MATERIALS_DIR = materials
        AVATARS_DIR = avatars

    monkeypatch.setattr(file_storage, "settings", _FakeSettings())
    return uploads


class TestSafeExtension:
    def test_allowed_extension(self):
        allowed = frozenset({".pdf", ".txt"})
        assert _get_safe_extension("file.PDF", allowed) == ".pdf"

    def test_disallowed_becomes_bin(self):
        allowed = frozenset({".pdf"})
        assert _get_safe_extension("evil.exe", allowed) == ".bin"

    def test_no_extension_becomes_bin(self):
        assert _get_safe_extension("noext", frozenset({".pdf"})) == ".bin"


class TestResolveAndCheckPath:
    def test_valid_path(self, uploads_dir):
        result = _resolve_and_check_path("materials/1/file.pdf")
        assert result is not None
        assert result.is_relative_to(uploads_dir.resolve())

    def test_traversal_blocked(self, uploads_dir):
        assert _resolve_and_check_path("../../etc/passwd") is None

    def test_get_full_path_alias(self, uploads_dir):
        assert get_full_path("../../../etc") is None
        assert get_full_path("materials/x.pdf") is not None


class TestSaveMaterial:
    @pytest.mark.asyncio
    async def test_saves_and_returns_relative_path(self, uploads_dir):
        rel_path, size = await save_material(42, "лекция.pdf", b"content123")
        assert rel_path.startswith("materials/42/")
        assert rel_path.endswith(".pdf")
        assert "/" in rel_path  # POSIX-разделители
        assert size == 10
        assert (uploads_dir / rel_path).exists()

    @pytest.mark.asyncio
    async def test_disallowed_extension_becomes_bin(self, uploads_dir):
        rel_path, _ = await save_material(1, "virus.exe", b"x")
        assert rel_path.endswith(".bin")


class TestSaveAvatar:
    @pytest.mark.asyncio
    async def test_saves_avatar(self, uploads_dir):
        rel_path = await save_avatar(7, "ava.png", b"img")
        assert rel_path.startswith("avatars/7/")
        assert rel_path.endswith(".png")
        assert (uploads_dir / rel_path).exists()


class TestDeleteFile:
    @pytest.mark.asyncio
    async def test_delete_existing(self, uploads_dir):
        rel_path, _ = await save_material(1, "f.txt", b"x")
        assert await delete_file(rel_path) is True
        assert not (uploads_dir / rel_path).exists()

    @pytest.mark.asyncio
    async def test_delete_none(self, uploads_dir):
        assert await delete_file(None) is False

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, uploads_dir):
        assert await delete_file("materials/1/ghost.pdf") is False

    @pytest.mark.asyncio
    async def test_delete_traversal_blocked(self, uploads_dir):
        assert await delete_file("../../etc/passwd") is False


class TestFileExists:
    @pytest.mark.asyncio
    async def test_exists_true(self, uploads_dir):
        rel_path, _ = await save_material(1, "f.txt", b"x")
        assert await file_exists(rel_path) is True

    @pytest.mark.asyncio
    async def test_exists_none(self, uploads_dir):
        assert await file_exists(None) is False

    @pytest.mark.asyncio
    async def test_exists_traversal(self, uploads_dir):
        assert await file_exists("../../x") is False
