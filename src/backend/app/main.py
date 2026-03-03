from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
logger = structlog.get_logger(__name__)


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

# SessionMiddleware must be added before CORSMiddleware.
# Required by authlib's Starlette OAuth client to store the OAuth state nonce
# during the Google redirect round-trip.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.jwt_secret,
    session_cookie="prosearc_session",
    max_age=600,        # 10 minutes — only lives during the OAuth redirect
    https_only=settings.is_production,
    same_site="lax",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.api.v1.health import router as health_router  # noqa: E402
from app.modules.identity.router import router as identity_router  # noqa: E402
from app.modules.manuscript.router import router as manuscript_router  # noqa: E402
from app.modules.codex.router import router as codex_router  # noqa: E402
from app.modules.plotting.router import router as plotting_router  # noqa: E402

app.include_router(health_router)
app.include_router(identity_router, prefix="/api/v1")
app.include_router(manuscript_router, prefix="/api/v1")
app.include_router(codex_router, prefix="/api/v1")
app.include_router(plotting_router, prefix="/api/v1")
