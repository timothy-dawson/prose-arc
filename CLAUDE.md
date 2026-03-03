# CLAUDE.md — Prose Arc Development Guide

## Project Overview

**Prose Arc** is a novel/book writing SaaS — a unified tool covering plotting → writing → AI assistance → collaboration → formatting → publishing. Think "Scrivener + Plottr + Novelcrafter + Atticus in one app."

- **Domain:** prosearc.com
- **Pricing:** One-time purchase (core) + optional AI subscription
- **Target:** Fiction/nonfiction authors, self-publishers, writing teams

## Documentation

Read these before starting any work:

| Doc | Purpose | Location |
|-----|---------|----------|
| **Architecture** | Tech stack, modules, DB schema, API design, infra | `docs/writing-app-architecture.md` |
| **Implementation Plan** | 12 phases, per-phase tasks by role, dependencies, timeline | `docs/writing-app-implementation-plan.md` |
| **Market Research** | Competitors, feature gaps, pricing analysis | `docs/writing-software-market-report.md` |

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Radix UI/shadcn
- **Editor:** TipTap (React-first ProseMirror wrapper; rich text, markdown shortcuts, collaborative editing via @tiptap/extension-collaboration)
- **Backend:** FastAPI (Python 3.12+) + SQLAlchemy 2.0 (async) + Alembic
- **Async Tasks:** Celery + Redis broker (3 queues: default, ai, export)
- **Database:** PostgreSQL 16 (with ltree extension)
- **Cache/Realtime:** Redis 7
- **Object Storage:** Google Cloud Storage (GCS) — MinIO for local dev
- **Desktop:** Tauri (later phase)
- **Cloud:** Google Cloud Platform (Cloud Run, Cloud SQL, Memorystore, GCS)

## Architecture

**Modular monolith** — 11 bounded-context modules in a single deployable:

```
identity | manuscript | codex | plotting | versioning | ai | collab | export | publishing | goals | notifications
```

Key rules:
- Each module owns its DB tables and internal logic
- No cross-module direct DB joins — use module query interfaces
- Modules communicate via in-process synchronous event bus
- Async side effects (AI, export) go through Celery tasks
- See `docs/writing-app-architecture.md` §2 for full module map

## Project Structure

```
prose-arc/
├── docs/                          # Architecture, implementation plan, research
├── src/
│   ├── backend/                   # FastAPI application
│   │   ├── app/
│   │   │   ├── core/              # Shared kernel (auth, events, db, storage, models)
│   │   │   ├── modules/           # Bounded context modules
│   │   │   │   ├── identity/
│   │   │   │   ├── manuscript/
│   │   │   │   ├── codex/
│   │   │   │   ├── plotting/
│   │   │   │   ├── versioning/
│   │   │   │   ├── ai/
│   │   │   │   ├── collab/
│   │   │   │   ├── export/
│   │   │   │   ├── publishing/
│   │   │   │   ├── goals/
│   │   │   │   └── notifications/
│   │   │   ├── api/v1/            # FastAPI routers (thin, delegate to modules)
│   │   │   ├── tasks/             # Celery task definitions
│   │   │   └── main.py            # App entrypoint
│   │   ├── migrations/            # Alembic
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   └── frontend/                  # React SPA
│       ├── src/
│       │   ├── components/
│       │   ├── features/          # Feature-based organization matching backend modules
│       │   ├── hooks/
│       │   ├── stores/            # Zustand stores
│       │   ├── api/               # API client layer
│       │   ├── lib/               # Utilities
│       │   └── App.tsx
│       ├── package.json
│       └── vite.config.ts
│
├── docker-compose.yml             # Local dev: Postgres, Redis, MinIO, backend, worker, frontend
├── docker-compose.prod.yml        # Production overrides
├── .github/workflows/             # CI/CD
├── CLAUDE.md                      # This file
└── README.md
```

## Local Development

### Prerequisites
- Docker Desktop (local orchestration)
- Node.js 20+ (frontend)
- Python 3.12+ (backend)

### Quick Start
```bash
# Start all services
docker compose up -d

# Backend: http://localhost:8100
# Frontend: http://localhost:3100
# MinIO (GCS emulator): http://localhost:9101 (admin/admin)
# Postgres: localhost:5533 (prosearc/prosearc)
# Redis: localhost:6480
```

### Docker Compose Services
| Service | Port | Purpose |
|---------|------|---------|
| `postgres` | 5533 | PostgreSQL 16 with ltree extension |
| `redis` | 6480 | Celery broker, cache, real-time state |
| `minio` | 9100/9101 | S3-compatible object storage (GCS emulator) |
| `backend` | 8100 | FastAPI with hot-reload |
| `worker` | — | Celery worker (all queues in dev) |
| `frontend` | 3100 | Vite dev server with HMR |

### Running Tests
```bash
# Backend
cd src/backend
pytest                    # all tests
pytest -x --tb=short      # stop on first failure
pytest tests/modules/manuscript/  # specific module

# Frontend
cd src/frontend
npm test                  # vitest
npm run test:watch        # watch mode
```

### Database Migrations
```bash
cd src/backend
alembic upgrade head      # apply all migrations
alembic revision --autogenerate -m "description"  # create new migration
alembic downgrade -1      # rollback last migration
```

## Implementation Phases

We're building in 12 phases. See `docs/writing-app-implementation-plan.md` for full details.

**Current phase: 1c — Worldbuilding Codex & Basic Outlining**

**Phase checklist:** `docs/phase-1c-checklist.md` — follow this for all 1c work. Check off tasks as completed.

Phase order:
1. **1a** (W1-3): Foundation — repo scaffold, Docker, auth, CI
2. **1b** (W4-7): Core editor + manuscript management
3. **1c** (W8-10): Codex + basic outlining
4. **1d** (W11-13): Versioning, goals, focus mode
5. **1e** (W14-16): Export, billing, polish
6. **1f** (W17-18): MVP hardening + beta launch
7. **2a** (W19-22): AI-assisted writing
8. **2b** (W23-25): Timelines, arcs, structure templates
9. **2c** (W26-28): Split editor, track changes, series
10. **2d** (W29-31): Desktop app (Tauri)
11. **3a** (W32-35): Real-time collaboration
12. **3b** (W36-38): Beta reader portal + publishing

## Coding Standards

### Backend (Python)
- **Formatter:** ruff format
- **Linter:** ruff check
- **Type checking:** mypy (strict mode)
- **Testing:** pytest + factory-boy + httpx (async test client)
- **Async:** Use async SQLAlchemy throughout — no sync DB calls
- **Naming:** snake_case everywhere, module prefixes on table names not needed (SQLAlchemy handles schemas)
- **API responses:** Always return Pydantic models, never raw dicts

### Frontend (TypeScript)
- **Formatter/Linter:** ESLint + Prettier
- **Testing:** Vitest + React Testing Library
- **State:** Zustand for global state, React Query (TanStack Query) for server state
- **Styling:** Tailwind CSS utility classes, component library via shadcn/ui
- **Naming:** camelCase for variables/functions, PascalCase for components, kebab-case for files

### General
- **Commits:** Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- **Branches:** `feat/description`, `fix/description`, `chore/description` off `main`
- **PRs:** Required for all changes. Must pass CI.

## Key Design Decisions

Refer to `docs/writing-app-architecture.md` Appendix B for the full decisions log. Highlights:

- **TipTap** over raw ProseMirror/Slate/Lexical — React-first API, ships all required extensions (subscript, superscript, alignment, table, colour), Yjs collaboration via `@tiptap/extension-collaboration` (Phase 3a). Raw ProseMirror abandoned due to Vite/ESM friction and maintenance overhead.
- **Delta-based versioning** with keyframes every 10 snapshots — 96% storage savings
- **Conditional compression:** < 64KB docs in JSONB, ≥ 64KB in zstd-compressed BYTEA
- **In-process event bus** — no message queues between modules (it's a monolith)
- **Yjs CRDT** for collaboration (Phase 3a) — state lives in Redis, resolved docs persist to Postgres
- **Tauri** over Electron for desktop — 10x smaller binary

## Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://prosearc:prosearc@localhost:5432/prosearc

# Redis
REDIS_URL=redis://localhost:6379/0

# Storage (MinIO in dev, GCS in prod)
STORAGE_BACKEND=minio  # or "gcs"
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=prosearc
GCS_BUCKET=prosearc-prod
GCS_CREDENTIALS_PATH=  # service account JSON path

# Auth
JWT_SECRET=dev-secret-change-in-prod
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CORE=price_...
STRIPE_PRICE_AI_STARTER=price_...
STRIPE_PRICE_AI_PRO=price_...

# AI (built-in credits)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# App
APP_ENV=development  # development | staging | production
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
```
