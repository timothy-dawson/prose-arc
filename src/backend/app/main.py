import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import sentry_sdk
import structlog
import structlog.contextvars
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.logging import configure_logging

settings = get_settings()
logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Sentry — initialise before the app is created so all errors are captured
# ---------------------------------------------------------------------------
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    configure_logging()
    logger.info("prose_arc_starting", env=settings.app_env, version="0.1.0")
    yield
    logger.info("prose_arc_shutdown")


app = FastAPI(
    title="Prose Arc API",
    version="0.1.0",
    description="Novel writing SaaS — plotting, writing, AI, collaboration, export.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Middleware (added innermost → outermost; request passes outermost first)
# ---------------------------------------------------------------------------

# 1. Session (innermost) — required by authlib OAuth state nonce
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.jwt_secret,
    session_cookie="prosearc_session",
    max_age=600,
    https_only=settings.is_production,
    same_site="lax",
)

# 2. CORS — explicit method/header lists in place of ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


# 3. Request ID — echoes / generates X-Request-ID and binds it to structlog
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: "CallNext") -> Response:  # type: ignore[name-defined]
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        structlog.contextvars.unbind_contextvars("request_id")
        return response


app.add_middleware(RequestIDMiddleware)


# 4. Security headers (outermost — applied to every response)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: "CallNext") -> Response:  # type: ignore[name-defined]
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'"
        )
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.api.v1.health import router as health_router  # noqa: E402
from app.modules.billing.router import router as billing_router  # noqa: E402
from app.modules.codex.router import router as codex_router  # noqa: E402
from app.modules.export.router import router as export_router  # noqa: E402
from app.modules.goals.router import router as goals_router  # noqa: E402
from app.modules.identity.router import router as identity_router  # noqa: E402
from app.modules.manuscript.router import router as manuscript_router  # noqa: E402
from app.modules.notifications.router import router as notifications_router  # noqa: E402
from app.modules.plotting.router import router as plotting_router  # noqa: E402
from app.modules.versioning.router import router as versioning_router  # noqa: E402

app.include_router(health_router)
app.include_router(identity_router, prefix="/api/v1")
app.include_router(manuscript_router, prefix="/api/v1")
app.include_router(codex_router, prefix="/api/v1")
app.include_router(plotting_router, prefix="/api/v1")
app.include_router(versioning_router, prefix="/api/v1")
app.include_router(goals_router, prefix="/api/v1")
app.include_router(export_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
