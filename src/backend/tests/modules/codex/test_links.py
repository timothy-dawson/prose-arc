"""Tests for codex entry cross-links."""

import pytest
from httpx import AsyncClient


async def _create_entry(
    async_client: AsyncClient, auth_headers: dict, project_id: str, name: str, entry_type: str = "character"
) -> str:
    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"entry_type": entry_type, "name": name},
        headers=auth_headers,
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_and_get_link(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    arthur_id = await _create_entry(async_client, auth_headers, project_id, "Arthur")
    mordred_id = await _create_entry(async_client, auth_headers, project_id, "Mordred")

    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/codex/links",
        json={"source_id": arthur_id, "target_id": mordred_id, "link_type": "enemy"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["link_type"] == "enemy"

    # Get links for Arthur — should appear as outgoing
    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{arthur_id}/links", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["outgoing"]) == 1
    assert data["outgoing"][0]["target_id"] == mordred_id
    assert len(data["incoming"]) == 0

    # Get links for Mordred — should appear as incoming
    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{mordred_id}/links", headers=auth_headers
    )
    data = resp.json()
    assert len(data["incoming"]) == 1
    assert data["incoming"][0]["source_id"] == arthur_id
    assert len(data["outgoing"]) == 0


@pytest.mark.asyncio
async def test_delete_link(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    a_id = await _create_entry(async_client, auth_headers, project_id, "A")
    b_id = await _create_entry(async_client, auth_headers, project_id, "B")

    await async_client.post(
        f"/api/v1/projects/{project_id}/codex/links",
        json={"source_id": a_id, "target_id": b_id, "link_type": "related"},
        headers=auth_headers,
    )

    resp = await async_client.delete(
        f"/api/v1/projects/{project_id}/codex/links/{a_id}/{b_id}", headers=auth_headers
    )
    assert resp.status_code == 204

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{a_id}/links", headers=auth_headers
    )
    assert len(resp.json()["outgoing"]) == 0


@pytest.mark.asyncio
async def test_link_duplicate_rejected(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    a_id = await _create_entry(async_client, auth_headers, project_id, "A")
    b_id = await _create_entry(async_client, auth_headers, project_id, "B")

    payload = {"source_id": a_id, "target_id": b_id, "link_type": "related"}
    await async_client.post(
        f"/api/v1/projects/{project_id}/codex/links", json=payload, headers=auth_headers
    )
    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/codex/links", json=payload, headers=auth_headers
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_link_cross_project_rejected(async_client: AsyncClient, auth_headers: dict) -> None:
    proj1 = (await async_client.post("/api/v1/projects", json={"title": "P1"}, headers=auth_headers)).json()
    proj2 = (await async_client.post("/api/v1/projects", json={"title": "P2"}, headers=auth_headers)).json()

    a_id = await _create_entry(async_client, auth_headers, proj1["id"], "A")
    b_id = await _create_entry(async_client, auth_headers, proj2["id"], "B")

    # Try to link entries from different projects (using proj1's endpoint)
    resp = await async_client.post(
        f"/api/v1/projects/{proj1['id']}/codex/links",
        json={"source_id": a_id, "target_id": b_id, "link_type": "related"},
        headers=auth_headers,
    )
    # b_id does not belong to proj1, so 404 is expected
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cascade_delete_removes_links(async_client: AsyncClient, auth_headers: dict) -> None:
    proj = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    project_id = proj.json()["id"]

    a_id = await _create_entry(async_client, auth_headers, project_id, "A")
    b_id = await _create_entry(async_client, auth_headers, project_id, "B")

    await async_client.post(
        f"/api/v1/projects/{project_id}/codex/links",
        json={"source_id": a_id, "target_id": b_id, "link_type": "ally"},
        headers=auth_headers,
    )

    # Delete source entry — link should cascade
    await async_client.delete(f"/api/v1/projects/{project_id}/codex/{a_id}", headers=auth_headers)

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/codex/{b_id}/links", headers=auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()["incoming"]) == 0
