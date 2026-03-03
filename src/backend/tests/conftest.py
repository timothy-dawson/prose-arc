"""
Pytest configuration and shared fixtures for the backend test suite.

Fixtures provided:
  - engine_test: sync session-scoped fixture that creates the test schema once
  - db_session:  per-test async session with automatic rollback (NullPool — fresh connection per test)
  - async_client: httpx AsyncClient with the FastAPI test app
  - test_user:   a User instance already persisted to the test DB
  - auth_headers: Bearer token for test_user
"""

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.db import Base, get_db
from app.main import app
from app.modules.identity.models import User

settings = get_settings()

# ---------------------------------------------------------------------------
# Test database — same Postgres instance, separate test DB.
# ---------------------------------------------------------------------------
_db_base, _, _ = settings.database_url.rpartition("/prosearc")
TEST_DATABASE_URL = f"{_db_base}/prosearc_test"


@pytest.fixture(scope="session")
def engine_test():
    """Session-scoped SYNC fixture: creates the test schema once, tears it down after."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)

    async def _setup() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            # Seed export templates (normally done by Alembic migration 0006)
            import json as _json
            from sqlalchemy import text as _text
            _tmpl_sql = _text(
                "INSERT INTO export_templates (id, name, format, config, is_default)"
                " VALUES (gen_random_uuid(), :name, :fmt, CAST(:cfg AS jsonb), :is_default)"
            )
            _templates = [
                {"name": "Manuscript Submission", "fmt": "docx", "is_default": True, "cfg": _json.dumps({"font_family": "Times New Roman", "font_size": 12, "line_spacing": 2.0, "margin_top": 1.0, "margin_bottom": 1.0, "margin_left": 1.0, "margin_right": 1.0, "scene_separator": "#", "header_text": "{title}", "page_numbers": True, "chapter_break": True})},
                {"name": "Paperback", "fmt": "pdf", "is_default": True, "cfg": _json.dumps({"font_family": "Georgia", "font_size": 11, "line_spacing": 1.5, "margin_top": 0.75, "margin_bottom": 0.75, "margin_left": 0.75, "margin_right": 0.75, "scene_separator": "* * *", "header_text": "{title}", "page_numbers": True, "chapter_break": True})},
                {"name": "Ebook", "fmt": "epub", "is_default": True, "cfg": _json.dumps({"font_family": "Arial", "font_size": 12, "line_spacing": 1.5, "margin_top": 0.5, "margin_bottom": 0.5, "margin_left": 0.5, "margin_right": 0.5, "scene_separator": "* * *", "header_text": "", "page_numbers": False, "chapter_break": True})},
            ]
            for _t in _templates:
                await conn.execute(_tmpl_sql, _t)

    async def _teardown() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(_setup())
    yield engine
    asyncio.run(_teardown())


@pytest_asyncio.fixture
async def db_session(engine_test) -> AsyncGenerator[AsyncSession, None]:  # type: ignore[no-untyped-def]
    """Per-test async session.

    NullPool ensures each test gets a brand-new connection in its own event
    loop, so there are no cross-loop asyncpg errors.  The outer transaction
    is rolled back after yield so every test starts with a clean slate.
    """
    async with engine_test.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


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


@pytest_asyncio.fixture
async def auth_headers(async_client: AsyncClient, test_user: User) -> dict[str, str]:
    """Bearer token headers for the test_user, obtained via the login endpoint."""
    resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "test@prosearc.dev", "password": "TestPass123"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
