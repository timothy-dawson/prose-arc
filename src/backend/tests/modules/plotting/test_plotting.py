"""Tests for outlines and beats."""

import pytest
from httpx import AsyncClient


async def _create_project(async_client: AsyncClient, auth_headers: dict) -> str:
    resp = await async_client.post("/api/v1/projects", json={"title": "Novel"}, headers=auth_headers)
    return resp.json()["id"]


async def _create_outline(
    async_client: AsyncClient, auth_headers: dict, project_id: str, title: str = "My Outline"
) -> str:
    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/outlines",
        json={"title": title, "template_type": "three_act"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_outline(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)

    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/outlines",
        json={"title": "Three Act Structure", "template_type": "three_act"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Three Act Structure"
    assert data["template_type"] == "three_act"
    assert data["structure"] == {}


@pytest.mark.asyncio
async def test_list_outlines(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)

    await _create_outline(async_client, auth_headers, project_id, "Outline 1")
    await _create_outline(async_client, auth_headers, project_id, "Outline 2")

    resp = await async_client.get(f"/api/v1/projects/{project_id}/outlines", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_update_outline(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)
    outline_id = await _create_outline(async_client, auth_headers, project_id)

    resp = await async_client.patch(
        f"/api/v1/projects/{project_id}/outlines/{outline_id}",
        json={"title": "Updated", "structure": {"acts": 3}},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"
    assert resp.json()["structure"]["acts"] == 3


@pytest.mark.asyncio
async def test_create_and_list_beats(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)
    outline_id = await _create_outline(async_client, auth_headers, project_id)

    for i, label in enumerate(["Inciting Incident", "Midpoint", "Climax"]):
        resp = await async_client.post(
            f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats",
            json={"label": label, "act": 1, "sort_order": i},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats", headers=auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_update_beat(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)
    outline_id = await _create_outline(async_client, auth_headers, project_id)

    beat = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats",
            json={"label": "Opening", "act": 1},
            headers=auth_headers,
        )
    ).json()
    beat_id = beat["id"]

    resp = await async_client.patch(
        f"/api/v1/projects/{project_id}/beats/{beat_id}",
        json={"label": "Opening Image", "description": "Visual representation of the theme"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["label"] == "Opening Image"
    assert resp.json()["description"] == "Visual representation of the theme"


@pytest.mark.asyncio
async def test_delete_beat(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)
    outline_id = await _create_outline(async_client, auth_headers, project_id)

    beat_id = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats",
            json={"label": "Delete Me"},
            headers=auth_headers,
        )
    ).json()["id"]

    resp = await async_client.delete(
        f"/api/v1/projects/{project_id}/beats/{beat_id}", headers=auth_headers
    )
    assert resp.status_code == 204

    resp = await async_client.get(
        f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats", headers=auth_headers
    )
    assert all(b["id"] != beat_id for b in resp.json())


@pytest.mark.asyncio
async def test_reorder_beats(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)
    outline_id = await _create_outline(async_client, auth_headers, project_id)

    ids = []
    for i, label in enumerate(["A", "B", "C"]):
        beat = (
            await async_client.post(
                f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats",
                json={"label": label, "sort_order": i},
                headers=auth_headers,
            )
        ).json()
        ids.append(beat["id"])

    # Reverse order
    reorder_items = [
        {"beat_id": ids[0], "sort_order": 2},
        {"beat_id": ids[1], "sort_order": 1},
        {"beat_id": ids[2], "sort_order": 0},
    ]
    resp = await async_client.post(
        f"/api/v1/projects/{project_id}/beats/reorder",
        json={"items": reorder_items},
        headers=auth_headers,
    )
    assert resp.status_code == 204

    beats = (
        await async_client.get(
            f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats", headers=auth_headers
        )
    ).json()
    sorted_labels = [b["label"] for b in beats]
    assert sorted_labels == ["C", "B", "A"]


@pytest.mark.asyncio
async def test_link_beat_to_binder_node(async_client: AsyncClient, auth_headers: dict) -> None:
    project_id = await _create_project(async_client, auth_headers)
    outline_id = await _create_outline(async_client, auth_headers, project_id)

    node_id = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/binder",
            json={"node_type": "scene", "title": "Opening"},
            headers=auth_headers,
        )
    ).json()["id"]

    beat_id = (
        await async_client.post(
            f"/api/v1/projects/{project_id}/outlines/{outline_id}/beats",
            json={"label": "Inciting Incident"},
            headers=auth_headers,
        )
    ).json()["id"]

    resp = await async_client.patch(
        f"/api/v1/projects/{project_id}/beats/{beat_id}",
        json={"binder_node_id": node_id},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["binder_node_id"] == node_id
