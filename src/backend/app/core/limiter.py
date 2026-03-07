"""
Rate limiter singleton — slowapi backed by Redis.

Usage in routers:

    from fastapi import Request
    from app.core.limiter import limiter, get_user_id_from_request

    # IP-scoped (default):
    @router.post("/endpoint")
    @limiter.limit("5/minute")
    async def endpoint(request: Request, ...):
        ...

    # User-scoped:
    @router.post("/endpoint")
    @limiter.limit("10/hour", key_func=get_user_id_from_request)
    async def endpoint(request: Request, ...):
        ...

Note: every decorated endpoint MUST include `request: Request` as a parameter.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings


def get_user_id_from_request(request: "Request") -> str:  # type: ignore[name-defined]  # noqa: F821
    """Extract user ID from JWT for per-user rate limiting, falling back to IP.

    Decodes the JWT without hitting the database — used only for key extraction,
    not for authentication.
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from jose import JWTError, jwt as _jwt

            settings = get_settings()
            raw = _jwt.decode(auth[7:], settings.jwt_secret, algorithms=["HS256"])
            sub = raw.get("sub")
            if sub:
                return f"user:{sub}"
        except (JWTError, Exception):
            pass
    return get_remote_address(request)


_settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_settings.redis_url,
)
