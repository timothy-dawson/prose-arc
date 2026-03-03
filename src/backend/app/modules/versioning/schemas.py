"""
Versioning module Pydantic schemas.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SnapshotCreate(BaseModel):
    binder_node_id: uuid.UUID | None = None
    name: str | None = None


class SnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    binder_node_id: uuid.UUID | None
    name: str | None
    snapshot_type: str
    word_count: int
    is_keyframe: bool
    created_at: datetime


class SnapshotDiffResponse(BaseModel):
    snapshot_id: uuid.UUID
    compare_to_id: uuid.UUID | None  # None = current document
    additions: list[str]
    deletions: list[str]
    changes_count: int


class SnapshotRestoreResponse(BaseModel):
    restored_snapshot_id: uuid.UUID
    word_count: int
    pre_restore_snapshot_id: uuid.UUID | None
