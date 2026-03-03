"""
Goals service — writing goals CRUD, session tracking, streak calculation, and stats.

Redis live counter: wc:{user_id}:{YYYY-MM-DD} → incremented on session end.
TTL: 48 hours. Fallback to DB if Redis unavailable.
"""

import datetime
import uuid
from collections import defaultdict

import structlog
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.goals.models import Goal, WritingSession
from app.modules.goals.schemas import (
    DailyWordCount,
    GoalCreate,
    GoalStats,
    GoalUpdate,
    StreakRead,
    WritingSessionEnd,
)

logger = structlog.get_logger(__name__)

_REDIS_KEY_PREFIX = "wc"
_REDIS_TTL = 48 * 3600  # 48 hours


class GoalsService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Redis helpers
    # -------------------------------------------------------------------------

    def _redis_key(self, user_id: uuid.UUID, date: datetime.date) -> str:
        return f"{_REDIS_KEY_PREFIX}:{user_id}:{date.isoformat()}"

    async def _redis_incrby(self, user_id: uuid.UUID, words: int) -> None:
        """Increment today's Redis word counter. Silently ignores errors."""
        try:
            import redis.asyncio as aioredis

            from app.core.config import get_settings

            settings = get_settings()
            r = aioredis.from_url(settings.redis_url, decode_responses=True)
            key = self._redis_key(user_id, datetime.date.today())
            async with r:
                await r.incrby(key, words)
                await r.expire(key, _REDIS_TTL)
        except Exception as exc:
            logger.warning("redis_incrby_failed", error=str(exc))

    async def _redis_get_today(self, user_id: uuid.UUID) -> int | None:
        """Read today's word count from Redis. Returns None on miss/error."""
        try:
            import redis.asyncio as aioredis

            from app.core.config import get_settings

            settings = get_settings()
            r = aioredis.from_url(settings.redis_url, decode_responses=True)
            key = self._redis_key(user_id, datetime.date.today())
            async with r:
                val = await r.get(key)
            return int(val) if val is not None else None
        except Exception:
            return None

    # -------------------------------------------------------------------------
    # Goals CRUD
    # -------------------------------------------------------------------------

    async def list_goals(self, user_id: uuid.UUID) -> list[Goal]:
        result = await self._db.execute(
            select(Goal)
            .where(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_goal(self, user_id: uuid.UUID, data: GoalCreate) -> Goal:
        goal = Goal(
            user_id=user_id,
            project_id=data.project_id,
            goal_type=data.goal_type,
            target_words=data.target_words,
            deadline=data.deadline,
        )
        self._db.add(goal)
        await self._db.flush()
        await self._db.refresh(goal)
        logger.info("goal_created", goal_id=str(goal.id), type=data.goal_type)
        return goal

    async def _get_goal(self, goal_id: uuid.UUID, user_id: uuid.UUID) -> Goal:
        goal = await self._db.get(Goal, goal_id)
        if not goal or goal.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
            )
        return goal

    async def update_goal(
        self, goal_id: uuid.UUID, user_id: uuid.UUID, data: GoalUpdate
    ) -> Goal:
        goal = await self._get_goal(goal_id, user_id)
        if data.target_words is not None:
            goal.target_words = data.target_words
        if data.deadline is not None:
            goal.deadline = data.deadline
        await self._db.flush()
        await self._db.refresh(goal)
        return goal

    async def delete_goal(self, goal_id: uuid.UUID, user_id: uuid.UUID) -> None:
        goal = await self._get_goal(goal_id, user_id)
        await self._db.delete(goal)
        await self._db.flush()
        logger.info("goal_deleted", goal_id=str(goal_id))

    # -------------------------------------------------------------------------
    # Writing sessions
    # -------------------------------------------------------------------------

    async def start_session(
        self, user_id: uuid.UUID, project_id: uuid.UUID
    ) -> WritingSession:
        session = WritingSession(
            user_id=user_id,
            project_id=project_id,
            started_at=datetime.datetime.now(datetime.timezone.utc),
        )
        self._db.add(session)
        await self._db.flush()
        await self._db.refresh(session)
        logger.info(
            "writing_session_started",
            session_id=str(session.id),
            project_id=str(project_id),
        )
        return session

    async def end_session(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: WritingSessionEnd,
    ) -> WritingSession:
        session = await self._db.get(WritingSession, session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
            )
        session.ended_at = datetime.datetime.now(datetime.timezone.utc)
        session.words_written = data.words_written
        session.words_deleted = data.words_deleted
        session.net_words = data.net_words
        await self._db.flush()
        await self._db.refresh(session)

        # Increment Redis live counter for today
        if data.net_words > 0:
            await self._redis_incrby(user_id, data.net_words)

        logger.info(
            "writing_session_ended",
            session_id=str(session_id),
            net_words=data.net_words,
        )
        return session

    # -------------------------------------------------------------------------
    # Streak calculation
    # -------------------------------------------------------------------------

    async def get_streak(self, user_id: uuid.UUID) -> StreakRead:
        """
        Calculate writing streak based on daily sessions.

        A day counts if the user completed at least one session with net_words > 0.
        Streak resets if a day is missed.
        """
        # Get user's daily goal (if any)
        goal_result = await self._db.execute(
            select(Goal).where(
                Goal.user_id == user_id,
                Goal.goal_type == "daily",
            )
        )
        daily_goal = goal_result.scalar_one_or_none()
        daily_target = daily_goal.target_words if daily_goal else 1

        # Aggregate net_words per day for the last 365 days
        cutoff = datetime.date.today() - datetime.timedelta(days=365)
        result = await self._db.execute(
            select(
                func.date(WritingSession.started_at).label("day"),
                func.sum(WritingSession.net_words).label("total_words"),
            )
            .where(
                WritingSession.user_id == user_id,
                WritingSession.ended_at.isnot(None),
                func.date(WritingSession.started_at) >= cutoff,
            )
            .group_by(func.date(WritingSession.started_at))
            .order_by(func.date(WritingSession.started_at).desc())
        )
        rows = result.all()

        if not rows:
            return StreakRead(current_streak=0, longest_streak=0, last_active_date=None)

        # Build a set of days that met the goal
        active_days: set[datetime.date] = {
            row.day for row in rows if (row.total_words or 0) >= daily_target
        }
        last_active = max(active_days) if active_days else None

        # Count current streak (consecutive days from today backwards)
        current_streak = 0
        check_date = datetime.date.today()
        while check_date in active_days:
            current_streak += 1
            check_date -= datetime.timedelta(days=1)

        # Count longest streak
        longest_streak = 0
        run = 0
        sorted_days = sorted(active_days)
        for i, day in enumerate(sorted_days):
            if i == 0:
                run = 1
            elif (sorted_days[i] - sorted_days[i - 1]).days == 1:
                run += 1
            else:
                run = 1
            longest_streak = max(longest_streak, run)

        return StreakRead(
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_active_date=last_active,
        )

    # -------------------------------------------------------------------------
    # Stats
    # -------------------------------------------------------------------------

    async def get_stats(self, user_id: uuid.UUID, range_days: int = 30) -> GoalStats:
        cutoff = datetime.date.today() - datetime.timedelta(days=range_days)
        result = await self._db.execute(
            select(
                func.date(WritingSession.started_at).label("day"),
                func.sum(WritingSession.net_words).label("total_words"),
            )
            .where(
                WritingSession.user_id == user_id,
                WritingSession.ended_at.isnot(None),
                func.date(WritingSession.started_at) >= cutoff,
            )
            .group_by(func.date(WritingSession.started_at))
            .order_by(func.date(WritingSession.started_at))
        )
        rows = result.all()

        words_per_day = [
            DailyWordCount(date=row.day, words=int(row.total_words or 0))
            for row in rows
        ]

        # Average session length
        duration_result = await self._db.execute(
            select(
                func.count(WritingSession.id),
                func.avg(
                    func.extract(
                        "epoch",
                        WritingSession.ended_at - WritingSession.started_at,
                    )
                ),
            ).where(
                WritingSession.user_id == user_id,
                WritingSession.ended_at.isnot(None),
                func.date(WritingSession.started_at) >= cutoff,
            )
        )
        total_sessions, avg_seconds = duration_result.one()
        avg_minutes = float(avg_seconds or 0) / 60

        total_words = sum(d.words for d in words_per_day)

        return GoalStats(
            words_per_day=words_per_day,
            avg_session_minutes=round(avg_minutes, 1),
            total_sessions=int(total_sessions or 0),
            total_words=total_words,
        )

    async def get_today_progress(self, user_id: uuid.UUID) -> int:
        """Return today's net word count. Tries Redis first, falls back to DB."""
        cached = await self._redis_get_today(user_id)
        if cached is not None:
            return cached

        # Fallback: sum today's sessions from DB
        today = datetime.date.today()
        result = await self._db.execute(
            select(func.coalesce(func.sum(WritingSession.net_words), 0)).where(
                WritingSession.user_id == user_id,
                func.date(WritingSession.started_at) == today,
                WritingSession.ended_at.isnot(None),
            )
        )
        return result.scalar_one()
