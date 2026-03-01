"""
Seed script — creates a test user and sample team for local development.

Usage (inside the backend container or venv):
    python scripts/seed.py

Or via Docker Compose:
    docker compose exec backend python scripts/seed.py
"""

import asyncio
import sys
from pathlib import Path

# Make sure app is importable when running from scripts/
sys.path.insert(0, str(Path(__file__).parent.parent))

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.modules.identity.models import Team, TeamMember, TeamRole, User

settings = get_settings()

TEST_EMAIL = "test@prosearc.dev"
TEST_PASSWORD = "TestPass123"


async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with session_factory() as session:
        user = await _get_or_create_user(session)
        team = await _get_or_create_team(session, user)
        await session.commit()

    await engine.dispose()
    print(f"\n✓ Seed complete.")
    print(f"  User:  {TEST_EMAIL} / {TEST_PASSWORD}")
    print(f"  Team:  {team.name} (id: {team.id})")


async def _get_or_create_user(session: AsyncSession) -> User:
    result = await session.execute(select(User).where(User.email == TEST_EMAIL))
    user = result.scalar_one_or_none()

    if user:
        print(f"User already exists: {TEST_EMAIL}")
        return user

    user = User(
        email=TEST_EMAIL,
        hashed_password=bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt()).decode(),
        display_name="Test User",
        is_active=True,
        is_verified=True,
    )
    session.add(user)
    await session.flush()
    print(f"Created user: {TEST_EMAIL}")
    return user


async def _get_or_create_team(session: AsyncSession, owner: User) -> Team:
    result = await session.execute(select(Team).where(Team.owner_id == owner.id))
    team = result.scalar_one_or_none()

    if team:
        print(f"Team already exists: {team.name}")
        return team

    team = Team(name="My Writing Team", owner_id=owner.id)
    session.add(team)
    await session.flush()

    membership = TeamMember(team_id=team.id, user_id=owner.id, role=TeamRole.owner)
    session.add(membership)

    print(f"Created team: {team.name}")
    return team


if __name__ == "__main__":
    asyncio.run(seed())
