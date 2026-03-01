# Phase 1a: Foundation & Infrastructure — Task Checklist

**Duration:** Weeks 1–3  
**Goal:** Repo scaffolding, Docker dev environment, auth, core DB schema, CI, and a deployable skeleton.

---

## Backend Tasks

- [ ] Initialize FastAPI project under `src/backend/` with structure from architecture doc
- [ ] Set up SQLAlchemy 2.0 async engine + session management (`app/core/db.py`)
- [ ] Set up Alembic for migrations (`src/backend/migrations/`)
- [ ] Create base model class with id (UUID), created_at, updated_at (`app/core/models.py`)
- [ ] Implement EventBus class — sync pub/sub (`app/core/events.py`)
- [ ] Implement GCS/MinIO storage abstraction — upload, download, signed URLs (`app/core/storage.py`)
- [ ] Create initial migration: `users`, `teams`, `team_members` tables
- [ ] Implement identity module:
  - [ ] User registration (email + password, bcrypt hashing)
  - [ ] Login endpoint (returns JWT access + refresh tokens)
  - [ ] Token refresh endpoint
  - [ ] Google OAuth2 flow (redirect → callback → JWT)
  - [ ] `GET /users/me` + `PATCH /users/me`
  - [ ] Auth dependency injection (`app/core/auth.py` — `get_current_user`)
- [ ] Set up Celery with Redis broker, define 3 queues (default, ai, export)
- [ ] Health check endpoint (`GET /health`)
- [ ] Structured logging with structlog
- [ ] Pytest configuration with async fixtures, factory-boy for test data
- [ ] Create `pyproject.toml` with all dependencies and dev extras
- [ ] Create `Dockerfile` (multi-stage: build → slim runtime with uvicorn)
- [ ] Pydantic-settings for environment config management

## Frontend Tasks

- [ ] Initialize React 18 + Vite + TypeScript project under `src/frontend/`
- [ ] Set up Tailwind CSS
- [ ] Set up shadcn/ui (or Radix UI primitives)
- [ ] Set up React Router v6 with route structure:
  - `/` — landing page (stub)
  - `/login` — login form
  - `/register` — registration form
  - `/dashboard` — protected, project list (stub)
- [ ] Auth flows:
  - [ ] Registration form → API call → redirect to dashboard
  - [ ] Login form → API call → store tokens
  - [ ] Google OAuth button → redirect flow → callback handler
  - [ ] Token refresh interceptor (axios/fetch wrapper)
  - [ ] Protected route wrapper (redirect to login if no token)
- [ ] API client layer (`src/api/client.ts`) — axios or fetch wrapper with auth headers, base URL config
- [ ] Global state setup — Zustand store for auth state (user, tokens)
- [ ] TanStack Query setup for server state
- [ ] Basic layout shell: sidebar (collapsible), main content area, top bar with user menu
- [ ] Landing page stub (hero section, feature highlights placeholder)

## Infrastructure / Fullstack Tasks

- [ ] `docker-compose.yml` with all services:
  - [ ] PostgreSQL 16 (with ltree extension enabled via init script)
  - [ ] Redis 7
  - [ ] MinIO (S3-compatible, for GCS emulation)
  - [ ] Backend (FastAPI + uvicorn, volume-mounted for hot-reload)
  - [ ] Celery worker (single worker, all queues)
  - [ ] Frontend (Vite dev server)
- [ ] `.env.example` with all environment variables documented
- [ ] GitHub Actions CI workflow:
  - [ ] Backend: install → ruff check → mypy → pytest (with Postgres + Redis services)
  - [ ] Frontend: install → eslint → tsc --noEmit → vitest
  - [ ] Trigger: push to main, PRs
- [ ] Seed script (`src/backend/scripts/seed.py`) — creates test user, sample data
- [ ] MinIO bucket auto-creation on startup (init script or entrypoint)
- [ ] `README.md` with setup instructions

## Definition of Done

- [ ] `docker compose up` starts all services, app accessible at localhost:3000
- [ ] User can register with email, log in, receive JWT, see protected dashboard
- [ ] Google OAuth login works end-to-end
- [ ] CI passes on main branch
- [ ] Alembic migrations run cleanly from scratch
- [ ] EventBus pub/sub works (smoke test: publish → handler fires)
- [ ] GCS/MinIO upload/download works
- [ ] All tests pass
