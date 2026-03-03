"""Codex module Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CodexEntryCreate(BaseModel):
    entry_type: str = Field(pattern=r"^(character|location|item|lore|custom)$")
    name: str = Field(min_length=1, max_length=500)
    summary: str | None = None
    content: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    image_url: str | None = None


class CodexEntryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=500)
    summary: str | None = None
    content: dict[str, Any] | None = None
    tags: list[str] | None = None
    image_url: str | None = None


class CodexEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    entry_type: str
    name: str
    summary: str | None
    content: dict[str, Any]
    tags: list[str]
    image_url: str | None
    created_at: datetime
    updated_at: datetime


class CodexLinkCreate(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID
    link_type: str = Field(
        pattern=r"^(related|parent_of|ally|enemy|custom)$"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class CodexLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    source_id: uuid.UUID
    target_id: uuid.UUID
    link_type: str
    metadata: dict[str, Any] = Field(alias="metadata_")


class CodexLinksResponse(BaseModel):
    outgoing: list[CodexLinkRead]
    incoming: list[CodexLinkRead]


class CodexMentionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    binder_node_id: uuid.UUID
    codex_entry_id: uuid.UUID


class SyncMentionsRequest(BaseModel):
    entry_ids: list[uuid.UUID]


class ImageUploadResponse(BaseModel):
    image_url: str
