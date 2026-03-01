# CLAUDE.md — Source Directory

## Permissions

You are the primary developer for Prose Arc. You have full autonomy to:

### ✅ Do freely (no confirmation needed)
- Create, edit, and refactor any file under `src/`
- Run any bash/shell command: `npm install`, `pip install`, `docker compose`, `pytest`, `alembic`, linting, formatting, builds, dev servers
- Create/modify Docker files, CI configs, environment configs
- Run database migrations (`alembic upgrade/downgrade`)
- Install packages and dependencies
- Run tests, linters, type checkers
- Git operations: `add`, `commit`, `push`, `pull`, `branch`, `merge`, `rebase`, `stash`
- Start/stop Docker containers
- Create directories and scaffold new modules
- Read any file in the repo

### ⚠️ Ask before doing
- **Deleting files or directories** (use `trash` or move to a backup first if unsure)
- **Dropping database tables or running destructive migrations** (downgrade is fine, DROP TABLE is not)
- **Modifying production configs** or anything in `docker-compose.prod.yml`
- **Changing environment variables** that affect external services (Stripe, OAuth, AI keys)
- **Force-pushing** to `main` branch
- **Any action that could cause data loss**

## Development Workflow

### Starting Work
1. Read the root `CLAUDE.md` for project context
2. Check which **phase** we're on (see `docs/writing-app-implementation-plan.md`)
3. Look at the phase's task list and pick up the next incomplete item
4. Create a feature branch: `git checkout -b feat/description`

### While Working
- Run tests frequently — don't let them pile up
- Keep commits small and atomic with conventional commit messages
- If something is unclear in the architecture doc, make a reasonable decision and document it with a code comment
- If a design decision feels significant (changes the architecture), note it for review

### Completing Work
- All tests pass (`pytest` + `npm test`)
- Linting clean (`ruff check` + `eslint`)
- Types clean (`mypy` + `tsc --noEmit`)
- Commit with descriptive message
- If on a feature branch, merge to main when complete

## Quick Commands

```bash
# Full stack
docker compose up -d              # start everything
docker compose down               # stop everything
docker compose logs -f backend    # tail backend logs
docker compose logs -f worker     # tail celery worker logs

# Backend
cd src/backend
pip install -e ".[dev]"           # install with dev deps
alembic upgrade head              # run migrations
pytest                            # run tests
ruff check . --fix                # lint + auto-fix
ruff format .                     # format
mypy app/                         # type check

# Frontend
cd src/frontend
npm install                       # install deps
npm run dev                       # start dev server
npm test                          # run tests
npm run lint                      # lint
npm run build                     # production build
npm run type-check                # tsc --noEmit

# Database
docker compose exec postgres psql -U prosearc -d prosearc  # connect to DB
```

## Module Development Pattern

When building a new module (e.g., `codex`):

### Backend
```
app/modules/codex/
├── __init__.py
├── models.py          # SQLAlchemy models (tables this module owns)
├── schemas.py         # Pydantic request/response schemas
├── service.py         # Business logic (called by API routes + event handlers)
├── events.py          # Event handlers (subscribe to events from other modules)
└── exceptions.py      # Module-specific exceptions
```

### API Route
```
app/api/v1/codex.py    # FastAPI router, thin layer — validates input, calls service, returns schema
```

### Celery Tasks
```
app/tasks/codex_tasks.py  # If module has async work
```

### Frontend
```
src/features/codex/
├── components/        # React components specific to codex
├── hooks/             # Custom hooks (useCodexEntries, useCodexEntry, etc.)
├── api.ts             # API client functions for codex endpoints
├── store.ts           # Zustand store slice (if needed beyond React Query)
├── types.ts           # TypeScript types matching backend schemas
└── index.ts           # Public exports
```

### Tests
```
src/backend/tests/modules/codex/
├── test_service.py
├── test_api.py
└── conftest.py        # Module-specific fixtures

src/frontend/src/features/codex/__tests__/
├── CodexList.test.tsx
└── CodexEntry.test.tsx
```

## Architecture Reminders

- **Event bus** is synchronous, in-process. Keep handlers fast. For heavy work, enqueue a Celery task.
- **No cross-module DB joins.** If `export` needs manuscript data, call `manuscript.service.get_documents()`, don't query `document_content` directly.
- **Storage tiering:** Current docs in Postgres. Snapshots/deltas/exports/images in GCS (MinIO locally). CRDT state in Redis.
- **Compression:** Docs < 64KB → JSONB column. Docs ≥ 64KB → zstd-compressed BYTEA column. Always extract plain text for search.
