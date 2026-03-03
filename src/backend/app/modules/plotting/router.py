"""
Plotting module router — outlines and beats.
All routes require authentication. Mounted at /api/v1.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.modules.identity.models import User
from app.modules.manuscript.service import ManuscriptService
from app.modules.plotting.schemas import (
    BeatCreate,
    BeatRead,
    BeatReorderRequest,
    BeatUpdate,
    OutlineCreate,
    OutlineRead,
    OutlineUpdate,
)
from app.modules.plotting.service import PlottingService

router = APIRouter(tags=["plotting"])


# ---------------------------------------------------------------------------
# Outlines
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/outlines", response_model=list[OutlineRead])
async def list_outlines(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[OutlineRead]:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    outlines = await svc.list_outlines(project_id)
    return [OutlineRead.model_validate(o) for o in outlines]


@router.post(
    "/projects/{project_id}/outlines",
    response_model=OutlineRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_outline(
    project_id: uuid.UUID,
    data: OutlineCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OutlineRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    outline = await svc.create_outline(project_id, data)
    return OutlineRead.model_validate(outline)


@router.patch("/projects/{project_id}/outlines/{outline_id}", response_model=OutlineRead)
async def update_outline(
    project_id: uuid.UUID,
    outline_id: uuid.UUID,
    data: OutlineUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> OutlineRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    outline = await svc.get_outline(outline_id, project_id)
    outline = await svc.update_outline(outline, data)
    return OutlineRead.model_validate(outline)


# ---------------------------------------------------------------------------
# Beats
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{project_id}/outlines/{outline_id}/beats",
    response_model=list[BeatRead],
)
async def list_beats(
    project_id: uuid.UUID,
    outline_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[BeatRead]:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    await svc.get_outline(outline_id, project_id)  # ownership check
    beats = await svc.list_beats(outline_id)
    return [BeatRead.model_validate(b) for b in beats]


@router.post(
    "/projects/{project_id}/outlines/{outline_id}/beats",
    response_model=BeatRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_beat(
    project_id: uuid.UUID,
    outline_id: uuid.UUID,
    data: BeatCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BeatRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    await svc.get_outline(outline_id, project_id)
    beat = await svc.create_beat(outline_id, data)
    return BeatRead.model_validate(beat)


@router.patch("/projects/{project_id}/beats/{beat_id}", response_model=BeatRead)
async def update_beat(
    project_id: uuid.UUID,
    beat_id: uuid.UUID,
    data: BeatUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BeatRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    beat = await svc.get_beat(beat_id)
    beat = await svc.update_beat(beat, data)
    return BeatRead.model_validate(beat)


@router.delete(
    "/projects/{project_id}/beats/{beat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_beat(
    project_id: uuid.UUID,
    beat_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    beat = await svc.get_beat(beat_id)
    await svc.delete_beat(beat)


@router.post(
    "/projects/{project_id}/beats/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reorder_beats(
    project_id: uuid.UUID,
    data: BeatReorderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = PlottingService(db)
    await svc.reorder_beats(data)
