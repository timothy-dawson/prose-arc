"""
Tests for the versioning module — snapshots, delta chains, restore, diff.

Integration tests (marked with @pytest.mark.integration) require MinIO to be running.
Run with: pytest tests/modules/versioning/ -m integration
"""

import json

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DOC_V1 = {
    "type": "doc",
    "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": "Version one text."}]}
    ],
}

_DOC_V2 = {
    "type": "doc",
    "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": "Version two text — different!"}]}
    ],
}

_EMPTY_DOC = {"type": "doc", "content": [{"type": "paragraph"}]}


async def _create_project_and_node(client: AsyncClient, headers: dict) -> tuple[str, str]:
    proj = (
        await client.post("/api/v1/projects", json={"title": "Snapshot Test"}, headers=headers)
    ).json()
    node = (
        await client.post(
            f"/api/v1/projects/{proj['id']}/binder",
            json={"node_type": "scene", "title": "Scene 1", "sort_order": 0},
            headers=headers,
        )
    ).json()
    return proj["id"], node["id"]


async def _save_doc(
    client: AsyncClient, headers: dict, project_id: str, node_id: str, content: dict
) -> None:
    raw = json.dumps(content).encode()
    resp = await client.put(
        f"/api/v1/projects/{project_id}/documents/{node_id}",
        json={"content": content, "byte_size": len(raw)},
        headers=headers,
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Snapshot creation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_create_manual_snapshot(async_client: AsyncClient, auth_headers: dict) -> None:
    """Creating a manual snapshot returns snapshot metadata and uploads a .zst to MinIO."""
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)

    resp = await async_client.post(
        f"/api/v1/projects/{pid}/snapshots",
        json={"binder_node_id": nid, "name": "My first snapshot"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["snapshot_type"] == "manual"
    assert data["name"] == "My first snapshot"
    assert data["binder_node_id"] == nid
    assert data["is_keyframe"] is True  # first snapshot → always keyframe
    assert data["word_count"] > 0


@pytest.mark.asyncio
@pytest.mark.integration
async def test_first_snapshot_is_keyframe(async_client: AsyncClient, auth_headers: dict) -> None:
    """The very first snapshot for a node is always a keyframe (count % 10 == 0)."""
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)

    snap = (
        await async_client.post(
            f"/api/v1/projects/{pid}/snapshots",
            json={"binder_node_id": nid},
            headers=auth_headers,
        )
    ).json()
    assert snap["is_keyframe"] is True


@pytest.mark.asyncio
@pytest.mark.integration
async def test_tenth_snapshot_is_keyframe(async_client: AsyncClient, auth_headers: dict) -> None:
    """The 10th snapshot for a node should be a keyframe."""
    pid, nid = await _create_project_and_node(async_client, auth_headers)

    for i in range(10):
        content = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": f"Version {i} with enough text to pass the 50-byte delta threshold check."}],
                }
            ],
        }
        await _save_doc(async_client, auth_headers, pid, nid, content)
        resp = await async_client.post(
            f"/api/v1/projects/{pid}/snapshots",
            json={"binder_node_id": nid},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        snap = resp.json()
        # Snapshot index 0 (1st) and index 9 (10th) should be keyframes
        if i == 0 or i == 9:
            assert snap["is_keyframe"] is True, f"Expected keyframe at index {i}"
        else:
            assert snap["is_keyframe"] is False, f"Expected non-keyframe at index {i}"


# ---------------------------------------------------------------------------
# List / Get
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_list_snapshots(async_client: AsyncClient, auth_headers: dict) -> None:
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)

    await async_client.post(
        f"/api/v1/projects/{pid}/snapshots", json={"binder_node_id": nid}, headers=auth_headers
    )

    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V2)
    await async_client.post(
        f"/api/v1/projects/{pid}/snapshots",
        json={"binder_node_id": nid, "name": "v2"},
        headers=auth_headers,
    )

    resp = await async_client.get(
        f"/api/v1/projects/{pid}/documents/{nid}/history", headers=auth_headers
    )
    assert resp.status_code == 200
    snapshots = resp.json()
    assert len(snapshots) == 2
    # Newest first
    assert snapshots[0]["name"] == "v2"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_snapshot_metadata(async_client: AsyncClient, auth_headers: dict) -> None:
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)

    snap = (
        await async_client.post(
            f"/api/v1/projects/{pid}/snapshots",
            json={"binder_node_id": nid, "name": "test"},
            headers=auth_headers,
        )
    ).json()

    resp = await async_client.get(
        f"/api/v1/projects/{pid}/snapshots/{snap['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == snap["id"]


# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_restore_snapshot(async_client: AsyncClient, auth_headers: dict) -> None:
    """Restoring a snapshot should put V1 content back into the document."""
    pid, nid = await _create_project_and_node(async_client, auth_headers)

    # Save V1 and snapshot it
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)
    snap = (
        await async_client.post(
            f"/api/v1/projects/{pid}/snapshots",
            json={"binder_node_id": nid, "name": "v1-snap"},
            headers=auth_headers,
        )
    ).json()

    # Overwrite with V2
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V2)

    # Restore V1
    restore_resp = await async_client.post(
        f"/api/v1/projects/{pid}/snapshots/{snap['id']}/restore", headers=auth_headers
    )
    assert restore_resp.status_code == 200
    data = restore_resp.json()
    assert data["restored_snapshot_id"] == snap["id"]
    assert data["pre_restore_snapshot_id"] is not None  # safety snapshot created

    # Load the document — should contain V1 text
    doc_resp = await async_client.get(
        f"/api/v1/projects/{pid}/documents/{nid}", headers=auth_headers
    )
    assert doc_resp.status_code == 200
    doc = doc_resp.json()
    text = doc["content"]["content"][0]["content"][0]["text"]
    assert "Version one" in text


# ---------------------------------------------------------------------------
# Diff
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_diff_snapshot(async_client: AsyncClient, auth_headers: dict) -> None:
    """Diff between a snapshot and current document should reflect changes."""
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)

    snap = (
        await async_client.post(
            f"/api/v1/projects/{pid}/snapshots",
            json={"binder_node_id": nid},
            headers=auth_headers,
        )
    ).json()

    # Change document
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V2)

    diff_resp = await async_client.get(
        f"/api/v1/projects/{pid}/snapshots/{snap['id']}/diff", headers=auth_headers
    )
    assert diff_resp.status_code == 200
    diff = diff_resp.json()
    assert diff["changes_count"] > 0


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_delete_snapshot(async_client: AsyncClient, auth_headers: dict) -> None:
    """Deleting a snapshot removes it from the list."""
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)

    snap = (
        await async_client.post(
            f"/api/v1/projects/{pid}/snapshots",
            json={"binder_node_id": nid},
            headers=auth_headers,
        )
    ).json()

    del_resp = await async_client.delete(
        f"/api/v1/projects/{pid}/snapshots/{snap['id']}", headers=auth_headers
    )
    assert del_resp.status_code == 204

    list_resp = await async_client.get(
        f"/api/v1/projects/{pid}/documents/{nid}/history", headers=auth_headers
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 0


# ---------------------------------------------------------------------------
# Auto-snapshot skip logic
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_auto_snapshot_skips_small_delta(async_client: AsyncClient, auth_headers: dict) -> None:
    """
    Auto-snapshot (skip_if_small=True) should skip if the patch is < 50 bytes.
    The service returns None in this case; we test via direct service call.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.config import get_settings
    from app.modules.manuscript.models import DocumentContent
    from app.modules.versioning.service import VersioningService
    from tests.conftest import TEST_DATABASE_URL

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # We'll create a project+node via API, save identical content twice, then
    # call service directly to verify skip logic
    pid, nid = await _create_project_and_node(async_client, auth_headers)
    await _save_doc(async_client, auth_headers, pid, nid, _DOC_V1)

    async with session_factory() as session:
        svc = VersioningService(session)
        import uuid

        node_uuid = uuid.UUID(nid)
        project_uuid = uuid.UUID(pid)

        # First snapshot — should succeed (keyframe)
        snap1 = await svc.create_snapshot(
            project_id=project_uuid,
            binder_node_id=node_uuid,
            snapshot_type="auto",
            skip_if_small=True,
        )
        assert snap1 is not None
        await session.commit()

        # Save exactly the same content again (identical → delta < 50 bytes)
        snap2 = await svc.create_snapshot(
            project_id=project_uuid,
            binder_node_id=node_uuid,
            snapshot_type="auto",
            skip_if_small=True,
        )
        # Should be skipped because patch is tiny / empty
        assert snap2 is None

    await engine.dispose()
