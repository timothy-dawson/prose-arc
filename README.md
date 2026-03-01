# Prose Arc

> A unified novel-writing platform — plotting, writing, AI assistance, collaboration, formatting, and publishing in one app.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | FastAPI (Python 3.12) + SQLAlchemy 2.0 async |
| Database | PostgreSQL 16 (with ltree) |
| Cache / Queue | Redis 7 |
| Async Tasks | Celery (queues: default, ai, export) |
| Object Storage | MinIO (local dev) / Google Cloud Storage (prod) |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 4.x+
- [Node.js](https://nodejs.org/) 20+ (for frontend development outside Docker)
- [Python](https://www.python.org/) 3.12+ (for backend development outside Docker)

## Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/your-org/prose-arc.git
cd prose-arc

# 2. Create your local .env
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to a random string:
# openssl rand -hex 32

# 3. Start all services
docker compose up -d

# 4. Run database migrations
docker compose exec backend alembic upgrade head

# 5. (Optional) Seed test data
docker compose exec backend python scripts/seed.py
```

### Service URLs

| Service | URL | Credentials |
|---------|-----|------------|
| Frontend (app) | http://localhost:3100 | — |
| Backend API | http://localhost:8100 | — |
| API Docs (Swagger) | http://localhost:8100/docs | — |
| MinIO Console | http://localhost:9101 | minioadmin / minioadmin |
| PostgreSQL | localhost:5533 | prosearc / prosearc |
| Redis | localhost:6480 | — |

## Development

### Backend

```bash
cd src/backend

# Install dependencies (uses pip + pyproject.toml)
pip install -e ".[dev]"

# Run locally (outside Docker)
uvicorn app.main:app --reload

# Run tests
pytest                        # all tests
pytest -x --tb=short          # stop on first failure
pytest -m "not integration"   # skip tests requiring external services

# Lint + type-check
ruff check .
mypy .
ruff format .
```

### Frontend

```bash
cd src/frontend

# Install dependencies
npm install

# Run dev server locally (outside Docker)
npm run dev

# Run tests
npm test              # vitest
npm run test:watch    # watch mode

# Lint + type-check
npm run lint
npm run typecheck
```

### Database Migrations

```bash
cd src/backend

# Apply all pending migrations
alembic upgrade head

# Create a new migration (after changing SQLAlchemy models)
alembic revision --autogenerate -m "describe what changed"

# Rollback last migration
alembic downgrade -1

# View migration history
alembic history
```

## Project Structure

```
prose-arc/
├── docs/                      # Architecture, implementation plan, research docs
├── src/
│   ├── backend/               # FastAPI application
│   │   ├── app/
│   │   │   ├── core/          # Shared kernel: auth, db, events, storage, models
│   │   │   ├── modules/       # Bounded-context modules (identity, manuscript, ...)
│   │   │   ├── api/v1/        # Thin FastAPI routers
│   │   │   ├── tasks/         # Celery task definitions
│   │   │   └── main.py        # App entrypoint
│   │   ├── migrations/        # Alembic migrations
│   │   ├── tests/
│   │   ├── scripts/           # seed.py, init-db.sql, init-minio.sh
│   │   └── pyproject.toml
│   └── frontend/              # React SPA
│       ├── src/
│       │   ├── api/           # axios client + API functions
│       │   ├── components/    # Shared UI components
│       │   ├── features/      # Feature modules (auth, dashboard, ...)
│       │   ├── hooks/         # Custom React hooks
│       │   ├── pages/         # Route-level page components
│       │   ├── stores/        # Zustand stores
│       │   └── lib/           # Utilities
│       └── package.json
├── .github/workflows/         # CI/CD
├── docker-compose.yml         # Local dev environment
├── .env.example               # Environment variable template
└── README.md
```

## Implementation Phases

| Phase | Name | Status |
|-------|------|--------|
| **1a** | Foundation & Infrastructure | In progress |
| **1b** | Core Editor & Manuscript Management | Pending |
| **1c** | Worldbuilding Codex & Outlining | Pending |
| **1d** | Versioning, Goals & Focus Mode | Pending |
| **1e** | Export, Billing & Polish | Pending |
| **1f** | MVP Hardening & Beta Launch | Pending |
| **2a** | AI-Assisted Writing | Pending |
| ... | ... | ... |

See `docs/writing-app-implementation-plan.md` for the full plan.
