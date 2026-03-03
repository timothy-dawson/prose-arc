"""
Codex module router — worldbuilding entries, links, mentions, image upload.
All routes require authentication. Mounted at /api/v1.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.modules.codex.schemas import (
    CodexEntryCreate,
    CodexEntryRead,
    CodexEntryUpdate,
    CodexLinkCreate,
    CodexLinkRead,
    CodexLinksResponse,
    CodexMentionRead,
    ImageUploadResponse,
    SyncMentionsRequest,
)
from app.modules.codex.service import CodexService
from app.modules.identity.models import User
from app.modules.manuscript.service import ManuscriptService

router = APIRouter(tags=["codex"])


# ---------------------------------------------------------------------------
# Entries
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/codex", response_model=list[CodexEntryRead])
async def list_codex_entries(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    entry_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    tags: list[str] | None = Query(default=None),
) -> list[CodexEntryRead]:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    entries = await svc.list_entries(project_id, entry_type, search, tags)
    return [CodexEntryRead.model_validate(e) for e in entries]


@router.post(
    "/projects/{project_id}/codex",
    response_model=CodexEntryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_codex_entry(
    project_id: uuid.UUID,
    data: CodexEntryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CodexEntryRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    entry = await svc.create_entry(project_id, data)
    return CodexEntryRead.model_validate(entry)


@router.get("/projects/{project_id}/codex/{entry_id}", response_model=CodexEntryRead)
async def get_codex_entry(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CodexEntryRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    entry = await svc.get_entry(entry_id, project_id)
    return CodexEntryRead.model_validate(entry)


@router.patch("/projects/{project_id}/codex/{entry_id}", response_model=CodexEntryRead)
async def update_codex_entry(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    data: CodexEntryUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CodexEntryRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    entry = await svc.get_entry(entry_id, project_id)
    entry = await svc.update_entry(entry, data)
    return CodexEntryRead.model_validate(entry)


@router.delete(
    "/projects/{project_id}/codex/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_codex_entry(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    entry = await svc.get_entry(entry_id, project_id)
    await svc.delete_entry(entry)


# ---------------------------------------------------------------------------
# Links
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{project_id}/codex/{entry_id}/links",
    response_model=CodexLinksResponse,
)
async def get_codex_links(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CodexLinksResponse:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    await svc.get_entry(entry_id, project_id)  # ownership check
    return await svc.get_links(entry_id)


@router.post(
    "/projects/{project_id}/codex/links",
    response_model=CodexLinkRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_codex_link(
    project_id: uuid.UUID,
    data: CodexLinkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CodexLinkRead:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    link = await svc.create_link(
        project_id, data.source_id, data.target_id, data.link_type, data.metadata
    )
    return CodexLinkRead.model_validate(link)


@router.delete(
    "/projects/{project_id}/codex/links/{source_id}/{target_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_codex_link(
    project_id: uuid.UUID,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    await svc.delete_link(source_id, target_id)


# ---------------------------------------------------------------------------
# Mentions
# ---------------------------------------------------------------------------


@router.get(
    "/projects/{project_id}/codex/{entry_id}/mentions",
    response_model=list[CodexMentionRead],
)
async def get_codex_mentions(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[CodexMentionRead]:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    await svc.get_entry(entry_id, project_id)  # ownership check
    mentions = await svc.get_mentions_for_entry(entry_id)
    return [CodexMentionRead.model_validate(m) for m in mentions]


@router.put(
    "/projects/{project_id}/binder/{node_id}/mentions",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def sync_node_mentions(
    project_id: uuid.UUID,
    node_id: uuid.UUID,
    data: SyncMentionsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    await svc.sync_mentions(node_id, data.entry_ids)


# ---------------------------------------------------------------------------
# Image upload
# ---------------------------------------------------------------------------


@router.post(
    "/projects/{project_id}/codex/{entry_id}/image",
    response_model=ImageUploadResponse,
)
async def upload_codex_image(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> ImageUploadResponse:
    ms = ManuscriptService(db)
    await ms.get_project(project_id, current_user.id)
    svc = CodexService(db)
    entry = await svc.get_entry(entry_id, project_id)
    file_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    url = await svc.upload_image(entry, file_bytes, content_type)
    return ImageUploadResponse(image_url=url)
