"""Tests for document content save/load and compression."""

import json

import pytest
from httpx import AsyncClient

_EMPTY_DOC = {"type": "doc", "content": [{"type": "paragraph"}]}


def _make_large_doc(target_bytes: int = 70_000) -> dict:
    """Build a ProseMirror doc large enough to exceed the 64KB threshold."""
    text = "a" * target_bytes
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


async def _create_project_and_node(client: AsyncClient, headers: dict) -> tuple[str, str]:
    project = (
        await client.post("/api/v1/projects", json={"title": "Doc Test"}, headers=headers)
    ).json()
    node = (
        await client.post(
            f"/api/v1/projects/{project['id']}/binder",
            json={"node_type": "scene", "title": "Scene", "sort_order": 0},
            headers=headers,
        )
    ).json()
    return project["id"], node["id"]


@pytest.mark.asyncio
async def test_save_and_load_small_document(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    content = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Hello world"}]}
        ],
    }
    save_resp = await async_client.put(
        f"/api/v1/projects/{pid}/documents/{nid}",
        json={"content": content, "byte_size": len(json.dumps(content).encode())},
        headers=auth_headers,
    )
    assert save_resp.status_code == 200

    load_resp = await async_client.get(
        f"/api/v1/projects/{pid}/documents/{nid}", headers=auth_headers
    )
    assert load_resp.status_code == 200
    loaded = load_resp.json()
    assert loaded["content"]["type"] == "doc"
    # Text should round-trip
    leaf = loaded["content"]["content"][0]["content"][0]
    assert leaf["text"] == "Hello world"


@pytest.mark.asyncio
async def test_save_and_load_large_document(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    """Documents >= 64KB should be compressed and decompressed transparently."""
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    large_doc = _make_large_doc(70_000)
    raw = json.dumps(large_doc).encode()

    save_resp = await async_client.put(
        f"/api/v1/projects/{pid}/documents/{nid}",
        json={"content": large_doc, "byte_size": len(raw)},
        headers=auth_headers,
    )
    assert save_resp.status_code == 200

    load_resp = await async_client.get(
        f"/api/v1/projects/{pid}/documents/{nid}", headers=auth_headers
    )
    assert load_resp.status_code == 200
    loaded = load_resp.json()
    # Content type should survive round-trip
    assert loaded["content"]["type"] == "doc"
    text = loaded["content"]["content"][0]["content"][0]["text"]
    assert len(text) == 70_000


@pytest.mark.asyncio
async def test_empty_document_returns_default(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    resp = await async_client.get(
        f"/api/v1/projects/{pid}/documents/{nid}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["content"]["type"] == "doc"
