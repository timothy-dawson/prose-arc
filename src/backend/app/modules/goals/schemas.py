"""
Goals module Pydantic schemas.
"""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class GoalCreate(BaseModel):
    goal_type: str = Field(pattern="^(daily|project|session)$")
    target_words: int = Field(ge=1)
    project_id: uuid.UUID | None = None
    deadline: datetime.date | None = None


class GoalUpdate(BaseModel):
    target_words: int | None = Field(default=None, ge=1)
    deadline: datetime.date | None = None


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID | None
    goal_type: str
    target_words: int
    deadline: datetime.date | None
    created_at: datetime.datetime


class DailyWordCount(BaseModel):
    date: datetime.date
    words: int


class GoalStats(BaseModel):
    words_per_day: list[DailyWordCount]
    avg_session_minutes: float
    total_sessions: int
    total_words: int


class StreakRead(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_date: datetime.date | None


class WritingSessionCreate(BaseModel):
    project_id: uuid.UUID


class WritingSessionEnd(BaseModel):
    words_written: int = Field(ge=0)
    words_deleted: int = Field(ge=0)
    net_words: int


class WritingSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID
    started_at: datetime.datetime
    ended_at: datetime.datetime | None
    words_written: int
    words_deleted: int
    net_words: int
    created_at: datetime.datetime


class TodayProgressRead(BaseModel):
    words: int
