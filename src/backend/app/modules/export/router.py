"""Export API router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.modules.export.schemas import ExportCreate, ExportJobResponse, ExportTemplateResponse
from app.modules.export.service import ExportService
from app.modules.identity.models import User
from app.modules.manuscript.service import ManuscriptService

router = APIRouter(tags=["export"])


@router.get("/export/templates", response_model=list[ExportTemplateResponse])
async def list_templates(
    format: Annotated[str | None, Query(description="Filter by format: docx, pdf, epub")] = None,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[ExportTemplateResponse]:
    svc = ExportService(db)
    return await svc.list_templates(format=format)


@router.post("/projects/{project_id}/export", response_model=ExportJobResponse, status_code=202)
async def create_export_job(
    project_id: uuid.UUID,
    data: ExportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportJobResponse:
    # Verify user owns the project
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = ExportService(db)
    return await svc.create_job(project_id, current_user.id, data)


@router.get("/projects/{project_id}/export", response_model=list[ExportJobResponse])
async def list_export_jobs(
    project_id: uuid.UUID,
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ExportJobResponse]:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = ExportService(db)
    return await svc.list_jobs(project_id, current_user.id, limit=limit, offset=offset)


@router.get("/projects/{project_id}/export/{job_id}", response_model=ExportJobResponse)
async def get_export_job(
    project_id: uuid.UUID,
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportJobResponse:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = ExportService(db)
    return await svc.get_job(job_id, current_user.id)
