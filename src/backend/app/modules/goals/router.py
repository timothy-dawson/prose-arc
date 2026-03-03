"""
Goals module router — writing goals and session tracking endpoints.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db
from app.modules.goals.schemas import (
    GoalCreate,
    GoalRead,
    GoalStats,
    GoalUpdate,
    StreakRead,
    TodayProgressRead,
    WritingSessionCreate,
    WritingSessionEnd,
    WritingSessionRead,
)
from app.modules.goals.service import GoalsService
from app.modules.identity.models import User

router = APIRouter(tags=["goals"])


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------


@router.get("/goals", response_model=list[GoalRead])
async def list_goals(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[GoalRead]:
    svc = GoalsService(db)
    goals = await svc.list_goals(current_user.id)
    return [GoalRead.model_validate(g) for g in goals]


@router.post("/goals", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: GoalCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GoalRead:
    svc = GoalsService(db)
    goal = await svc.create_goal(current_user.id, data)
    return GoalRead.model_validate(goal)


@router.patch("/goals/{goal_id}", response_model=GoalRead)
async def update_goal(
    goal_id: uuid.UUID,
    data: GoalUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GoalRead:
    svc = GoalsService(db)
    goal = await svc.update_goal(goal_id, current_user.id, data)
    return GoalRead.model_validate(goal)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    svc = GoalsService(db)
    await svc.delete_goal(goal_id, current_user.id)


# ---------------------------------------------------------------------------
# Stats and streak
# ---------------------------------------------------------------------------


@router.get("/goals/stats", response_model=GoalStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    range: int = Query(default=30, ge=1, le=365, alias="range"),
) -> GoalStats:
    svc = GoalsService(db)
    return await svc.get_stats(current_user.id, range_days=range)


@router.get("/goals/streak", response_model=StreakRead)
async def get_streak(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StreakRead:
    svc = GoalsService(db)
    return await svc.get_streak(current_user.id)


@router.get("/goals/progress/today", response_model=TodayProgressRead)
async def get_today_progress(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TodayProgressRead:
    svc = GoalsService(db)
    words = await svc.get_today_progress(current_user.id)
    return TodayProgressRead(words=words)


# ---------------------------------------------------------------------------
# Writing sessions
# ---------------------------------------------------------------------------


@router.post(
    "/goals/sessions/start",
    response_model=WritingSessionRead,
    status_code=status.HTTP_201_CREATED,
)
async def start_session(
    data: WritingSessionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> WritingSessionRead:
    svc = GoalsService(db)
    session = await svc.start_session(current_user.id, data.project_id)
    return WritingSessionRead.model_validate(session)


@router.post(
    "/goals/sessions/{session_id}/end",
    response_model=WritingSessionRead,
)
async def end_session(
    session_id: uuid.UUID,
    data: WritingSessionEnd,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> WritingSessionRead:
    svc = GoalsService(db)
    session = await svc.end_session(session_id, current_user.id, data)
    return WritingSessionRead.model_validate(session)
