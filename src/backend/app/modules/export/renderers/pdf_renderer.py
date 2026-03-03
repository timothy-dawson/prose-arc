"""PDF renderer using WeasyPrint.

Converts ProseMirror JSON → HTML → PDF via WeasyPrint. Applies template
styles through a generated CSS block.
"""

from app.modules.export.renderers.base import BaseRenderer, RendererNode
from app.modules.export.renderers.utils import prosemirror_to_html


_PAGE_SIZES = {
    # (width, height) in inches
    "letter": (8.5, 11),
    "a4": (8.27, 11.69),
}


class PdfRenderer(BaseRenderer):
    def render(
        self,
        nodes: list[RendererNode],
        template_config: dict,
        project_title: str,
    ) -> bytes:
        html = self._build_html(nodes, template_config, project_title)
        from weasyprint import HTML  # type: ignore[import-untyped]

        return HTML(string=html).write_pdf()  # type: ignore[no-any-return]

    def _build_html(
        self, nodes: list[RendererNode], config: dict, project_title: str
    ) -> str:
        css = self._build_css(config)
        body_parts: list[str] = []

        first = True
        for node in nodes:
            if node.node_type == "folder":
                if not first:
                    body_parts.append('<div class="page-break"></div>')
                body_parts.append(f"<h1 class='folder-title'>{_esc(node.title)}</h1>")
                first = False
                continue

            if node.node_type == "chapter":
                if not first and config.get("chapter_break", True):
                    body_parts.append('<div class="page-break"></div>')
                body_parts.append(f"<h1 class='chapter-title'>{_esc(node.title)}</h1>")
                first = False
            elif node.node_type == "scene":
                if not first:
                    sep = _esc(config.get("scene_separator", "* * *"))
                    body_parts.append(f'<p class="scene-sep">{sep}</p>')
                first = False
            elif node.node_type in ("front_matter", "back_matter"):
                if not first:
                    body_parts.append('<div class="page-break"></div>')
                body_parts.append(f"<h1>{_esc(node.title)}</h1>")
                first = False

            if node.content:
                body_parts.append(prosemirror_to_html(node.content))

        body = "\n".join(body_parts)
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{_esc(project_title)}</title>
<style>
{css}
</style>
</head>
<body>
{body}
</body>
</html>"""

    def _build_css(self, config: dict) -> str:
        font = config.get("font_family", "Georgia")
        size = config.get("font_size", 11)
        spacing = config.get("line_spacing", 1.5)
        mt = config.get("margin_top", 0.75)
        mb = config.get("margin_bottom", 0.75)
        ml = config.get("margin_left", 0.75)
        mr = config.get("margin_right", 0.75)
        page_numbers = config.get("page_numbers", True)
        header_text = config.get("header_text", "")

        counter_css = """
@page {
    margin: """ + f"{mt}in {mr}in {mb}in {ml}in" + """;
    """ + (f"""
    @top-center {{
        content: "{header_text}";
        font-family: {font};
        font-size: {size}pt;
    }}""" if header_text else "") + ("""
    @bottom-right {
        content: counter(page);
        font-family: """ + font + """;
        font-size: """ + str(size) + """pt;
    }""" if page_numbers else "") + """
}"""

        return counter_css + f"""
body {{
    font-family: "{font}", serif;
    font-size: {size}pt;
    line-height: {spacing};
    color: #000;
}}
p {{
    margin: 0 0 0.5em 0;
    text-indent: 1.5em;
}}
p:first-child, .chapter-title + p, .folder-title + p {{
    text-indent: 0;
}}
h1, h2, h3, h4, h5, h6 {{
    font-family: "{font}", serif;
    line-height: 1.2;
    margin-top: 1em;
    margin-bottom: 0.5em;
}}
h1.chapter-title, h1.folder-title {{
    text-align: center;
    margin-top: 2em;
    page-break-before: auto;
}}
.page-break {{
    page-break-after: always;
}}
.scene-sep {{
    text-align: center;
    margin: 1em 0;
    text-indent: 0;
}}
blockquote {{
    margin-left: 2em;
    margin-right: 2em;
    font-style: italic;
}}
pre, code {{
    font-family: "Courier New", monospace;
    font-size: {size - 1}pt;
}}
table {{
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
}}
td, th {{
    border: 1px solid #ccc;
    padding: 4px 8px;
}}
img {{
    max-width: 100%;
    height: auto;
}}
"""


def _esc(text: str) -> str:
    from html import escape
    return escape(text)
