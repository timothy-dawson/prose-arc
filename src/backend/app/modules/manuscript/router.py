"""
Manuscript module router — projects, binder tree, documents, search.
All routes require authentication. Mounted at /api/v1.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.modules.identity.models import User
from app.modules.manuscript.schemas import (
    BinderNodeCreate,
    BinderNodeRead,
    BinderNodeUpdate,
    BinderReorderRequest,
    BinderTreeResponse,
    DocumentRead,
    DocumentSave,
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
    SearchResponse,
)
from app.modules.manuscript.service import ManuscriptService

router = APIRouter(tags=["manuscript"])


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@router.post("/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectRead:
    svc = ManuscriptService(db)
    project = await svc.create_project(current_user.id, data)
    return ProjectRead.model_validate(project)


@router.get("/projects", response_model=list[ProjectRead])
async def list_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ProjectRead]:
    svc = ManuscriptService(db)
    projects = await svc.list_projects(current_user.id)
    return [ProjectRead.model_validate(p) for p in projects]


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectRead:
    svc = ManuscriptService(db)
    project = await svc.get_project(project_id, current_user.id)
    return ProjectRead.model_validate(project)


@router.patch("/projects/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectRead:
    svc = ManuscriptService(db)
    project = await svc.get_project(project_id, current_user.id)
    updated = await svc.update_project(project, data)
    return ProjectRead.model_validate(updated)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    svc = ManuscriptService(db)
    project = await svc.get_project(project_id, current_user.id)
    await svc.delete_project(project)


# ---------------------------------------------------------------------------
# Binder nodes
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/binder", response_model=BinderTreeResponse)
async def get_binder_tree(
    project_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BinderTreeResponse:
    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    nodes = await svc.get_binder_tree(project_id)
    return BinderTreeResponse(nodes=[BinderNodeRead.model_validate(n) for n in nodes])


@router.post(
    "/projects/{project_id}/binder",
    response_model=BinderNodeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_binder_node(
    project_id: uuid.UUID,
    data: BinderNodeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BinderNodeRead:
    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    node = await svc.create_binder_node(project_id, data)
    return BinderNodeRead.model_validate(node)


@router.patch("/projects/{project_id}/binder/{node_id}", response_model=BinderNodeRead)
async def update_binder_node(
    project_id: uuid.UUID,
    node_id: uuid.UUID,
    data: BinderNodeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BinderNodeRead:
    from sqlalchemy import select
    from app.modules.manuscript.models import BinderNode

    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    result = await db.execute(
        select(BinderNode).where(
            BinderNode.id == node_id, BinderNode.project_id == project_id
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")
    updated = await svc.update_binder_node(node, data)
    return BinderNodeRead.model_validate(updated)


@router.delete(
    "/projects/{project_id}/binder/{node_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_binder_node(
    project_id: uuid.UUID,
    node_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    from sqlalchemy import select
    from app.modules.manuscript.models import BinderNode

    result = await db.execute(
        select(BinderNode).where(
            BinderNode.id == node_id, BinderNode.project_id == project_id
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")
    await svc.delete_binder_node(node)


@router.post(
    "/projects/{project_id}/binder/reorder", status_code=status.HTTP_204_NO_CONTENT
)
async def reorder_binder(
    project_id: uuid.UUID,
    data: BinderReorderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    await svc.bulk_reorder(project_id, data)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/documents/{node_id}", response_model=DocumentRead)
async def get_document(
    project_id: uuid.UUID,
    node_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DocumentRead:
    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    content = await svc.load_document(node_id)
    doc_record = await svc.get_document_record(node_id)

    if doc_record is None:
        # Return empty document for new nodes
        return DocumentRead(
            binder_node_id=node_id,
            content={"type": "doc", "content": [{"type": "paragraph"}]},
            byte_size=0,
            updated_at=__import__("datetime").datetime.utcnow(),
        )

    return DocumentRead(
        binder_node_id=node_id,
        content=content or {"type": "doc", "content": [{"type": "paragraph"}]},
        byte_size=doc_record.byte_size or 0,
        updated_at=doc_record.updated_at,
    )


@router.put("/projects/{project_id}/documents/{node_id}", response_model=DocumentRead)
async def save_document(
    project_id: uuid.UUID,
    node_id: uuid.UUID,
    data: DocumentSave,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DocumentRead:
    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    doc = await svc.save_document(project_id, node_id, data)
    content = await svc.load_document(node_id)
    return DocumentRead(
        binder_node_id=node_id,
        content=content or data.content,
        byte_size=doc.byte_size or data.byte_size,
        updated_at=doc.updated_at,
    )


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/search", response_model=SearchResponse)
async def search_project(
    project_id: uuid.UUID,
    q: Annotated[str, Query(min_length=1)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SearchResponse:
    svc = ManuscriptService(db)
    await svc.get_project(project_id, current_user.id)  # ownership check
    results = await svc.search_project(project_id, q)
    return SearchResponse(results=results, total=len(results))
