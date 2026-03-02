"""Tests for project CRUD endpoints."""

import pytest
from httpx import AsyncClient

from app.modules.identity.models import User


@pytest.mark.asyncio
async def test_create_project(async_client: AsyncClient, auth_headers: dict) -> None:
    resp = await async_client.post(
        "/api/v1/projects",
        json={"title": "My Novel"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Novel"
    assert data["word_count"] == 0


@pytest.mark.asyncio
async def test_list_projects(async_client: AsyncClient, auth_headers: dict) -> None:
    # Create two projects
    for title in ("Book A", "Book B"):
        await async_client.post(
            "/api/v1/projects", json={"title": title}, headers=auth_headers
        )

    resp = await async_client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "Book A" in titles
    assert "Book B" in titles


@pytest.mark.asyncio
async def test_get_project(async_client: AsyncClient, auth_headers: dict) -> None:
    create = await async_client.post(
        "/api/v1/projects", json={"title": "Fetch Me"}, headers=auth_headers
    )
    project_id = create.json()["id"]

    resp = await async_client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == project_id


@pytest.mark.asyncio
async def test_update_project(async_client: AsyncClient, auth_headers: dict) -> None:
    create = await async_client.post(
        "/api/v1/projects", json={"title": "Old Title"}, headers=auth_headers
    )
    project_id = create.json()["id"]

    resp = await async_client.patch(
        f"/api/v1/projects/{project_id}",
        json={"title": "New Title"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_delete_project(async_client: AsyncClient, auth_headers: dict) -> None:
    create = await async_client.post(
        "/api/v1/projects", json={"title": "Delete Me"}, headers=auth_headers
    )
    project_id = create.json()["id"]

    resp = await async_client.delete(
        f"/api/v1/projects/{project_id}", headers=auth_headers
    )
    assert resp.status_code == 204

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_project_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get("/api/v1/projects")
    assert resp.status_code == 403
