from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
import base64


def extract_text_from_file(file_path: str) -> str | None:
    path = Path(file_path)
    ext = path.suffix.lower()

    try:
        if ext in (".txt", ".md", ".rtf"):
            return _parse_txt(path)
        elif ext == ".pdf":
            return _parse_pdf(path)
        elif ext == ".docx":
            return _parse_docx(path)
        else:
            return None
    except Exception as e:
        print(f"[file_parser] Ошибка парсинга {file_path}: {e}")
        return None


def _parse_txt(path: Path) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f"<p>{f.read()}</p>"


def _parse_pdf(path: Path) -> str:
    try:
        import fitz
    except ImportError:
        print("[file_parser] Установи: pip install PyMuPDF")
        return ""

    text_parts = []
    with fitz.open(str(path)) as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "".join(f"<p>{line}</p>" for line in "\n".join(text_parts).split("\n") if line.strip())


def _parse_docx(path: Path) -> str:
    doc = Document(str(path))
    html_parts = []

    # Парсим картинки из docx в base64
    images = _extract_images(doc)

    for element in doc.element.body:
        tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag

        if tag == "p":
            para = _find_paragraph(doc, element)
            if para is not None:
                html_parts.append(_render_paragraph(para, images))

        elif tag == "tbl":
            table = _find_table(doc, element)
            if table is not None:
                html_parts.append(_render_table(table, images))

    return "\n".join(html_parts)


def _find_paragraph(doc, element):
    for para in doc.paragraphs:
        if para._element is element:
            return para
    return None


def _find_table(doc, element):
    for table in doc.tables:
        if table._element is element:
            return table
    return None


def _extract_images(doc) -> dict:
    """Извлекает картинки из docx, возвращает {rId: base64_data_url}"""
    images = {}
    try:
        for rel_id, rel in doc.part.rels.items():
            if "image" in rel.reltype:
                image_part = rel.target_part
                content_type = image_part.content_type
                image_data = image_part.blob
                b64 = base64.b64encode(image_data).decode("utf-8")
                images[rel_id] = f"data:{content_type};base64,{b64}"
    except Exception:
        pass
    return images


# ── Paragraph ──

def _render_paragraph(para, images) -> str:
    # Проверяем есть ли картинка в параграфе
    img_html = _extract_inline_images(para, images)

    style_name = (para.style.name or "").lower()

    # Heading
    heading_level = None
    if style_name.startswith("heading"):
        try:
            heading_level = int(style_name.replace("heading", "").strip())
            if heading_level > 4:
                heading_level = None
        except ValueError:
            heading_level = None

    # Alignment
    align = _get_alignment(para)

    # Собираем inline content
    inline_html = _render_runs(para.runs)
    content = inline_html + img_html

    if not content.strip():
        content = "<br>"

    # Атрибуты
    attrs = ""
    if align and align != "left":
        attrs = f' style="text-align: {align}"'

    if heading_level:
        return f"<h{heading_level}{attrs}>{content}</h{heading_level}>"
    else:
        return f"<p{attrs}>{content}</p>"


def _get_alignment(para) -> str | None:
    alignment = para.alignment
    if alignment is None:
        return None
    mapping = {
        WD_ALIGN_PARAGRAPH.LEFT: "left",
        WD_ALIGN_PARAGRAPH.CENTER: "center",
        WD_ALIGN_PARAGRAPH.RIGHT: "right",
        WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
    }
    return mapping.get(alignment)


def _render_runs(runs) -> str:
    parts = []
    for run in runs:
        text = run.text
        if not text:
            continue

        text = _escape_html(text)

        # Собираем стили
        styles = []
        tags_open = []
        tags_close = []

        # Bold
        if run.bold:
            tags_open.append("<strong>")
            tags_close.insert(0, "</strong>")

        # Italic
        if run.italic:
            tags_open.append("<em>")
            tags_close.insert(0, "</em>")

        # Underline
        if run.underline:
            tags_open.append("<u>")
            tags_close.insert(0, "</u>")

        # Strike
        if run.font.strike:
            tags_open.append("<s>")
            tags_close.insert(0, "</s>")

        # Subscript
        if run.font.subscript:
            tags_open.append("<sub>")
            tags_close.insert(0, "</sub>")

        # Superscript
        if run.font.superscript:
            tags_open.append("<sup>")
            tags_close.insert(0, "</sup>")

        # Color & Font — через <span style="...">
        color = _get_run_color(run)
        font_family = run.font.name
        font_size = run.font.size

        if color:
            styles.append(f"color: {color}")
        if font_family:
            styles.append(f"font-family: {font_family}")
        if font_size:
            size_pt = font_size.pt
            styles.append(f"font-size: {size_pt}pt")

        if styles:
            style_str = "; ".join(styles)
            tags_open.insert(0, f'<span style="{style_str}">')
            tags_close.append("</span>")

        parts.append("".join(tags_open) + text + "".join(tags_close))

    return "".join(parts)


def _get_run_color(run) -> str | None:
    try:
        color = run.font.color
        if color and color.rgb:
            return f"#{color.rgb}"
    except Exception:
        pass

    # Fallback: проверяем XML напрямую
    try:
        rpr = run._element.find(qn("w:rPr"))
        if rpr is not None:
            color_el = rpr.find(qn("w:color"))
            if color_el is not None:
                val = color_el.get(qn("w:val"))
                if val and val != "auto":
                    return f"#{val}"
    except Exception:
        pass

    return None


def _extract_inline_images(para, images) -> str:
    """Ищет inline картинки в параграфе"""
    html = ""
    try:
        for run_elem in para._element.findall(qn("w:r")):
            drawings = run_elem.findall(f".//{qn('w:drawing')}")
            for drawing in drawings:
                blips = drawing.findall(f".//{qn('a:blip')}")
                for blip in blips:
                    embed = blip.get(qn("r:embed"))
                    if embed and embed in images:
                        html += f'<img src="{images[embed]}" />'
    except Exception:
        pass
    return html


# ── Table ──

def _render_table(table, images) -> str:
    html = '<table class="editor-table">'

    for i, row in enumerate(table.rows):
        html += "<tr>"
        for cell in row.cells:
            tag = "th" if i == 0 else "td"

            # Собираем содержимое ячейки
            cell_content = []
            for para in cell.paragraphs:
                inline = _render_runs(para.runs)
                img = _extract_inline_images(para, images)
                cell_content.append(inline + img)

            content = "<br>".join(cell_content) if cell_content else ""

            # Стили ячейки
            cell_styles = _get_cell_styles(cell)
            style_attr = f' style="{cell_styles}"' if cell_styles else ""

            # Colspan/rowspan
            span_attrs = _get_cell_span(cell)

            html += f"<{tag}{span_attrs}{style_attr}>{content}</{tag}>"
        html += "</tr>"

    html += "</table>"
    return html


def _get_cell_styles(cell) -> str:
    styles = []

    try:
        tc = cell._element
        tcPr = tc.find(qn("w:tcPr"))
        if tcPr is not None:
            # Background color
            shd = tcPr.find(qn("w:shd"))
            if shd is not None:
                fill = shd.get(qn("w:fill"))
                if fill and fill != "auto":
                    styles.append(f"background-color: #{fill}")

            # Borders
            borders = tcPr.find(qn("w:tcBorders"))
            if borders is not None:
                for side in ["top", "bottom", "left", "right"]:
                    border = borders.find(qn(f"w:{side}"))
                    if border is not None:
                        val = border.get(qn("w:val"))
                        if val and val != "none" and val != "nil":
                            sz = border.get(qn("w:sz"), "4")
                            color = border.get(qn("w:color"), "000000")
                            px = max(1, int(sz) // 8)
                            styles.append(f"border-{side}: {px}px solid #{color}")

            # Vertical align
            vAlign = tcPr.find(qn("w:vAlign"))
            if vAlign is not None:
                val = vAlign.get(qn("w:val"))
                mapping = {"top": "top", "center": "middle", "bottom": "bottom"}
                if val in mapping:
                    styles.append(f"vertical-align: {mapping[val]}")
    except Exception:
        pass

    return "; ".join(styles)


def _get_cell_span(cell) -> str:
    attrs = ""
    try:
        tc = cell._element
        tcPr = tc.find(qn("w:tcPr"))
        if tcPr is not None:
            gridSpan = tcPr.find(qn("w:gridSpan"))
            if gridSpan is not None:
                val = gridSpan.get(qn("w:val"))
                if val and int(val) > 1:
                    attrs += f' colspan="{val}"'
    except Exception:
        pass
    return attrs


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )