"""Юнит-тесты чистых хелперов reports.py — без БД и моков.

Покрывают:
    - _html_to_text_snippet — очистка HTML, unescape, обрезка;
    - _safe_zip_name        — санитизация имён файлов;
    - _build_zip_entry_name — расширения и дедупликация имён в ZIP.
"""

import pytest

from app.services.reports import (
    _build_zip_entry_name,
    _html_to_text_snippet,
    _safe_zip_name,
)


# ══════════════════════════════════════════
# _html_to_text_snippet
# ══════════════════════════════════════════
class TestHtmlToTextSnippet:
    def test_strips_html_tags(self):
        result = _html_to_text_snippet("<p>Привет <b>мир</b></p>")
        assert result == "Привет мир"

    def test_unescapes_entities(self):
        result = _html_to_text_snippet("Ампер &amp; Вольт &lt;1&gt;")
        assert result == "Ампер & Вольт <1>"

    def test_collapses_whitespace(self):
        result = _html_to_text_snippet("много    \n\t  пробелов")
        assert result == "много пробелов"

    def test_truncates_to_max_len(self):
        result = _html_to_text_snippet("a" * 300, max_len=10)
        assert len(result) == 10

    def test_custom_max_len(self):
        result = _html_to_text_snippet("0123456789abc", max_len=5)
        assert result == "01234"

    @pytest.mark.parametrize("value", [None, ""])
    def test_empty_returns_empty_string(self, value):
        assert _html_to_text_snippet(value) == ""

    def test_default_max_len_160(self):
        result = _html_to_text_snippet("я" * 500)
        assert len(result) == 160


# ══════════════════════════════════════════
# _safe_zip_name
# ══════════════════════════════════════════
class TestSafeZipName:
    @pytest.mark.parametrize(
        "raw, expected",
        [
            ("normal_name", "normal_name"),
            ('bad<>:"/\\|?*name', "bad_________name"),
            ("  spaced  ", "spaced"),
            ("...dots...", "dots"),
        ],
    )
    def test_sanitizes(self, raw, expected):
        assert _safe_zip_name(raw, "fallback") == expected

    @pytest.mark.parametrize("value", [None, "", "   ", "..."])
    def test_uses_fallback_when_empty(self, value):
        assert _safe_zip_name(value, "fallback") == "fallback"

    def test_slashes_become_underscores(self):
        # слэши заменяются на _, fallback НЕ срабатывает
        assert _safe_zip_name("///", "fb") == "___"

    def test_control_chars_replaced(self):
        result = _safe_zip_name("file\x00\x1fname", "fb")
        assert result == "file__name"


# ══════════════════════════════════════════
# _build_zip_entry_name
# ══════════════════════════════════════════
class TestBuildZipEntryName:
    def test_simple_name_with_extension(self):
        used: set[str] = set()
        result = _build_zip_entry_name("конспект", "/path/file.pdf", 1, used)
        assert result == "files/конспект.pdf"

    def test_extension_not_duplicated(self):
        used: set[str] = set()
        result = _build_zip_entry_name("doc.pdf", "/path/file.pdf", 1, used)
        # base уже заканчивается на .pdf → не дублируем
        assert result == "files/doc.pdf"

    def test_fallback_name_when_empty(self):
        used: set[str] = set()
        result = _build_zip_entry_name("", "/path/file.txt", 42, used)
        assert result == "files/material_42.txt"

    def test_deduplicates_collisions(self):
        used: set[str] = set()
        first = _build_zip_entry_name("файл", "/p/a.pdf", 1, used)
        second = _build_zip_entry_name("файл", "/p/b.pdf", 2, used)
        third = _build_zip_entry_name("файл", "/p/c.pdf", 3, used)
        assert first == "files/файл.pdf"
        assert second == "files/файл (1).pdf"
        assert third == "files/файл (2).pdf"

    def test_used_names_set_is_updated(self):
        used: set[str] = set()
        _build_zip_entry_name("x", "/p/a.pdf", 1, used)
        assert "files/x.pdf" in used

    def test_no_extension_in_path(self):
        used: set[str] = set()
        result = _build_zip_entry_name("readme", "/path/noext", 1, used)
        assert result == "files/readme"
