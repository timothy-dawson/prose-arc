"""Export service — manages export jobs and delegates rendering to Celery."""

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import get_storage
from app.modules.export.models import ExportJob, ExportTemplate
from app.modules.export.schemas import ExportCreate, ExportJobResponse, ExportTemplateResponse

logger = structlog.get_logger(__name__)

_EXPORT_EXPIRY_DAYS = 7
_DOWNLOAD_URL_EXPIRY_SECONDS = 3600  # 1 hour


class ExportService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ── Templates ────────────────────────────────────────────────────────────

    async def list_templates(self, format: str | None = None) -> list[ExportTemplateResponse]:
        stmt = select(ExportTemplate).order_by(ExportTemplate.name)
        if format:
            stmt = stmt.where(ExportTemplate.format == format)
        result = await self._db.execute(stmt)
        templates = result.scalars().all()
        return [ExportTemplateResponse.model_validate(t) for t in templates]

    async def get_template(self, template_id: uuid.UUID) -> ExportTemplate | None:
        return await self._db.get(ExportTemplate, template_id)

    # ── Jobs ─────────────────────────────────────────────────────────────────

    async def create_job(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ExportCreate,
    ) -> ExportJobResponse:
        # Validate format
        if data.format not in ("docx", "pdf", "epub"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported format: {data.format}. Use docx, pdf, or epub.",
            )

        # Validate template if specified
        if data.template_id:
            template = await self.get_template(data.template_id)
            if not template:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
            if template.format != data.format:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Template format '{template.format}' does not match requested format '{data.format}'",
                )

        from datetime import timedelta

        job = ExportJob(
            project_id=project_id,
            user_id=user_id,
            format=data.format,
            template_id=data.template_id,
            scope=data.scope.model_dump(),
            status="pending",
            expires_at=datetime.now(timezone.utc) + timedelta(days=_EXPORT_EXPIRY_DAYS),
        )
        self._db.add(job)
        await self._db.flush()
        await self._db.refresh(job)

        # Enqueue Celery task
        from app.tasks.export_tasks import export_document

        export_document.delay(str(job.id))
        logger.info("export_job_created", job_id=str(job.id), format=data.format)

        return await self._to_response(job)

    async def get_job(
        self, job_id: uuid.UUID, user_id: uuid.UUID
    ) -> ExportJobResponse:
        job = await self._db.get(ExportJob, job_id)
        if not job or job.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export job not found")
        return await self._to_response(job)

    async def list_jobs(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[ExportJobResponse]:
        stmt = (
            select(ExportJob)
            .where(ExportJob.project_id == project_id, ExportJob.user_id == user_id)
            .order_by(ExportJob.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._db.execute(stmt)
        jobs = result.scalars().all()
        return [await self._to_response(j) for j in jobs]

    async def _to_response(self, job: ExportJob) -> ExportJobResponse:
        download_url: str | None = None
        if job.status == "completed" and job.gcs_key:
            try:
                storage = get_storage()
                download_url = await storage.signed_url(job.gcs_key, expires=_DOWNLOAD_URL_EXPIRY_SECONDS)
            except Exception:
                logger.warning("failed_to_generate_download_url", job_id=str(job.id))

        resp = ExportJobResponse.model_validate(job)
        resp.download_url = download_url
        return resp
