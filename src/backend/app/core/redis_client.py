"""
Async Redis client dependency and token revocation helpers.

Usage:
    from typing import Annotated
    from fastapi import Depends
    from app.core.redis_client import get_redis, revoke_token, is_token_revoked
    import redis.asyncio as aioredis

    @router.post("/endpoint")
    async def endpoint(redis: Annotated[aioredis.Redis, Depends(get_redis)]):
        ...
"""

from collections.abc import AsyncGenerator
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends

from app.core.config import get_settings


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:  # type: ignore[type-arg]
    """FastAPI dependency — yields an aioredis client, closed after the request."""
    settings = get_settings()
    client: aioredis.Redis = aioredis.from_url(  # type: ignore[type-arg]
        settings.redis_url, decode_responses=True
    )
    try:
        yield client
    finally:
        await client.aclose()


async def revoke_token(jti: str, redis: aioredis.Redis, ttl_seconds: int) -> None:  # type: ignore[type-arg]
    """Add a refresh token JTI to the Redis revocation list with TTL."""
    await redis.setex(f"revoked_jti:{jti}", ttl_seconds, "1")


async def is_token_revoked(jti: str, redis: aioredis.Redis) -> bool:  # type: ignore[type-arg]
    """Return True if the given refresh token JTI has been revoked."""
    result = await redis.get(f"revoked_jti:{jti}")
    return result is not None


# Convenience type alias
RedisDep = Annotated[aioredis.Redis, Depends(get_redis)]  # type: ignore[type-arg]
