"""
Manuscript module Pydantic schemas — request/response models.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.manuscript.models import NodeType


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    settings: dict[str, Any] = Field(default_factory=dict)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    word_count: int
    settings: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    settings: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Binder nodes
# ---------------------------------------------------------------------------


class BinderNodeCreate(BaseModel):
    node_type: NodeType
    title: str = Field(min_length=1, max_length=500)
    parent_id: uuid.UUID | None = None
    sort_order: int = 0


class BinderNodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    parent_id: uuid.UUID | None
    node_type: NodeType
    title: str
    sort_order: int
    synopsis: str | None
    metadata_: dict[str, Any] = Field(alias="metadata_")
    word_count: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class BinderNodeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    synopsis: str | None = None
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")
    parent_id: uuid.UUID | None = None
    sort_order: int | None = None

    model_config = ConfigDict(populate_by_name=True)


class BinderReorderItem(BaseModel):
    node_id: uuid.UUID
    parent_id: uuid.UUID | None
    sort_order: int


class BinderReorderRequest(BaseModel):
    nodes: list[BinderReorderItem]


class BinderTreeResponse(BaseModel):
    nodes: list[BinderNodeRead]


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class DocumentSave(BaseModel):
    content: dict[str, Any]  # ProseMirror document JSON
    byte_size: int = Field(ge=0)


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    binder_node_id: uuid.UUID
    content: dict[str, Any]
    byte_size: int
    updated_at: datetime


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


class SearchResult(BaseModel):
    node_id: uuid.UUID
    title: str
    snippet: str
    node_type: NodeType


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
