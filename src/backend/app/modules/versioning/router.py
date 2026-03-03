"""
Versioning module router — snapshot CRUD, restore, and diff endpoints.

Event bus subscription: listens for 'document.saved' to auto-create snapshots.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.core.events import bus
from app.modules.identity.models import User
from app.modules.manuscript.service import ManuscriptService
from app.modules.versioning.schemas import (
    SnapshotCreate,
    SnapshotDiffResponse,
    SnapshotRead,
    SnapshotRestoreResponse,
)
from app.modules.versioning.service import VersioningService

router = APIRouter(tags=["versioning"])


# ---------------------------------------------------------------------------
# Event bus subscription — auto-snapshot on document.saved
# ---------------------------------------------------------------------------


def _on_document_saved(data: dict) -> None:  # type: ignore[type-arg]
    """Enqueue an auto-snapshot Celery task when a document is saved."""
    from app.tasks.versioning_tasks import create_auto_snapshot

    create_auto_snapshot.delay(data["project_id"], data["node_id"])


bus.subscribe("document.saved", _on_document_saved)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{project_id}/documents/{node_id}/history",
    response_model=list[SnapshotRead],
)
async def get_document_history(
    project_id: uuid.UUID,
    node_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[SnapshotRead]:
    msc = ManuscriptService(db)
    await msc.get_project(project_id, current_user.id)
    svc = VersioningService(db)
    snapshots = await svc.list_snapshots(project_id, binder_node_id=node_id, limit=limit)
    return [SnapshotRead.model_validate(s) for s in snapshots]


@router.get(
    "/projects/{project_id}/snapshots",
    response_model=list[SnapshotRead],
)
async def list_snapshots(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    binder_node_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[SnapshotRead]:
    msc = ManuscriptService(db)
    await msc.get_project(project_id, current_user.id)
    svc = VersioningService(db)
    snapshots = await svc.list_snapshots(
        project_id, binder_node_id=binder_node_id, limit=limit, offset=offset
    )
    return [SnapshotRead.model_validate(s) for s in snapshots]


@router.post(
    "/projects/{project_id}/snapshots",
    response_model=SnapshotRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_snapshot(
    project_id: uuid.UUID,
    data: SnapshotCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SnapshotRead:
    msc = ManuscriptService(db)
    await msc.get_project(project_id, current_user.id)
    svc = VersioningService(db)
    if data.binder_node_id is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="binder_node_id is required for manual snapshots.",
        )
    snapshot = await svc.create_snapshot(
        project_id=project_id,
        binder_node_id=data.binder_node_id,
        snapshot_type="manual",
        name=data.name,
    )
    if snapshot is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not create snapshot — document has no content.",
        )
    return SnapshotRead.model_validate(snapshot)


@router.get(
    "/projects/{project_id}/snapshots/{snapshot_id}",
    response_model=SnapshotRead,
)
async def get_snapshot(
    project_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SnapshotRead:
    msc = ManuscriptService(db)
    await msc.get_project(project_id, current_user.id)
    svc = VersioningService(db)
    snap = await svc.get_project_snapshot(project_id, snapshot_id)
    return SnapshotRead.model_validate(snap)


@router.get(
    "/projects/{project_id}/snapshots/{snapshot_id}/diff",
    response_model=SnapshotDiffResponse,
)
async def diff_snapshot(
    project_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    compare_to: uuid.UUID | None = Query(default=None),
) -> SnapshotDiffResponse:
    msc = ManuscriptService(db)
    await msc.get_project(project_id, current_user.id)
    svc = VersioningService(db)
    return await svc.diff_snapshot(project_id, snapshot_id, compare_to_id=compare_to)


@router.post(
    "/projects/{project_id}/snapshots/{snapshot_id}/restore",
    response_model=SnapshotRestoreResponse,
)
async def restore_snapshot(
    project_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SnapshotRestoreResponse:
    msc = ManuscriptService(db)
    await msc.get_project(project_id, current_user.id)
    svc = VersioningService(db)
    return await svc.restore_snapshot(project_id, snapshot_id)


@router.delete(
    "/projects/{project_id}/snapshots/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_snapshot(
    project_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    msc = ManuscriptService(db)
    await msc.get_project(project_id, current_user.id)
    svc = VersioningService(db)
    await svc.delete_snapshot(project_id, snapshot_id)
