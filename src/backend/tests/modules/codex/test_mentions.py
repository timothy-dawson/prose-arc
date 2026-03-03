"""Tests for codex mentions (binder node ↔ codex entry cross-references)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sync_and_get_mentions(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    # Create a binder node (scene)
    node_resp = await async_client.post(
        f"/api/v1/projects/{project_id}/binder",
        json={"node_type": "scene", "title": "Opening scene"},
        headers=auth_headers,
    )
    node_id = node_resp.json()["id"]

    # Create two codex entries
    arthur = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/codex",
            json={"entry_type": "character", "name": "Arthur"},
            headers=auth_headers,
        )
    ).json()["id"]
    merlin = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/codex",
            json={"entry_type": "character", "name": "Merlin"},
            headers=auth_headers,
        )
    ).json()["id"]

    # Sync mentions for the node
    resp = await async_client.put(
        f"/api/v1/projects/{project_id}/binder/{node_id}/mentions",
        json={"entry_ids": [arthur, merlin]},
        headers=auth_headers,
    )
    assert resp.status_code == 204

    # Get mentions for Arthur
    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{arthur}/mentions", headers=auth_headers
    )
    assert resp.status_code == 200
    mention_nodes = [m["binder_node_id"] for m in resp.json()]
    assert node_id in mention_nodes


@pytest.mark.asyncio
async def test_sync_mentions_replaces_existing(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    node_id = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/binder",
            json={"node_type": "scene", "title": "Scene 1"},
            headers=auth_headers,
        )
    ).json()["id"]

    arthur = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/codex",
            json={"entry_type": "character", "name": "Arthur"},
            headers=auth_headers,
        )
    ).json()["id"]
    merlin = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/codex",
            json={"entry_type": "character", "name": "Merlin"},
            headers=auth_headers,
        )
    ).json()["id"]

    # First sync: both entries
    await async_client.put(
        f"/api/v1/projects/{project_id}/binder/{node_id}/mentions",
        json={"entry_ids": [arthur, merlin]},
        headers=auth_headers,
    )

    # Second sync: only Arthur (Merlin removed)
    resp = await async_client.put(
        f"/api/v1/projects/{project_id}/binder/{node_id}/mentions",
        json={"entry_ids": [arthur]},
        headers=auth_headers,
    )
    assert resp.status_code == 204

    # Merlin should no longer be mentioned
    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{merlin}/mentions", headers=auth_headers
    )
    assert resp.json() == []

    # Arthur still mentioned
    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{arthur}/mentions", headers=auth_headers
    )
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_cascade_delete_removes_mentions(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    node_id = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/binder",
            json={"node_type": "scene", "title": "Scene"},
            headers=auth_headers,
        )
    ).json()["id"]

    entry_id = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/codex",
            json={"entry_type": "character", "name": "Arthur"},
            headers=auth_headers,
        )
    ).json()["id"]

    await async_client.put(
        f"/api/v1/projects/{project_id}/binder/{node_id}/mentions",
        json={"entry_ids": [entry_id]},
        headers=auth_headers,
    )

    # Delete the codex entry — mentions should cascade
    await async_client.delete(
        f"/api/v1/projects/{project_id}/codex/{entry_id}", headers=auth_headers
    )

    # Verify the entry is gone (mentions table was cascade-deleted)
    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}", headers=auth_headers
    )
    assert resp.status_code == 404
