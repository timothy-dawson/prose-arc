import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ExportScope(BaseModel):
    type: str = "full"  # "full" | "selected"
    node_ids: list[str] = []


class ExportCreate(BaseModel):
    format: str  # docx | pdf | epub
    template_id: uuid.UUID | None = None
    scope: ExportScope = ExportScope()


class ExportTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    format: str
    config: dict
    is_default: bool
    created_at: datetime


class ExportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    format: str
    template_id: uuid.UUID | None
    scope: dict
    status: str
    file_size_bytes: int | None
    error_message: str | None
    expires_at: datetime | None
    created_at: datetime
    completed_at: datetime | None
    download_url: str | None = None
