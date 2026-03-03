"""Plotting module Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class OutlineCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    template_type: str = Field(
        pattern=r"^(three_act|save_the_cat|heros_journey|custom)$"
    )
    structure: dict[str, Any] = Field(default_factory=dict)


class OutlineUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    structure: dict[str, Any] | None = None


class OutlineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    template_type: str
    structure: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class BeatCreate(BaseModel):
    label: str = Field(min_length=1, max_length=500)
    description: str | None = None
    act: int | None = None
    sort_order: int = 0
    binder_node_id: uuid.UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class BeatUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    act: int | None = None
    sort_order: int | None = None
    binder_node_id: uuid.UUID | None = None
    metadata: dict[str, Any] | None = None


class BeatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    outline_id: uuid.UUID
    binder_node_id: uuid.UUID | None
    label: str
    description: str | None
    act: int | None
    sort_order: int
    metadata: dict[str, Any] = Field(alias="metadata_")
    created_at: datetime
    updated_at: datetime


class BeatReorderItem(BaseModel):
    beat_id: uuid.UUID
    sort_order: int


class BeatReorderRequest(BaseModel):
    items: list[BeatReorderItem]
