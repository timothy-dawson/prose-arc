"""Tests for binder node CRUD and tree operations."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_binder_node(async_client: AsyncClient, auth_headers: dict) -> None:
    project = (
        await async_client.post(
            "/api/v1/projects", json={"title": "P"}, headers=auth_headers
        )
    ).json()

    resp = await async_client.post(
        f"/api/v1/projects/{project['id']}/binder",
        json={"node_type": "chapter", "title": "Chapter 1", "sort_order": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    node = resp.json()
    assert node["title"] == "Chapter 1"
    assert node["node_type"] == "chapter"
    # Path should be a non-empty ltree label
    assert len(node["path"]) > 0
    assert node["parent_id"] is None


@pytest.mark.asyncio
async def test_binder_tree_ordering(async_client: AsyncClient, auth_headers: dict) -> None:
    project = (
        await async_client.post(
            "/api/v1/projects", json={"title": "Tree Test"}, headers=auth_headers
        )
    ).json()
    pid = project["id"]

    ch1 = (
        await async_client.post(
            f"/api/v1/projects/{pid}/binder",
            json={"node_type": "chapter", "title": "Ch1", "sort_order": 0},
            headers=auth_headers,
        )
    ).json()

    # Scene nested under chapter
    await async_client.post(
        f"/api/v1/projects/{pid}/binder",
        json={
            "node_type": "scene",
            "title": "Scene 1",
            "parent_id": ch1["id"],
            "sort_order": 0,
        },
        headers=auth_headers,
    )

    resp = await async_client.get(f"/api/v1/projects/{pid}/binder", headers=auth_headers)
    assert resp.status_code == 200
    nodes = resp.json()["nodes"]
    assert len(nodes) == 2
    titles = [n["title"] for n in nodes]
    assert "Ch1" in titles
    assert "Scene 1" in titles


@pytest.mark.asyncio
async def test_nested_node_path(async_client: AsyncClient, auth_headers: dict) -> None:
    project = (
        await async_client.post(
            "/api/v1/projects", json={"title": "Path Test"}, headers=auth_headers
        )
    ).json()
    pid = project["id"]

    parent = (
        await async_client.post(
            f"/api/v1/projects/{pid}/binder",
            json={"node_type": "chapter", "title": "Parent", "sort_order": 0},
            headers=auth_headers,
        )
    ).json()

    child = (
        await async_client.post(
            f"/api/v1/projects/{pid}/binder",
            json={
                "node_type": "scene",
                "title": "Child",
                "parent_id": parent["id"],
                "sort_order": 0,
            },
            headers=auth_headers,
        )
    ).json()

    # Child path should start with parent path
    assert child["path"].startswith(parent["path"] + ".")


@pytest.mark.asyncio
async def test_update_binder_node(async_client: AsyncClient, auth_headers: dict) -> None:
    project = (
        await async_client.post(
            "/api/v1/projects", json={"title": "P"}, headers=auth_headers
        )
    ).json()
    pid = project["id"]

    node = (
        await async_client.post(
            f"/api/v1/projects/{pid}/binder",
            json={"node_type": "chapter", "title": "Old", "sort_order": 0},
            headers=auth_headers,
        )
    ).json()

    resp = await async_client.patch(
        f"/api/v1/projects/{pid}/binder/{node['id']}",
        json={"title": "New Title"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_delete_binder_node(async_client: AsyncClient, auth_headers: dict) -> None:
    project = (
        await async_client.post(
            "/api/v1/projects", json={"title": "P"}, headers=auth_headers
        )
    ).json()
    pid = project["id"]

    node = (
        await async_client.post(
            f"/api/v1/projects/{pid}/binder",
            json={"node_type": "scene", "title": "Del", "sort_order": 0},
            headers=auth_headers,
        )
    ).json()

    resp = await async_client.delete(
        f"/api/v1/projects/{pid}/binder/{node['id']}", headers=auth_headers
    )
    assert resp.status_code == 204

    tree = await async_client.get(f"/api/v1/projects/{pid}/binder", headers=auth_headers)
    assert all(n["id"] != node["id"] for n in tree.json()["nodes"])
