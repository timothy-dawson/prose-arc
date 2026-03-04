"""Tests for codex entries and image upload."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_codex_entry(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": "character", "name": "Arthur", "summary": "The hero"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Arthur"
    assert data["entry_type"] == "character"
    assert data["summary"] == "The hero"
    assert data["tags"] == []
    assert data["content"] == {}


@pytest.mark.asyncio
async def test_list_codex_entries(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    for name, entry_type in [("Arthur", "character"), ("Camelot", "location"), ("Excalibur", "item")]:
        await async_client.post(
            f"/api/v1/projects/{project_id}/codex",
            json={"entry_type": entry_type, "name": name},
            headers=auth_headers,
        )

    resp = await async_client.get(f"/api/v1/projects/{project_id}/codex", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3

    # Filter by type
    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex?entry_type=character", headers=auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["name"] == "Arthur"


@pytest.mark.asyncio
async def test_search_codex_entries(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": "character", "name": "Merlin"},
        headers=auth_headers,
    )
    await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": "character", "name": "Morgan"},
        headers=auth_headers,
    )

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex?search=Mer", headers=auth_headers
    )
    assert resp.status_code == 200
    names = [e["name"] for e in resp.json()]
    assert "Merlin" in names
    assert "Morgan" not in names


@pytest.mark.asyncio
async def test_get_codex_entry(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    create = await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": "location", "name": "Camelot"},
        headers=auth_headers,
    )
    entry_id = create.json()["id"]

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == entry_id


@pytest.mark.asyncio
async def test_update_codex_entry(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    create = await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": "character", "name": "Arthur"},
        headers=auth_headers,
    )
    entry_id = create.json()["id"]

    resp = await async_client.patch(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        json={"name": "King Arthur", "tags": ["royalty", "knight"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "King Arthur"
    assert "royalty" in resp.json()["tags"]


@pytest.mark.asyncio
async def test_delete_codex_entry(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    create = await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": "lore", "name": "Magic System"},
        headers=auth_headers,
    )
    entry_id = create.json()["id"]

    resp = await async_client.delete(
        f"/api/v1/projects/{project_id}/codex/{entry_id}", headers=auth_headers
    )
    assert resp.status_code == 204

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_codex_structured_content(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    content = {
        "role": "Protagonist",
        "motivation": "Restore peace to the kingdom",
        "appearance": "Tall, dark hair, blue eyes",
    }
    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": "character", "name": "Arthur", "content": content},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["content"]["motivation"] == "Restore peace to the kingdom"


@pytest.mark.asyncio
async def test_codex_requires_auth(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    resp = await async_client.get(f"/api/v1/projects/{project_id}/codex")
    assert resp.status_code == 401  # unauthenticated → 401 Unauthorized
