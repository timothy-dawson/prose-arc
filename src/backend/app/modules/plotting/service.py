"""
Plotting service — business logic for outlines and beats.
"""

import uuid

import structlog
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.plotting.models import Beat, Outline
from app.modules.plotting.schemas import (
    BeatCreate,
    BeatReorderRequest,
    BeatUpdate,
    OutlineCreate,
    OutlineUpdate,
)

logger = structlog.get_logger(__name__)


class PlottingService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Outlines
    # -------------------------------------------------------------------------

    async def create_outline(self, project_id: uuid.UUID, data: OutlineCreate) -> Outline:
        outline = Outline(
            project_id=project_id,
            title=data.title,
            template_type=data.template_type,
            structure=data.structure,
        )
        self._db.add(outline)
        await self._db.flush()
        logger.info("outline_created", outline_id=str(outline.id))
        return outline

    async def list_outlines(self, project_id: uuid.UUID) -> list[Outline]:
        result = await self._db.execute(
            select(Outline)
            .where(Outline.project_id == project_id)
            .order_by(Outline.created_at)
        )
        return list(result.scalars().all())

    async def get_outline(self, outline_id: uuid.UUID, project_id: uuid.UUID) -> Outline:
        outline = await self._db.get(Outline, outline_id)
        if not outline or outline.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outline not found")
        return outline

    async def update_outline(self, outline: Outline, data: OutlineUpdate) -> Outline:
        if data.title is not None:
            outline.title = data.title
        if data.structure is not None:
            outline.structure = data.structure
        await self._db.flush()
        await self._db.refresh(outline)
        return outline

    # -------------------------------------------------------------------------
    # Beats
    # -------------------------------------------------------------------------

    async def create_beat(self, outline_id: uuid.UUID, data: BeatCreate) -> Beat:
        beat = Beat(
            outline_id=outline_id,
            label=data.label,
            description=data.description,
            act=data.act,
            sort_order=data.sort_order,
            binder_node_id=data.binder_node_id,
            metadata_=data.metadata,
        )
        self._db.add(beat)
        await self._db.flush()
        return beat

    async def list_beats(self, outline_id: uuid.UUID) -> list[Beat]:
        result = await self._db.execute(
            select(Beat)
            .where(Beat.outline_id == outline_id)
            .order_by(Beat.act.nulls_last(), Beat.sort_order)
        )
        return list(result.scalars().all())

    async def get_beat(self, beat_id: uuid.UUID) -> Beat:
        beat = await self._db.get(Beat, beat_id)
        if not beat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Beat not found")
        return beat

    async def update_beat(self, beat: Beat, data: BeatUpdate) -> Beat:
        if data.label is not None:
            beat.label = data.label
        if data.description is not None:
            beat.description = data.description
        if data.act is not None:
            beat.act = data.act
        if data.sort_order is not None:
            beat.sort_order = data.sort_order
        if data.binder_node_id is not None:
            beat.binder_node_id = data.binder_node_id
        if data.metadata is not None:
            beat.metadata_ = data.metadata
        await self._db.flush()
        await self._db.refresh(beat)
        return beat

    async def delete_beat(self, beat: Beat) -> None:
        await self._db.delete(beat)
        await self._db.flush()

    async def reorder_beats(self, data: BeatReorderRequest) -> None:
        for item in data.items:
            await self._db.execute(
                update(Beat)
                .where(Beat.id == item.beat_id)
                .values(sort_order=item.sort_order)
            )
        await self._db.flush()

    async def link_beat_to_node(
        self, beat: Beat, binder_node_id: uuid.UUID | None
    ) -> Beat:
        beat.binder_node_id = binder_node_id
        await self._db.flush()
        await self._db.refresh(beat)
        return beat
