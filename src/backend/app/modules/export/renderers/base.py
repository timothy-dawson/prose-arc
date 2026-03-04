"""Abstract base class for all export renderers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RendererNode:
    """A binder node with its document content, ready for rendering."""

    id: str
    node_type: str  # folder | chapter | scene | front_matter | back_matter
    title: str
    depth: int
    content: dict | None  # ProseMirror JSON, or None if no document exists


class BaseRenderer(ABC):
    """
    Converts an ordered list of binder nodes (with document content) into a
    binary document in a specific format.

    Renderers are stateless; a new instance may be created per job.
    """

    @abstractmethod
    def render(
        self,
        nodes: list[RendererNode],
        template_config: dict,
        project_title: str,
    ) -> bytes:
        """
        Render the manuscript to bytes.

        Args:
            nodes: Binder nodes in depth-first reading order.
            template_config: Styling parameters from ExportTemplate.config.
            project_title: Title of the project (used in headers/metadata).

        Returns:
            Raw file bytes for the rendered document.
        """
        ...
