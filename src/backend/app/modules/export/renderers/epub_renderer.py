"""ePub renderer using ebooklib.

Converts ProseMirror JSON → XHTML chapters → ePub 3 file.
"""

import io
import uuid

from ebooklib import epub  # type: ignore[import-untyped]

from app.modules.export.renderers.base import BaseRenderer, RendererNode
from app.modules.export.renderers.utils import prosemirror_to_html


_EPUB_CSS = """
body {
    font-family: Arial, sans-serif;
    font-size: 1em;
    line-height: 1.5;
    margin: 0;
    padding: 0.5em 1em;
}
p {
    margin: 0 0 0.5em 0;
    text-indent: 1.5em;
}
p:first-of-type {
    text-indent: 0;
}
h1, h2, h3, h4, h5, h6 {
    line-height: 1.2;
    margin-top: 1em;
    margin-bottom: 0.5em;
}
h1 {
    text-align: center;
    margin-top: 2em;
}
.scene-sep {
    text-align: center;
    margin: 1em 0;
}
blockquote {
    margin-left: 1.5em;
    margin-right: 1.5em;
    font-style: italic;
}
pre, code {
    font-family: monospace;
    font-size: 0.9em;
}
table {
    border-collapse: collapse;
    width: 100%;
}
td, th {
    border: 1px solid #ccc;
    padding: 4px 8px;
}
img {
    max-width: 100%;
    height: auto;
}
"""


class EpubRenderer(BaseRenderer):
    def render(
        self,
        nodes: list[RendererNode],
        template_config: dict,
        project_title: str,
    ) -> bytes:
        book = epub.EpubBook()
        book.set_identifier(str(uuid.uuid4()))
        book.set_title(project_title)
        book.set_language("en")

        # Default stylesheet
        style = epub.EpubItem(
            uid="style_main",
            file_name="style/main.css",
            media_type="text/css",
            content=self._build_css(template_config).encode("utf-8"),
        )
        book.add_item(style)

        chapters: list[epub.EpubHtml] = []
        toc: list[epub.Link] = []

        # Group nodes into "chapters" (each chapter/folder/front_matter starts a new file)
        current_chapter: epub.EpubHtml | None = None
        current_parts: list[str] = []
        chapter_idx = 0
        scene_sep = template_config.get("scene_separator", "* * *")

        def flush_chapter() -> None:
            nonlocal current_chapter, current_parts
            if current_chapter is not None:
                current_chapter.content = _wrap_xhtml(
                    current_chapter.title, "\n".join(current_parts), style.file_name
                ).encode("utf-8")
                book.add_item(current_chapter)
                chapters.append(current_chapter)
                current_chapter = None
                current_parts = []

        first_scene = True

        for node in nodes:
            is_container = node.node_type in ("folder", "chapter", "front_matter", "back_matter")

            if is_container:
                flush_chapter()
                chapter_idx += 1
                first_scene = True
                file_name = f"chapter_{chapter_idx:03d}.xhtml"
                current_chapter = epub.EpubHtml(
                    title=node.title,
                    file_name=file_name,
                    lang="en",
                )
                current_chapter.add_item(style)
                current_parts = [f"<h1>{_esc(node.title)}</h1>"]
                toc.append(epub.Link(file_name, node.title, f"chapter_{chapter_idx}"))

            elif node.node_type == "scene":
                if current_chapter is None:
                    # Orphaned scene — create a chapter for it
                    chapter_idx += 1
                    file_name = f"chapter_{chapter_idx:03d}.xhtml"
                    current_chapter = epub.EpubHtml(
                        title=node.title,
                        file_name=file_name,
                        lang="en",
                    )
                    current_chapter.add_item(style)
                    current_parts = []
                    toc.append(epub.Link(file_name, node.title, f"chapter_{chapter_idx}"))

                if not first_scene:
                    current_parts.append(f'<p class="scene-sep">{_esc(scene_sep)}</p>')
                first_scene = False

            if node.content and current_chapter is not None:
                current_parts.append(prosemirror_to_html(node.content))
            elif node.content and current_chapter is None:
                # Top-level scenes with no parent chapter
                pass

        flush_chapter()

        # If no chapters were created (empty manuscript), add a placeholder
        if not chapters:
            placeholder = epub.EpubHtml(
                title=project_title,
                file_name="chapter_001.xhtml",
                lang="en",
            )
            placeholder.content = _wrap_xhtml(project_title, "<p>(Empty manuscript)</p>", style.file_name).encode("utf-8")
            book.add_item(placeholder)
            chapters.append(placeholder)
            toc.append(epub.Link("chapter_001.xhtml", project_title, "chapter_1"))

        book.toc = tuple(toc)  # type: ignore[assignment]
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav", *chapters]

        buf = io.BytesIO()
        epub.write_epub(buf, book, {})
        buf.seek(0)
        return buf.read()

    def _build_css(self, config: dict) -> str:
        font = config.get("font_family", "Arial")
        size = config.get("font_size", 12)
        spacing = config.get("line_spacing", 1.5)
        return f"""
body {{
    font-family: "{font}", sans-serif;
    font-size: {size}pt;
    line-height: {spacing};
}}
""" + _EPUB_CSS


def _wrap_xhtml(title: str, body: str, css_path: str) -> str:
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{_esc(title)}</title>
  <link rel="stylesheet" href="../{css_path}" type="text/css"/>
</head>
<body>
{body}
</body>
</html>"""


def _esc(text: str) -> str:
    from html import escape
    return escape(text)
