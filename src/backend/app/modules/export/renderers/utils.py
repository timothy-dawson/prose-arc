"""ProseMirror JSON → HTML converter.

Handles all TipTap StarterKit node types plus the custom extensions used
by Prose Arc (TextStyle, Color, Highlight, Subscript, Superscript, Image,
TableKit, CodexMention).
"""

from html import escape


def prosemirror_to_html(node: dict) -> str:
    """Recursively convert a ProseMirror node tree to an HTML string."""
    node_type = node.get("type", "")
    content: list[dict] = node.get("content", [])
    attrs: dict = node.get("attrs", {})

    inner = "".join(prosemirror_to_html(child) for child in content)

    match node_type:
        case "doc":
            return inner

        case "paragraph":
            align = attrs.get("textAlign", "left")
            style = f' style="text-align: {align}"' if align and align != "left" else ""
            # Empty paragraphs need a non-breaking space so they render with height
            return f"<p{style}>{inner or '&nbsp;'}</p>"

        case "heading":
            level = attrs.get("level", 1)
            align = attrs.get("textAlign", "left")
            style = f' style="text-align: {align}"' if align and align != "left" else ""
            return f"<h{level}{style}>{inner}</h{level}>"

        case "bulletList":
            return f"<ul>{inner}</ul>"

        case "orderedList":
            start = attrs.get("start", 1)
            start_attr = f' start="{start}"' if start != 1 else ""
            return f"<ol{start_attr}>{inner}</ol>"

        case "listItem":
            return f"<li>{inner}</li>"

        case "blockquote":
            return f"<blockquote>{inner}</blockquote>"

        case "codeBlock":
            lang = attrs.get("language", "")
            lang_attr = f' class="language-{escape(lang)}"' if lang else ""
            return f"<pre><code{lang_attr}>{inner}</code></pre>"

        case "hardBreak":
            return "<br>"

        case "horizontalRule":
            return "<hr>"

        case "image":
            src = escape(attrs.get("src") or "", quote=True)
            alt = escape(attrs.get("alt") or "")
            title = attrs.get("title") or ""
            title_attr = f' title="{escape(title)}"' if title else ""
            return f'<img src="{src}" alt="{alt}"{title_attr}>'

        case "table":
            return f'<table style="border-collapse: collapse; width: 100%">{inner}</table>'

        case "tableRow":
            return f"<tr>{inner}</tr>"

        case "tableCell":
            return _table_cell_html("td", attrs, inner)

        case "tableHeader":
            return _table_cell_html("th", attrs, inner)

        case "text":
            text = escape(node.get("text", ""))
            marks: list[dict] = node.get("marks", [])
            # Apply marks inside-out so outermost mark wraps everything
            for mark in marks:
                text = _apply_mark(mark, text)
            return text

        case _:
            # Unknown node — render children so content is not silently dropped
            return inner


def _table_cell_html(tag: str, attrs: dict, inner: str) -> str:
    colspan = attrs.get("colspan", 1)
    rowspan = attrs.get("rowspan", 1)
    parts: list[str] = []
    if colspan and colspan > 1:
        parts.append(f'colspan="{colspan}"')
    if rowspan and rowspan > 1:
        parts.append(f'rowspan="{rowspan}"')
    bg = attrs.get("backgroundColor")
    style_attr = f' style="background-color: {escape(bg)}"' if bg else ""
    attrs_str = (" " + " ".join(parts)) if parts else ""
    return f"<{tag}{attrs_str}{style_attr}>{inner}</{tag}>"


def _apply_mark(mark: dict, text: str) -> str:
    mark_type = mark.get("type", "")
    attrs: dict = mark.get("attrs", {})

    match mark_type:
        case "bold":
            return f"<strong>{text}</strong>"
        case "italic":
            return f"<em>{text}</em>"
        case "underline":
            return f"<u>{text}</u>"
        case "strike":
            return f"<s>{text}</s>"
        case "code":
            return f"<code>{text}</code>"
        case "subscript":
            return f"<sub>{text}</sub>"
        case "superscript":
            return f"<sup>{text}</sup>"
        case "link":
            href = escape(attrs.get("href", "#"), quote=True)
            target = escape(attrs.get("target", "_blank"), quote=True)
            return f'<a href="{href}" target="{target}">{text}</a>'
        case "textStyle":
            styles: list[str] = []
            if color := attrs.get("color"):
                styles.append(f"color: {escape(color)}")
            if font_size := attrs.get("fontSize"):
                styles.append(f"font-size: {escape(str(font_size))}")
            if font_family := attrs.get("fontFamily"):
                styles.append(f"font-family: {escape(font_family)}")
            return f'<span style="{"; ".join(styles)}">{text}</span>' if styles else text
        case "highlight":
            color = attrs.get("color", "yellow")
            return f'<mark style="background-color: {escape(color)}">{text}</mark>'
        case "codexMention":
            # Render codex mentions as a styled span
            return f'<span class="codex-mention">{text}</span>'
        case _:
            return text
