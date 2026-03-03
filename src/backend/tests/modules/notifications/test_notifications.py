"""Tests for the notifications module — CRUD, preferences, and unread count."""

import pytest
from httpx import AsyncClient


@pytest.mark.integration
async def test_initial_notifications_empty(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    response = await async_client.get("/api/v1/notifications", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.integration
async def test_unread_count_starts_at_zero(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    response = await async_client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.integration
async def test_mark_all_read_is_idempotent(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    # Should not error even if there are no notifications
    response = await async_client.post("/api/v1/notifications/mark-all-read", headers=auth_headers)
    assert response.status_code == 204


@pytest.mark.integration
async def test_preferences_empty_initially(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    response = await async_client.get("/api/v1/notifications/preferences", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.integration
async def test_update_preference(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    # Disable export_complete notifications
    response = await async_client.patch(
        "/api/v1/notifications/preferences",
        json={"type": "export_complete", "enabled": False},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "export_complete"
    assert data["enabled"] is False

    # Re-enable
    response2 = await async_client.patch(
        "/api/v1/notifications/preferences",
        json={"type": "export_complete", "enabled": True},
        headers=auth_headers,
    )
    assert response2.json()["enabled"] is True


@pytest.mark.integration
async def test_mark_nonexistent_notification_as_read(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    import uuid

    fake_id = str(uuid.uuid4())
    # Should return 204 (no error for missing notification)
    response = await async_client.patch(
        f"/api/v1/notifications/{fake_id}/read", headers=auth_headers
    )
    assert response.status_code == 204
