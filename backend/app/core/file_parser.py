"""Парсинг загружаемых файлов в HTML для редактора материалов.

Поддерживаются:
    .txt / .md         — простой текст (по абзацам)
    .pdf               — через PyMuPDF (если установлен)
    .docx              — через python-docx (с inline-стилями, картинками, таблицами)

Все возвращаемые HTML-строки безопасны для прямого рендера во фронте:
    - текст экранирован;
    - значения CSS-стилей провалидированы по белому списку.
"""

from __future__ import annotations

import base64
import logging
import re
from collections.abc import Callable
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════
# Безопасность: валидация значений из docx
# ══════════════════════════════════════════
_HEX_COLOR_RE = re.compile(r"^[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$")
_FONT_NAME_RE = re.compile(r"^[A-Za-zА-Яа-я0-9 \-]+$")
_HEADING_RE = re.compile(r"^heading\s*(\d)", re.IGNORECASE)

_MAX_INLINE_IMAGES_BYTES = 2 * 1024 * 1024


def _safe_color(value: str | None) -> str | None:
    """Возвращает '#xxxxxx' если value — валидный hex-цвет, иначе None."""
    if not value:
        return None
    if _HEX_COLOR_RE.match(value):
        return f"#{value}"
    return None


def _safe_font_name(value: str | None) -> str | None:
    """Пропускает только безопасные имена шрифтов."""
    if not value:
        return None
    if _FONT_NAME_RE.match(value):
        return value
    return None


def _escape_html(text: str) -> str:
    """Экранирует символы, ломающие HTML."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ══════════════════════════════════════════
# Публичный API
# ══════════════════════════════════════════
_PARSERS: dict[str, Callable[[Path], str]] = {}


def extract_text_from_file(file_path: str | Path) -> str | None:
    """Извлекает HTML-представление файла.

    Возвращает None при:
      - неподдерживаемом расширении (не зарегистрирован парсер);
      - ошибке парсинга (исключение залогировано).

    Никогда не пробрасывает исключения наружу — это позволяет вызывающему
    коду (services/material.py::create_file_material) безопасно засунуть
    результат в БД, не оборачивая в try/except.
    """
    path = Path(file_path)
    parser = _PARSERS.get(path.suffix.lower())
    if parser is None:
        logger.warning("Unsupported file extension: %s", path.suffix)
        return None
    try:
        return parser(path)
    except Exception:
        logger.exception("Failed to parse file %s", path)
        return None


# ══════════════════════════════════════════
# TXT / MD
# ══════════════════════════════════════════
def _parse_txt(path: Path) -> str:
    """Plain-текст по абзацам.

    Используется для .txt и .md. Markdown НЕ рендерится — это сознательно:
    юзер увидит в редакторе исходник Markdown и сможет дальше работать с
    ним как с обычным текстом. Когда понадобится рендер MD, добавим
    отдельный парсер (например, через `markdown-it-py`).
    """
    text = path.read_text(encoding="utf-8", errors="ignore")
    paragraphs = [
        f"<p>{_escape_html(line)}</p>"
        for line in text.split("\n")
        if line.strip()
    ]
    return "\n".join(paragraphs) if paragraphs else "<p></p>"


# ══════════════════════════════════════════
# PDF
# ══════════════════════════════════════════
try:
    import fitz
    _PDF_AVAILABLE = True
except ImportError:
    fitz = None
    _PDF_AVAILABLE = False
    logger.warning(
        "PyMuPDF не установлен — парсинг PDF отключён. pip install PyMuPDF"
    )


def _parse_pdf(path: Path) -> str:
    """Текст PDF по строкам.

    Регистрируется в _PARSERS только если PyMuPDF доступен — иначе
    extract_text_from_file отдаст None как для любого неподдерживаемого
    формата. Это честнее, чем возвращать "" из мёртвой функции.
    """
    paragraphs: list[str] = []
    with fitz.open(str(path)) as doc:
        for page in doc:
            for line in page.get_text().split("\n"):
                line = line.strip()
                if line:
                    paragraphs.append(f"<p>{_escape_html(line)}</p>")
    return "\n".join(paragraphs)


# ══════════════════════════════════════════
# DOCX
# ══════════════════════════════════════════
def _parse_docx(path: Path) -> str:
    doc = Document(str(path))
    images = _extract_images(doc)
    parts: list[str] = []

    for element in doc.element.body:
        tag = element.tag.rsplit("}", 1)[-1]

        if tag == "p":
            parts.append(_render_paragraph(Paragraph(element, doc), images))

        elif tag == "tbl":
            parts.append(_render_table(Table(element, doc), images))

    return "\n".join(parts)


def _extract_images(doc: Document) -> dict[str, str]:
    """rId → data:image/...;base64,... — для inline-вставки в <img src>.

    Лимит _MAX_INLINE_IMAGES_BYTES: после превышения остальные картинки
    пропускаются, в логи пишется warning. Это защита от случая, когда
    юзер заливает docx с десятком фоток по 5 MB — без лимита их base64
    раздул бы ряд в БД до 70+ MB.
    """
    images: dict[str, str] = {}
    total_bytes = 0
    try:
        for rel_id, rel in doc.part.rels.items():
            if "image" not in rel.reltype:
                continue
            image_part = rel.target_part
            blob = image_part.blob
            if total_bytes + len(blob) > _MAX_INLINE_IMAGES_BYTES:
                logger.warning(
                    "Inline images budget exceeded (%d bytes) — "
                    "skipping the rest", _MAX_INLINE_IMAGES_BYTES,
                )
                break
            total_bytes += len(blob)
            b64 = base64.b64encode(blob).decode("ascii")
            images[rel_id] = f"data:{image_part.content_type};base64,{b64}"
    except Exception:
        logger.exception("Failed to extract images from docx")
    return images


_ALIGN_MAP = {
    WD_ALIGN_PARAGRAPH.LEFT: "left",
    WD_ALIGN_PARAGRAPH.CENTER: "center",
    WD_ALIGN_PARAGRAPH.RIGHT: "right",
    WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
}

_RUN_STYLE_TAGS: tuple[tuple[str, str], ...] = (
    ("bold", "strong"),
    ("italic", "em"),
    ("underline", "u"),
)
_RUN_FONT_STYLE_TAGS: tuple[tuple[str, str], ...] = (
    ("strike", "s"),
    ("subscript", "sub"),
    ("superscript", "sup"),
)


def _render_paragraph(para: Paragraph, images: dict[str, str]) -> str:
    inline_html = _render_runs(para.runs)
    img_html = _extract_inline_images(para, images)
    content = inline_html + img_html
    if not content.strip():
        content = "<br>"

    heading_level: int | None = None
    style_name = para.style.name or ""
    heading_match = _HEADING_RE.match(style_name)
    if heading_match:
        level = int(heading_match.group(1))
        if 1 <= level <= 4:
            heading_level = level

    align = _ALIGN_MAP.get(para.alignment)
    style_attr = f' style="text-align: {align}"' if align and align != "left" else ""

    if heading_level:
        return f"<h{heading_level}{style_attr}>{content}</h{heading_level}>"
    return f"<p{style_attr}>{content}</p>"


def _render_runs(runs: list[Run]) -> str:
    """Текст с инлайновыми стилями (bold/italic/color/...)."""
    parts: list[str] = []

    for run in runs:
        text = run.text
        if not text:
            continue
        text = _escape_html(text)

        opens: list[str] = []
        closes: list[str] = []

        for attr, html_tag in _RUN_STYLE_TAGS:
            if getattr(run, attr, None):
                opens.append(f"<{html_tag}>")
                closes.insert(0, f"</{html_tag}>")

        for attr, html_tag in _RUN_FONT_STYLE_TAGS:
            if getattr(run.font, attr, None):
                opens.append(f"<{html_tag}>")
                closes.insert(0, f"</{html_tag}>")

        styles: list[str] = []
        color = _get_run_color(run)
        if color:
            styles.append(f"color: {color}")

        font_family = _safe_font_name(run.font.name)
        if font_family:
            styles.append(f"font-family: {font_family}")

        if run.font.size is not None:
            styles.append(f"font-size: {run.font.size.pt}pt")

        if styles:
            opens.insert(0, f'<span style="{"; ".join(styles)}">')
            closes.append("</span>")

        parts.append("".join(opens) + text + "".join(closes))

    return "".join(parts)


def _get_run_color(run) -> str | None:
    try:
        rgb = run.font.color.rgb if run.font.color else None
        if rgb is not None:
            return _safe_color(str(rgb))
    except Exception:
        pass
    try:
        rpr = run._element.find(qn("w:rPr"))
        if rpr is None:
            return None
        color_el = rpr.find(qn("w:color"))
        if color_el is None:
            return None
        val = color_el.get(qn("w:val"))
        if val and val != "auto":
            return _safe_color(val)
    except Exception:
        pass
    return None


def _extract_inline_images(para: Paragraph, images: dict[str, str]) -> str:
    """Inline-картинки внутри одного параграфа."""
    html_parts: list[str] = []
    try:
        for run_elem in para._element.findall(qn("w:r")):
            for blip in run_elem.findall(f".//{qn('a:blip')}"):
                embed = blip.get(qn("r:embed"))
                if embed and embed in images:
                    html_parts.append(f'<img src="{images[embed]}" />')
    except Exception:
        logger.exception("Failed to extract inline images")
    return "".join(html_parts)


_VALIGN_MAP = {"top": "top", "center": "middle", "bottom": "bottom"}


def _render_table(table: Table, images: dict[str, str]) -> str:
    rows_html: list[str] = ['<table class="editor-table">']

    for row_idx, row in enumerate(table.rows):
        rows_html.append("<tr>")
        tag = "th" if row_idx == 0 else "td"

        for cell in row.cells:
            cell_lines = [
                _render_runs(p.runs) + _extract_inline_images(p, images)
                for p in cell.paragraphs
            ]
            content = "<br>".join(cell_lines) if cell_lines else ""

            styles = _get_cell_styles(cell)
            style_attr = f' style="{styles}"' if styles else ""
            span_attr = _get_cell_span(cell)

            rows_html.append(f"<{tag}{span_attr}{style_attr}>{content}</{tag}>")
        rows_html.append("</tr>")

    rows_html.append("</table>")
    return "".join(rows_html)


def _get_cell_styles(cell) -> str:
    styles: list[str] = []
    try:
        tcPr = cell._element.find(qn("w:tcPr"))
        if tcPr is None:
            return ""

        shd = tcPr.find(qn("w:shd"))
        if shd is not None:
            fill = shd.get(qn("w:fill"))
            color = _safe_color(fill) if fill and fill != "auto" else None
            if color:
                styles.append(f"background-color: {color}")

        borders = tcPr.find(qn("w:tcBorders"))
        if borders is not None:
            for side in ("top", "bottom", "left", "right"):
                border = borders.find(qn(f"w:{side}"))
                if border is None:
                    continue
                val = border.get(qn("w:val"))
                if not val or val in ("none", "nil"):
                    continue
                sz = border.get(qn("w:sz"), "4")
                color_raw = border.get(qn("w:color"), "000000")
                color = _safe_color(color_raw) or "#000000"
                try:
                    px = max(1, int(sz) // 8)
                except ValueError:
                    px = 1
                styles.append(f"border-{side}: {px}px solid {color}")

        vAlign = tcPr.find(qn("w:vAlign"))
        if vAlign is not None:
            mapped = _VALIGN_MAP.get(vAlign.get(qn("w:val"), ""))
            if mapped:
                styles.append(f"vertical-align: {mapped}")
    except Exception:
        logger.exception("Failed to compute cell styles")

    return "; ".join(styles)


def _get_cell_span(cell) -> str:
    try:
        tcPr = cell._element.find(qn("w:tcPr"))
        if tcPr is None:
            return ""
        gridSpan = tcPr.find(qn("w:gridSpan"))
        if gridSpan is None:
            return ""
        val = gridSpan.get(qn("w:val"))
        if val and val.isdigit() and int(val) > 1:
            return f' colspan="{val}"'
    except Exception:
        logger.exception("Failed to compute cell span")
    return ""


# ══════════════════════════════════════════
# Регистрируем парсеры
# ══════════════════════════════════════════
_PARSERS[".txt"] = _parse_txt
_PARSERS[".md"] = _parse_txt
_PARSERS[".docx"] = _parse_docx

if _PDF_AVAILABLE:
    _PARSERS[".pdf"] = _parse_pdf
