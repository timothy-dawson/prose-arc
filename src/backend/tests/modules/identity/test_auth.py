"""
Tests for the identity module — registration, login, token refresh, profile.
"""

import pytest
from httpx import AsyncClient

from app.modules.identity.models import User


async def test_register_new_user(async_client: AsyncClient) -> None:
    response = await async_client.post("/api/v1/auth/register", json={
        "email": "newuser@example.com",
        "password": "SecurePass1",
        "display_name": "New User",
    })
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "newuser@example.com"
    assert body["display_name"] == "New User"
    assert "id" in body
    assert "hashed_password" not in body


async def test_register_duplicate_email(async_client: AsyncClient, test_user: User) -> None:
    response = await async_client.post("/api/v1/auth/register", json={
        "email": test_user.email,
        "password": "AnotherPass1",
    })
    assert response.status_code == 409


async def test_register_weak_password(async_client: AsyncClient) -> None:
    response = await async_client.post("/api/v1/auth/register", json={
        "email": "weakpass@example.com",
        "password": "short",
    })
    assert response.status_code == 422


async def test_login_success(async_client: AsyncClient, test_user: User) -> None:
    response = await async_client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "TestPass123",
    })
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


async def test_login_wrong_password(async_client: AsyncClient, test_user: User) -> None:
    response = await async_client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "wrongpassword",
    })
    assert response.status_code == 401


async def test_login_unknown_email(async_client: AsyncClient) -> None:
    response = await async_client.post("/api/v1/auth/login", json={
        "email": "nobody@example.com",
        "password": "AnyPass123",
    })
    assert response.status_code == 401


async def test_get_me_requires_auth(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/users/me")
    assert response.status_code == 403  # HTTPBearer returns 403 when no credentials


async def test_get_me_with_valid_token(async_client: AsyncClient, test_user: User) -> None:
    # Login to get token
    login = await async_client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "TestPass123",
    })
    token = login.json()["access_token"]

    response = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == test_user.email


async def test_token_refresh(async_client: AsyncClient, test_user: User) -> None:
    login = await async_client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "TestPass123",
    })
    refresh_token = login.json()["refresh_token"]

    response = await async_client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body


async def test_update_profile(async_client: AsyncClient, test_user: User) -> None:
    login = await async_client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "TestPass123",
    })
    token = login.json()["access_token"]

    response = await async_client.patch(
        "/api/v1/users/me",
        json={"display_name": "Updated Name"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Updated Name"


async def test_health_check(async_client: AsyncClient) -> None:
    response = await async_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("ok", "degraded")
    assert body["version"] == "0.1.0"
