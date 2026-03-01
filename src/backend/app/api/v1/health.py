from typing import Any

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal

router = APIRouter(tags=["health"])
logger = structlog.get_logger(__name__)
settings = get_settings()


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """
    Health check endpoint.

    Verifies connectivity to PostgreSQL and Redis.
    Returns 200 if all systems are operational.
    """
    checks: dict[str, str] = {}

    # Check Postgres
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        logger.error("health_check_postgres_failed", error=str(exc))
        checks["postgres"] = "error"

    # Check Redis
    try:
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as exc:
        logger.error("health_check_redis_failed", error=str(exc))
        checks["redis"] = "error"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"

    return {
        "status": overall,
        "version": "0.1.0",
        "checks": checks,
    }
