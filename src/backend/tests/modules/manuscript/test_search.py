"""Tests for full-text search across project documents."""

import json

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_returns_results(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    # Create project + node + save content containing a unique keyword
    project = (
        await async_client.post(
            "/api/v1/projects", json={"title": "Search Test"}, headers=auth_headers
        )
    ).json()
    pid = project["id"]

    node = (
        await async_client.post(
            f"/api/v1/projects/{pid}/binder",
            json={"node_type": "scene", "title": "The Cave", "sort_order": 0},
            headers=auth_headers,
        )
    ).json()
    nid = node["id"]

    content = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "The protagonist discovered an ancient artifact."}
                ],
            }
        ],
    }
    raw = json.dumps(content).encode()
    await async_client.put(
        f"/api/v1/projects/{pid}/documents/{nid}",
        json={"content": content, "byte_size": len(raw)},
        headers=auth_headers,
    )

    resp = await async_client.get(
        f"/api/v1/projects/{pid}/search?q=artifact", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert any("artifact" in r["snippet"].lower() for r in body["results"])


@pytest.mark.asyncio
async def test_search_no_results(async_client: AsyncClient, auth_headers: dict) -> None:
    project = (
        await async_client.post(
            "/api/v1/projects", json={"title": "Empty Search"}, headers=auth_headers
        )
    ).json()

    resp = await async_client.get(
        f"/api/v1/projects/{project['id']}/search?q=nonexistentword",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
