"""
Pytest configuration and shared fixtures for the backend test suite.

Fixtures provided:
  - engine_test: async SQLAlchemy engine pointed at a test database
  - db_session:  per-test async session with automatic rollback
  - async_client: httpx AsyncClient with the FastAPI test app
  - test_user:   a User instance already persisted to the test DB
"""

import asyncio
from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.db import Base, get_db
from app.main import app
from app.modules.identity.models import User

settings = get_settings()

# ---------------------------------------------------------------------------
# Test database — uses the same Postgres instance with a separate test DB.
# Override DATABASE_URL in .env or set PYTEST_DATABASE_URL to point elsewhere.
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = settings.database_url.replace("/prosearc", "/prosearc_test")


@pytest_asyncio.fixture(scope="session")
async def engine_test() -> AsyncGenerator[Any, None]:
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine_test: Any) -> AsyncGenerator[AsyncSession, None]:
    """Per-test DB session — rolls back all changes after each test."""
    session_factory = async_sessionmaker(bind=engine_test, expire_on_commit=False)
    async with session_factory() as session:
        async with session.begin():
            yield session
            await session.rollback()


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """httpx AsyncClient wired to the FastAPI app, with DB dependency overridden."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """A pre-created, active user for tests that require an existing account."""
    import bcrypt

    user = User(
        email="test@prosearc.dev",
        hashed_password=bcrypt.hashpw(b"TestPass123", bcrypt.gensalt()).decode(),
        display_name="Test User",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user
