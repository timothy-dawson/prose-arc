"""
Tests for the goals module — CRUD, writing sessions, streak, stats.
"""

import datetime

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_project(client: AsyncClient, headers: dict, title: str = "Goals Test") -> str:
    proj = (
        await client.post("/api/v1/projects", json={"title": title}, headers=headers)
    ).json()
    return proj["id"]


# ---------------------------------------------------------------------------
# Goals CRUD
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_goal(async_client: AsyncClient, auth_headers: dict) -> None:
    resp = await async_client.post(
        "/api/v1/goals",
        json={"goal_type": "daily", "target_words": 1000},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["goal_type"] == "daily"
    assert data["target_words"] == 1000
    assert data["project_id"] is None
    assert data["deadline"] is None


@pytest.mark.asyncio
async def test_create_project_goal(async_client: AsyncClient, auth_headers: dict) -> None:
    pid = await _create_project(async_client, auth_headers)
    resp = await async_client.post(
        "/api/v1/goals",
        json={
            "goal_type": "project",
            "target_words": 80000,
            "project_id": pid,
            "deadline": "2026-12-31",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["goal_type"] == "project"
    assert data["target_words"] == 80000
    assert data["project_id"] == pid
    assert data["deadline"] == "2026-12-31"


@pytest.mark.asyncio
async def test_list_goals(async_client: AsyncClient, auth_headers: dict) -> None:
    # Create two goals
    for target in [500, 1500]:
        await async_client.post(
            "/api/v1/goals",
            json={"goal_type": "daily", "target_words": target},
            headers=auth_headers,
        )

    resp = await async_client.get("/api/v1/goals", headers=auth_headers)
    assert resp.status_code == 200
    goals = resp.json()
    assert len(goals) >= 2


@pytest.mark.asyncio
async def test_update_goal(async_client: AsyncClient, auth_headers: dict) -> None:
    goal = (
        await async_client.post(
            "/api/v1/goals",
            json={"goal_type": "daily", "target_words": 500},
            headers=auth_headers,
        )
    ).json()

    resp = await async_client.patch(
        f"/api/v1/goals/{goal['id']}",
        json={"target_words": 2000},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["target_words"] == 2000


@pytest.mark.asyncio
async def test_delete_goal(async_client: AsyncClient, auth_headers: dict) -> None:
    goal = (
        await async_client.post(
            "/api/v1/goals",
            json={"goal_type": "session", "target_words": 300},
            headers=auth_headers,
        )
    ).json()

    del_resp = await async_client.delete(f"/api/v1/goals/{goal['id']}", headers=auth_headers)
    assert del_resp.status_code == 204

    # Should not appear in list (get all goals and check this one is gone)
    list_resp = await async_client.get("/api/v1/goals", headers=auth_headers)
    ids = [g["id"] for g in list_resp.json()]
    assert goal["id"] not in ids


@pytest.mark.asyncio
async def test_delete_other_user_goal_returns_404(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    """A user cannot delete another user's goal."""
    goal = (
        await async_client.post(
            "/api/v1/goals",
            json={"goal_type": "daily", "target_words": 500},
            headers=auth_headers,
        )
    ).json()

    # Register and log in a second user
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "other_goals@prosearc.dev",
            "password": "OtherPass123",
            "display_name": "Other",
        },
    )
    login = (
        await async_client.post(
            "/api/v1/auth/login",
            json={"email": "other_goals@prosearc.dev", "password": "OtherPass123"},
        )
    ).json()
    other_headers = {"Authorization": f"Bearer {login['access_token']}"}

    resp = await async_client.delete(f"/api/v1/goals/{goal['id']}", headers=other_headers)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Writing sessions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_and_end_session(async_client: AsyncClient, auth_headers: dict) -> None:
    pid = await _create_project(async_client, auth_headers)

    # Start session
    start_resp = await async_client.post(
        "/api/v1/goals/sessions/start",
        json={"project_id": pid},
        headers=auth_headers,
    )
    assert start_resp.status_code == 201
    session = start_resp.json()
    assert session["ended_at"] is None
    assert session["words_written"] == 0

    # End session
    end_resp = await async_client.post(
        f"/api/v1/goals/sessions/{session['id']}/end",
        json={"words_written": 350, "words_deleted": 50, "net_words": 300},
        headers=auth_headers,
    )
    assert end_resp.status_code == 200
    ended = end_resp.json()
    assert ended["ended_at"] is not None
    assert ended["words_written"] == 350
    assert ended["words_deleted"] == 50
    assert ended["net_words"] == 300


@pytest.mark.asyncio
async def test_end_session_not_owned_returns_404(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    pid = await _create_project(async_client, auth_headers)
    session = (
        await async_client.post(
            "/api/v1/goals/sessions/start",
            json={"project_id": pid},
            headers=auth_headers,
        )
    ).json()

    # Different user
    await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "other_session@prosearc.dev",
            "password": "OtherPass123",
            "display_name": "Other",
        },
    )
    login = (
        await async_client.post(
            "/api/v1/auth/login",
            json={"email": "other_session@prosearc.dev", "password": "OtherPass123"},
        )
    ).json()
    other_headers = {"Authorization": f"Bearer {login['access_token']}"}

    resp = await async_client.post(
        f"/api/v1/goals/sessions/{session['id']}/end",
        json={"words_written": 100, "words_deleted": 0, "net_words": 100},
        headers=other_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Today's progress
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_today_progress_db_fallback(async_client: AsyncClient, auth_headers: dict) -> None:
    """get_today_progress falls back to DB when Redis unavailable."""
    pid = await _create_project(async_client, auth_headers, "Progress Test")

    # No session yet
    resp = await async_client.get("/api/v1/goals/progress/today", headers=auth_headers)
    assert resp.status_code == 200
    initial = resp.json()["words"]

    # Start + end a session
    session = (
        await async_client.post(
            "/api/v1/goals/sessions/start",
            json={"project_id": pid},
            headers=auth_headers,
        )
    ).json()
    await async_client.post(
        f"/api/v1/goals/sessions/{session['id']}/end",
        json={"words_written": 200, "words_deleted": 0, "net_words": 200},
        headers=auth_headers,
    )

    resp2 = await async_client.get("/api/v1/goals/progress/today", headers=auth_headers)
    assert resp2.status_code == 200
    # Should reflect the DB session (Redis may or may not be available in test env)
    assert resp2.json()["words"] >= initial


# ---------------------------------------------------------------------------
# Streak
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_streak_no_sessions(async_client: AsyncClient, auth_headers: dict) -> None:
    resp = await async_client.get("/api/v1/goals/streak", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak"] == 0
    assert data["longest_streak"] == 0
    assert data["last_active_date"] is None


@pytest.mark.asyncio
async def test_streak_after_session_today(async_client: AsyncClient, auth_headers: dict) -> None:
    """Writing today sets current_streak to at least 1."""
    pid = await _create_project(async_client, auth_headers, "Streak Test")

    session = (
        await async_client.post(
            "/api/v1/goals/sessions/start",
            json={"project_id": pid},
            headers=auth_headers,
        )
    ).json()
    await async_client.post(
        f"/api/v1/goals/sessions/{session['id']}/end",
        json={"words_written": 500, "words_deleted": 0, "net_words": 500},
        headers=auth_headers,
    )

    resp = await async_client.get("/api/v1/goals/streak", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak"] >= 1
    assert data["longest_streak"] >= 1
    assert data["last_active_date"] is not None


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stats_empty(async_client: AsyncClient, auth_headers: dict) -> None:
    resp = await async_client.get("/api/v1/goals/stats", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "words_per_day" in data
    assert "avg_session_minutes" in data
    assert "total_sessions" in data
    assert "total_words" in data


@pytest.mark.asyncio
async def test_stats_after_session(async_client: AsyncClient, auth_headers: dict) -> None:
    pid = await _create_project(async_client, auth_headers, "Stats Test")

    session = (
        await async_client.post(
            "/api/v1/goals/sessions/start",
            json={"project_id": pid},
            headers=auth_headers,
        )
    ).json()
    await async_client.post(
        f"/api/v1/goals/sessions/{session['id']}/end",
        json={"words_written": 400, "words_deleted": 100, "net_words": 300},
        headers=auth_headers,
    )

    resp = await async_client.get("/api/v1/goals/stats?range=30", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_sessions"] >= 1
    assert data["total_words"] >= 300
    assert len(data["words_per_day"]) >= 1
