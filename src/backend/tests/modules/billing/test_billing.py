"""Tests for the billing module — subscription state and webhook handling."""

import json
import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Integration tests (require running DB)
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_get_subscription_free_by_default(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    """A new user should have a 'free' plan with no DB row."""
    response = await async_client.get("/api/v1/billing/subscription", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["plan"] == "free"
    assert data["status"] == "active"


@pytest.mark.integration
async def test_checkout_stub_returns_url(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    response = await async_client.post(
        "/api/v1/billing/checkout",
        json={"plan": "core"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "url" in data
    assert data["url"]  # non-empty


@pytest.mark.integration
async def test_checkout_invalid_plan(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    response = await async_client.post(
        "/api/v1/billing/checkout",
        json={"plan": "enterprise"},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.integration
async def test_webhook_checkout_completed(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    """A checkout.session.completed webhook should create a Subscription row."""
    # Get the test user's ID from the subscription endpoint
    sub_resp = await async_client.get("/api/v1/billing/subscription", headers=auth_headers)
    user_id = sub_resp.json()["user_id"]

    payload = json.dumps(
        {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "customer": "cus_test123",
                    "subscription": None,
                    "metadata": {"user_id": user_id, "plan": "core"},
                }
            },
        }
    ).encode()

    response = await async_client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 200

    # Subscription should now show 'core'
    sub_resp2 = await async_client.get("/api/v1/billing/subscription", headers=auth_headers)
    assert sub_resp2.json()["plan"] == "core"


@pytest.mark.integration
async def test_portal_stub_returns_url(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    response = await async_client.post("/api/v1/billing/portal", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["url"]
