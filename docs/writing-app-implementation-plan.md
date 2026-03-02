# Prose Arc — Implementation Plan

> **Team:** 3 developers (1 Frontend, 1 Backend, 1 Fullstack)
> **Start Date:** Week 1 (assumed Monday start)
> **Architecture Reference:** `writing-app-architecture.md`
> **Last Updated:** 2026-02-28

---

## Table of Contents

1. [Phase Overview & Calendar](#1-phase-overview--calendar)
2. [Phase Details](#2-phase-details)
3. [Critical Path](#3-critical-path)
4. [Infrastructure Phases](#4-infrastructure-phases)
5. [Risk Register](#5-risk-register)
6. [Team Structure & Work Split](#6-team-structure--work-split)
7. [MVP Launch Criteria](#7-mvp-launch-criteria)

---

## 1. Phase Overview & Calendar

| Phase | Name | Duration | Calendar (Weeks) | Priority |
|-------|------|----------|-------------------|----------|
| **1a** | Foundation & Infrastructure | 3 weeks | W1–W3 | P0 |
| **1b** | Core Editor & Manuscript Management | 4 weeks | W4–W7 | P0 |
| **1c** | Worldbuilding Codex & Basic Outlining | 3 weeks | W8–W10 | P0 |
| **1d** | Versioning, Goals & Focus Mode | 3 weeks | W11–W13 | P0 |
| **1e** | Export, Billing & Polish | 3 weeks | W14–W16 | P0 |
| **1f** | MVP Hardening & Beta Launch | 2 weeks | W17–W18 | P0 |
| **2a** | AI-Assisted Writing | 4 weeks | W19–W22 | P1 |
| **2b** | Story Structure, Timelines & Arcs | 3 weeks | W23–W25 | P1 |
| **2c** | Split Editor, Track Changes & Series | 3 weeks | W26–W28 | P1 |
| **2d** | Desktop App (Tauri) | 3 weeks | W29–W31 | P1 |
| **3a** | Real-Time Collaboration | 4 weeks | W32–W35 | P2 |
| **3b** | Beta Reader Portal & Publishing | 3 weeks | W36–W38 | P2 |

**Total estimated timeline: ~38 weeks (~9.5 months)**

P0 (MVP): **18 weeks** → Public beta at ~4.5 months
P1 (Growth): **13 weeks** → Feature-complete at ~7.5 months
P2 (Moat): **7 weeks** → Full vision at ~9.5 months

---

## 2. Phase Details

---

### Phase 1a: Foundation & Infrastructure (W1–W3)

**Goal:** Repo scaffolding, CI/CD, dev environment, auth, core DB schema, and a deployable skeleton.

#### Features / Modules Built
- Project skeleton: monorepo with `backend/` (FastAPI) and `frontend/` (React + Vite)
- Shared kernel: `core/auth.py`, `core/events.py`, `core/db.py`, `core/storage.py`, `core/models.py`
- Identity module: registration, login, JWT auth, OAuth (Google), user profile CRUD
- Docker Compose local dev environment (Postgres, Redis, FastAPI, Celery worker, React dev server)
- CI pipeline (GitHub Actions): lint, type-check, test, build

#### Key Technical Tasks

**Backend (BE):**
- Initialize FastAPI project with project structure from architecture doc
- Set up SQLAlchemy 2.0 async + Alembic migrations
- Create initial migration: `users`, `teams`, `team_members` tables
- Implement JWT auth (access + refresh tokens), OAuth2 Google flow
- Implement EventBus class (sync pub/sub)
- GCS storage abstraction (upload, download, signed URLs)
- Set up Celery with Redis broker, 3 queue definitions
- Health check endpoint, structured logging (structlog)
- Pytest fixtures, factory-boy for test data

**Frontend (FE):**
- Initialize React 18 + Vite + TypeScript project
- Set up Tailwind CSS + component library (Radix UI or shadcn/ui)
- Routing (React Router v6)
- Auth flows: register, login, OAuth redirect, token refresh interceptor
- API client layer (axios/fetch wrapper with auth headers)
- Global state management (Zustand)
- Basic layout shell: sidebar, main content area, top bar
- Landing page stub

**Fullstack (FS):**
- Docker Compose for local dev (Postgres 16, Redis 7, app, worker)
- GitHub Actions CI: backend (pytest, mypy, ruff) + frontend (vitest, eslint, tsc)
- Dockerfile for backend (multi-stage, uvicorn)
- Environment config management (.env, pydantic-settings)
- Seed script for dev data
- GCS emulator or local minio for dev

#### Dependencies
- None (first phase)

#### Definition of Done
- [ ] `docker compose up` starts all services, app accessible at localhost:3000
- [ ] User can register with email, log in, receive JWT, see protected dashboard
- [ ] Google OAuth login works end-to-end
- [ ] CI passes on main branch; PRs require green CI
- [ ] Alembic migrations run cleanly from scratch
- [ ] EventBus pub/sub works with a smoke test (publish → handler fires)
- [ ] GCS upload/download works (against emulator or real bucket)

#### Effort: 3 team-weeks (9 person-weeks)

---

### Phase 1b: Core Editor & Manuscript Management (W4–W7)

**Goal:** TipTap editor with the binder tree. Authors can create projects, organize chapters/scenes, and write.

#### Features / Modules Built
- Manuscript module: projects CRUD, binder tree (hierarchical), document content save/load
- TipTap editor: block editing, markdown shortcuts, inline formatting (bold/italic/underline/strikethrough/highlight/subscript/superscript), headings, text alignment, blockquotes, lists, code blocks, links, images, tables, text colour
- Binder/tree view: hierarchical sidebar, drag-drop reorder, create/rename/delete nodes
- Auto-save (debounced, 3-second idle)
- Full-text search within project (Postgres tsvector)
- Word count per document and project (denormalized, updated on save)

#### Key Technical Tasks

**Backend (BE):**
- Migration: `projects`, `binder_nodes` (with ltree extension), `document_content` tables
- CRUD API: `/projects`, `/projects/{id}/binder`, `/projects/{id}/documents/{node_id}`
- Bulk reorder endpoint for drag-drop (`POST /binder/reorder`)
- Content save endpoint: accept TipTap JSON (ProseMirror-compatible), extract plain text, compute word count
- Conditional compression logic (< 64KB → JSONB, ≥ 64KB → zstd BYTEA)
- Full-text search endpoint (`GET /projects/{id}/search?q=...`) using tsvector + GIN index
- Celery task: `update_word_counts` (fires on document save event)
- Celery task: `reindex_search` (fires on document save event)

**Frontend (FE):**
- TipTap integration: `useEditor` hook, StarterKit + extension bundle, `onUpdate` autosave
- Editor toolbar: full wireframe toolbar (history, marks, headings, alignment, lists, code, link, image, table, colour)
- Binder tree component: recursive tree with drag-drop (dnd-kit or similar)
- Project dashboard: list projects, create new, open existing
- Document view: load content on binder node click, auto-save on change
- Search panel: project-wide full-text search with result highlighting
- Word count display in status bar

**Fullstack (FS):**
- TipTap ↔ API integration: save/load cycle, optimistic updates
- Editor state management: dirty tracking, save indicator
- Binder tree state sync: optimistic reorder with server reconciliation
- Performance: lazy-load document content (don't fetch all docs on tree load)
- Integration tests: create project → add chapters → write → save → reload → verify content

#### Dependencies
- Phase 1a (auth, DB, project structure)

#### Definition of Done
- [ ] User creates a project, adds folder/chapter/scene hierarchy via binder tree
- [ ] Drag-drop reorder works in binder tree, persists to server
- [ ] TipTap editor loads, saves, and restores content correctly
- [ ] Markdown shortcuts work (e.g., `**bold**`, `# heading`, `> quote`)
- [ ] Auto-save triggers after 3s idle, visual indicator shows save status
- [ ] Word count updates in real-time in status bar
- [ ] Search returns results across all documents in project
- [ ] Documents > 64KB compress and decompress transparently
- [ ] 200ms max API response time for document load

#### Effort: 4 team-weeks (12 person-weeks)

---

### Phase 1c: Worldbuilding Codex & Basic Outlining (W8–W10)

**Goal:** Structured worldbuilding entries and per-scene synopsis cards with kanban view.

#### Features / Modules Built
- Codex module: Characters, Locations, Items, Lore, Custom entry types
- Codex entry editor: rich text + structured metadata fields per type
- Cross-linking between codex entries (`codex_links`)
- Codex mentions in manuscript (manual tagging — highlight text → link to codex entry)
- Basic outlining: per-scene synopsis field, chapter summary
- Kanban board view of scenes (columns = chapters, cards = scenes with synopsis)
- Plotting module foundation: `outlines`, `beats` tables

#### Key Technical Tasks

**Backend (BE):**
- Migration: `codex_entries`, `codex_fields`, `codex_links`, `codex_mentions`, `outlines`, `beats` tables
- Codex CRUD API: all endpoints from architecture doc
- Image upload for codex entries (SHA-256 dedup, GCS upload)
- Codex mentions API: link binder nodes ↔ codex entries
- Outlines/beats CRUD API (basic — full structure templates come in Phase 2b)
- Synopsis field on `binder_nodes.synopsis` (already in schema, expose via API)

**Frontend (FE):**
- Codex panel: list entries by type (tabs), search/filter
- Codex entry form: dynamic fields based on entry type (character has Name/Role/Description/Motivation/etc.)
- Rich text editor for codex entry description (lightweight TipTap instance or markdown)
- Cross-link UI: link codex entries to each other with relationship type
- Codex mention in editor: select text → "Link to codex entry" action → creates mention
- Outline/synopsis panel: per-scene synopsis textarea in binder node details
- Kanban board: scenes as cards grouped by chapter, drag to reorder, shows synopsis + word count + status

**Fullstack (FS):**
- Codex ↔ editor integration: clicking a codex mention in the editor opens the codex entry
- Kanban ↔ binder sync: reordering cards in kanban updates binder sort_order
- Integration tests: create codex entries → link → mention in chapter → verify cross-references

#### Dependencies
- Phase 1b (manuscript module, binder tree, editor)

#### Definition of Done
- [ ] User creates codex entries of all types with structured fields
- [ ] Codex entries link to each other (e.g., Character A → enemy_of → Character B)
- [ ] User can tag text in editor to link to codex entry; clicking mention navigates to entry
- [ ] Image upload works for codex entries with deduplication
- [ ] Each scene has an editable synopsis field
- [ ] Kanban board shows scenes grouped by chapter, drag-drop reorders
- [ ] Codex search/filter works by type and text

#### Effort: 3 team-weeks (9 person-weeks)

---

### Phase 1d: Versioning, Goals & Focus Mode (W11–W13)

**Goal:** Snapshot system for version history, word count goals with streaks, and distraction-free writing mode.

#### Features / Modules Built
- Versioning module: manual snapshots, auto-snapshots on save, view/restore, diff view
- Delta-based storage: JSON Patch diffs, keyframe every 10th snapshot, GCS storage
- Goals module: daily/project/session word count targets, streak tracking
- Writing session tracking (start/end, words written/deleted)
- Focus/distraction-free mode: typewriter scroll, hide UI chrome, ambient themes

#### Key Technical Tasks

**Backend (BE):**
- Migration: `snapshots`, `snapshot_deltas`, `goals`, `writing_sessions`, `streaks` tables
- Snapshot creation: compute JSON Patch diff from last snapshot, compress with zstd, upload to GCS
- Keyframe logic: every 10th snapshot stores full content
- Snapshot restore: walk delta chain back to nearest keyframe, apply patches forward
- Diff API: return structured diff between two snapshots (for UI rendering)
- Celery task: `create_auto_snapshot` (on document save, if delta > 50 chars changed)
- Goals CRUD API, writing session start/end, streak calculation
- Daily stats aggregation (Celery beat task)

**Frontend (FE):**
- Version history panel: list snapshots for a document, manual snapshot button
- Diff viewer: side-by-side or inline diff between any two snapshots
- Restore confirmation dialog with preview
- Goals dashboard: set daily/project targets, progress bars, streak display
- Writing session timer: auto-start on typing, show words written this session
- Focus mode: full-screen editor, typewriter scrolling (current line stays centered), hide sidebar/toolbar
- Ambient themes: 3-4 background color schemes (dark, sepia, forest, minimal)
- Keyboard shortcut for focus mode toggle (e.g., F11 or Cmd+Shift+F)

**Fullstack (FS):**
- Auto-snapshot integration: backend event handler on `document.saved` → enqueue `create_auto_snapshot`
- Word count tracking: on save, compute delta words written/deleted → update `writing_sessions`
- Redis live word count accumulator (`wc:{user_id}:{date}`)
- End-to-end test: write → auto-snapshot → write more → view diff → restore → verify

#### Dependencies
- Phase 1b (document content, save flow, event bus)

#### Definition of Done
- [ ] Manual snapshot creates a labeled version, visible in history panel
- [ ] Auto-snapshots fire on save for non-trivial changes
- [ ] Diff view correctly shows additions/deletions between any two snapshots
- [ ] Restore replaces current content with snapshot content
- [ ] Delta chain + keyframe storage works correctly (verified by restore after 15+ snapshots)
- [ ] GCS stores compressed deltas; Postgres stores only metadata/pointers
- [ ] User sets daily word goal, sees progress bar update as they write
- [ ] Streak counter increments on days goal is met, resets on miss
- [ ] Focus mode hides all chrome, typewriter scroll works, Escape exits
- [ ] 3+ ambient themes available

#### Effort: 3 team-weeks (9 person-weeks)

---

### Phase 1e: Export, Billing & Polish (W14–W16)

**Goal:** Export to DOCX/PDF/ePub, Stripe integration for one-time purchase, and UI/UX polish pass.

#### Features / Modules Built
- Export module: DOCX, PDF, ePub generation from binder tree + content
- Export templates: manuscript format, paperback, ebook presets
- Async export pipeline via Celery (export queue)
- Billing: Stripe checkout for one-time purchase ($79 core), subscription for AI tier
- Stripe webhook handling (payment confirmation, subscription lifecycle)
- Notifications module: in-app notifications (export complete, etc.)
- UI/UX polish: loading states, error handling, empty states, responsive tweaks

#### Key Technical Tasks

**Backend (BE):**
- Migration: `export_jobs`, `export_templates`, `subscriptions`, `notifications`, `notification_preferences` tables
- Export pipeline: gather binder tree → ordered document content → apply template → render
  - DOCX: python-docx
  - PDF: WeasyPrint or reportlab
  - ePub: ebooklib
- Export API: `POST /export` (async, returns job_id), `GET /export/{job_id}`, `GET /export/{job_id}/download` (signed GCS URL)
- Celery task: `export_document` — renders, uploads to GCS, sets 7-day TTL
- Celery beat: `cleanup_expired_exports`
- Stripe integration: checkout session creation, webhook handler for `checkout.session.completed` and `customer.subscription.*`
- Billing status API, subscription tier check middleware
- Notifications service: in-app notification creation, mark-as-read, list

**Frontend (FE):**
- Export dialog: choose format, template, scope (full manuscript / selected chapters)
- Export progress indicator (poll job status)
- Download button when complete
- Billing page: purchase button → Stripe Checkout redirect → success/cancel handling
- Subscription management (current plan, cancel)
- Notification bell + dropdown (in-app notifications)
- **Polish pass across all existing features:**
  - Loading skeletons for all data-fetching views
  - Error boundaries and user-friendly error messages
  - Empty states (no projects, no codex entries, etc.)
  - Keyboard shortcuts help panel (? key)
  - Responsive layout for tablet-width screens
  - Smooth transitions/animations for sidebar, panels

**Fullstack (FS):**
- Export template system: base templates as JSONB config → style rules for each format
- Stripe test mode end-to-end flow
- Notification event wiring: export.complete → notification → in-app bell
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Performance audit: lighthouse, API response times, bundle size

#### Dependencies
- Phase 1b (manuscript content for export)
- Phase 1c (codex data for glossary export option)
- Phase 1a (auth for billing)

#### Definition of Done
- [ ] User exports manuscript as DOCX, PDF, or ePub; downloads within 60 seconds for a 100K-word novel
- [ ] Export output is correctly formatted (chapter breaks, headers, page numbers for PDF, proper ePub structure)
- [ ] 3 export templates available (manuscript submission, paperback, ebook)
- [ ] Stripe checkout works: user purchases core product, gains access
- [ ] Subscription for AI tier can be purchased and canceled
- [ ] Webhook correctly updates user subscription status
- [ ] In-app notifications appear for export completion
- [ ] All views have loading states, error states, and empty states
- [ ] No console errors in normal usage flow
- [ ] Lighthouse performance score > 80

#### Effort: 3 team-weeks (9 person-weeks)

---

### Phase 1f: MVP Hardening & Beta Launch (W17–W18)

**Goal:** Security audit, performance testing, documentation, staging deployment, and invite-only beta launch.

#### Features / Modules Built
- No new features — hardening, testing, deployment
- Staging environment on GCP
- Monitoring & alerting (Sentry, Cloud Monitoring)
- User onboarding flow (first-run tutorial/tooltips)

#### Key Technical Tasks

**All Team:**
- Security audit:
  - Input validation on all API endpoints (Pydantic models, size limits)
  - Rate limiting (slowapi or custom middleware): auth endpoints, export, general API
  - CORS configuration locked to production domains
  - SQL injection review (parameterized queries via SQLAlchemy — verify)
  - JWT secret rotation plan
  - File upload validation (size limits, content type checking)
  - OWASP Top 10 checklist
- Performance testing:
  - Load test key endpoints: document save, binder tree load, search, export
  - Target: 100 concurrent users, <500ms p95 for reads, <1s for writes
  - Database query optimization: EXPLAIN ANALYZE on all queries, add missing indexes
  - Connection pooling verification
- Deploy staging environment:
  - Cloud Run (FastAPI, 2 instances)
  - Cloud SQL (Postgres 16, db-custom-2-4096)
  - Memorystore Redis (Basic M1)
  - GCS bucket with lifecycle policies
  - Cloud CDN for frontend static assets
  - Sentry for error tracking
  - Cloud Monitoring dashboards + alerts (5xx rate, latency p95, CPU/memory)
- Documentation:
  - API documentation (auto-generated OpenAPI + manual descriptions)
  - User-facing help docs (basic: getting started, editor shortcuts, export guide)
  - Internal runbook: deploy process, rollback, DB migration, incident response
- Onboarding:
  - First-run project creation wizard
  - Tooltip tour of key UI areas (binder, editor, codex, export)
  - Sample project with demo content

#### Dependencies
- All Phase 1 phases complete

#### Definition of Done
- [ ] Staging environment deployed and accessible
- [ ] All API endpoints have input validation and rate limiting
- [ ] Sentry captures errors, Cloud Monitoring shows dashboards
- [ ] Load test passes: 100 concurrent users at target latencies
- [ ] Zero known critical or high-severity bugs
- [ ] Onboarding flow guides new user through first project creation
- [ ] Beta invite system works (invite codes or email whitelist)
- [ ] Runbook documented for deploys, rollbacks, incidents
- [ ] **Beta launch: 20–50 invited users**

#### Effort: 2 team-weeks (6 person-weeks)

---

### Phase 2a: AI-Assisted Writing (W19–W22)

**Goal:** AI integration with BYOK and built-in credits. Context-aware brainstorm, draft, expand, revise, and style-match modes.

#### Features / Modules Built
- AI module: session management, prompt assembly, context window construction
- BYOK key management: encrypted storage of user's OpenAI/Anthropic API keys
- Built-in AI credits: token usage tracking, billing tier enforcement
- AI modes: brainstorm, draft, expand, revise, style-match
- Smart context assembly: current chapter + relevant codex + outline beats + style profile
- Streaming responses via WebSocket
- AI session history (viewable, not editable)
- Auto-snapshot before AI modifications ("pre_ai" snapshot type)

#### Key Technical Tasks

**Backend (BE):**
- Migration: `ai_sessions`, `ai_messages`, `ai_usage`, add `api_keys` table (encrypted)
- BYOK key management: encrypt with Fernet (key from env), store ciphertext, decrypt at call time
- Context assembly service:
  - Gather current document, N preceding chapters, linked codex entries, relevant outline beats
  - Relevance scoring: prioritize codex entries mentioned in current chapter
  - Token budgeting: cap context at ~8K tokens, prioritize by relevance
  - Context preview endpoint: `GET /ai/context-preview` → show user what AI will "see"
- LLM API integration: abstract provider (OpenAI, Anthropic) behind unified interface
- Prompt templates per mode (brainstorm → open-ended, draft → continuation, revise → rewrite with instructions)
- Streaming: SSE or WebSocket for token-by-token response delivery
- Celery AI queue tasks: `ai_generate`, `ai_style_analysis`
- Usage tracking: count tokens per request, aggregate per user per month
- Rate limiting: per-user AI request limits (from subscription tier)
- Prompt caching: leverage provider caching (Anthropic cache_control, OpenAI)

**Frontend (FE):**
- AI sidebar panel: mode selector, context config, chat interface
- Streaming response display (typewriter effect)
- "Insert into document" action: apply AI-generated text at cursor position
- "Replace selection" action: AI revises selected text
- Context preview: show which codex entries + chapters are included
- BYOK settings page: add/remove API keys, select default provider
- AI usage dashboard: tokens used this period, quota remaining
- Pre-AI snapshot indicator ("snapshot saved before AI edit")

**Fullstack (FS):**
- AI ↔ editor integration: cursor position context, selection context
- Style analysis pipeline: analyze 3+ chapters → extract style profile → store on project
- Model tiering logic: route brainstorm to cheap model, draft/revise to capable model
- End-to-end test: set BYOK key → brainstorm → draft → expand selection → verify usage tracking
- Error handling: provider rate limits, key validation, timeout handling

#### Dependencies
- Phase 1b (manuscript content for context)
- Phase 1c (codex for context assembly)
- Phase 1d (versioning for pre-AI snapshots)
- Phase 1e (billing for subscription tier enforcement)

#### Definition of Done
- [ ] User adds BYOK key, selects provider, keys stored encrypted
- [ ] All 5 AI modes work: brainstorm, draft, expand, revise, style-match
- [ ] Context assembly includes relevant codex + chapters (verifiable via preview)
- [ ] Responses stream in real-time
- [ ] User can insert/replace editor content with AI output
- [ ] Pre-AI snapshot is created automatically before any AI edit
- [ ] Usage tracking shows tokens consumed, respects tier limits
- [ ] Built-in credits work with metered billing
- [ ] User can cancel mid-generation (stops streaming, partial result available)
- [ ] Latency to first token < 3s (network dependent)

#### Effort: 4 team-weeks (12 person-weeks)

---

### Phase 2b: Story Structure, Timelines & Arcs (W23–W25)

**Goal:** Structure templates (Save the Cat, 3-Act, Hero's Journey), visual timeline, character arc planner, relationship map.

#### Key Technical Tasks

**Backend (BE):**
- Migration: `timelines`, `timeline_events`, `character_arcs`, `relationships` tables
- Structure template data: seed 4 templates (3-Act, Save the Cat, Hero's Journey, Kishotenketsu)
- Timeline CRUD API: timelines, events, storyline grouping
- Character arcs API: want/need/flaw/ghost, arc beats linked to outline beats
- Relationships API: source/target codex entries, relationship type, dynamic changes
- Beat ↔ binder node linking (associate beat with actual chapter/scene)

**Frontend (FE):**
- Structure template picker: select template → generates beat sheet outline
- Visual beat sheet: acts as columns, beats as cards, link beats to binder nodes
- Visual timeline component: horizontal scrollable, multiple swimlanes per storyline/POV
  - Drag-drop events, zoom in/out, link events to binder nodes and codex entries
- Character arc planner: form for want/need/flaw/ghost, visual arc curve overlaid on beat sheet
- Relationship map: force-directed graph (d3-force or vis.js), nodes = characters, edges = relationships
  - Click node → open codex entry, click edge → edit relationship

**Fullstack (FS):**
- Template → outline generation logic: applying a template creates beats in correct structure
- Timeline ↔ binder sync: clicking a timeline event navigates to the linked scene
- Integration tests: apply template → link beats to scenes → view on timeline → verify consistency

#### Dependencies
- Phase 1c (codex for characters, outlining foundation)

#### Definition of Done
- [ ] User selects a structure template, gets a pre-populated beat sheet
- [ ] Beats link to binder nodes; clicking a beat opens the corresponding scene
- [ ] Timeline displays events across multiple storylines, drag-drop reorders
- [ ] Character arc planner captures want/need/flaw/ghost with arc beats
- [ ] Relationship map renders as interactive force-directed graph
- [ ] All plotting data persists and loads correctly on refresh

#### Effort: 3 team-weeks (9 person-weeks)

---

### Phase 2c: Split Editor, Track Changes & Series (W26–W28)

**Goal:** Side-by-side editor panes, suggest mode with accept/reject, and series-level project grouping.

#### Key Technical Tasks

**Backend (BE):**
- Migration: `suggestions` table (track changes), series fields on `projects`
- Suggestions API: create, accept, reject (accept modifies document content)
- Series API: group projects into series, shared codex across series
- Cross-project codex query: when in series context, search codex from all series books

**Frontend (FE):**
- Split editor: two-pane layout, each pane independently loads any binder node or codex entry
  - Layout options: 50/50, 60/40, vertical/horizontal split
- Track changes / suggest mode:
  - Toggle "Suggest" mode in editor toolbar
  - Insertions highlighted in green, deletions in red (TipTap extension/decorations)
  - Accept/reject buttons per suggestion, bulk accept/reject all
  - Suggestion attribution (who suggested)
- Series management UI: create series, add books, reorder, shared codex view

**Fullstack (FS):**
- TipTap extension for track changes: store suggestions as marks/decorations, persist to `suggestions` table
- Split editor state management: two independent editor instances sharing binder tree
- Series codex aggregation: merge codex entries from all books in series for AI context and reference

#### Dependencies
- Phase 1b (editor), Phase 1c (codex), Phase 2a (AI — track changes used before AI edits)

#### Definition of Done
- [ ] Split editor opens two panes with independent document loading
- [ ] Suggest mode highlights changes, accept/reject works per-suggestion and in bulk
- [ ] Suggestion attribution shows correct user
- [ ] Series groups multiple projects, shared codex entries visible across books
- [ ] AI context assembly includes series-level codex when in series project

#### Effort: 3 team-weeks (9 person-weeks)

---

### Phase 2d: Desktop App — Tauri (W29–W31)

**Goal:** Offline-capable desktop app wrapping the web app with local SQLite sync.

#### Key Technical Tasks

**Fullstack (all hands):**
- Tauri project setup: bundle React frontend in WebView
- Local SQLite database for offline storage (mirror of user's projects)
- Sync protocol:
  - On online: pull latest from server, merge using last-write-wins (metadata) + timestamp ordering (content)
  - On offline: write to local SQLite, queue change log
  - On reconnect: push change log → server applies with conflict resolution
  - Document content conflicts: use Yjs CRDT merge (prep for Phase 3a)
- Auto-update mechanism (Tauri updater)
- Platform builds: Windows, macOS, Linux
- File system integration: save project backups locally
- Offline indicator in UI

#### Dependencies
- All Phase 1 + 2a–2c (wrapping a feature-complete web app)

#### Definition of Done
- [ ] Desktop app installs on Windows, macOS, Linux (< 20MB binary)
- [ ] App works fully offline: create projects, write, edit codex, take snapshots
- [ ] Syncs correctly when reconnected (no data loss)
- [ ] Conflict resolution works for concurrent edits (offline + another device)
- [ ] Auto-update downloads and installs new versions
- [ ] Performance matches or exceeds web app

#### Effort: 3 team-weeks (9 person-weeks)

---

### Phase 3a: Real-Time Collaboration (W32–W35)

**Goal:** CRDT-based co-editing with cursor presence and live comments.

#### Key Technical Tasks

**Backend (BE):**
- WebSocket server for Yjs sync (FastAPI WebSocket endpoint)
- Yjs document provider: load from Postgres → Yjs state, persist back on flush
- Redis pub/sub for cross-instance WebSocket relay
- Flush logic: merge Yjs → ProseMirror JSON every 60s + on session end
- Migration: `collab_sessions` table
- Presence tracking: Redis sorted set per project, broadcast via WebSocket

**Frontend (FE):**
- Yjs integration with ProseMirror (y-prosemirror binding)
- Cursor presence: colored cursors with user names
- Live awareness: who's editing which document (sidebar indicators)
- Comments rework: real-time comment sync (currently REST, add WebSocket push)

**Fullstack (FS):**
- Connection management: reconnect logic, offline queue, state recovery
- Performance testing: 5+ concurrent editors on same document
- Graceful degradation: if WebSocket drops, fall back to REST save
- Redis Yjs state management: cleanup stale state, handle crashes

#### Dependencies
- Phase 1b (editor, document content)
- Phase 1d (versioning — collab changes trigger auto-snapshots)

#### Definition of Done
- [ ] Two users edit same document simultaneously, see each other's cursors
- [ ] Changes merge correctly without conflicts (CRDT guarantee)
- [ ] Yjs state persists to Postgres on flush; no data loss on server restart
- [ ] Works across multiple FastAPI instances (Redis pub/sub relay)
- [ ] Presence shows who's online and what they're editing
- [ ] Handles network interruption: reconnects and syncs without data loss
- [ ] 5 concurrent editors on one document with < 200ms update latency

#### Effort: 4 team-weeks (12 person-weeks)

---

### Phase 3b: Beta Reader Portal & Direct Publishing (W36–W38)

**Goal:** Invite-only read access with structured feedback, and push-to-publish integrations.

#### Key Technical Tasks

**Backend (BE):**
- Beta reader invite system: generate tokens, email invites, token-based access (no full account required)
- Beta reader view: read-only manuscript access, per-chapter feedback forms
- Structured questionnaire system: configurable questions per chapter (pacing, clarity, engagement)
- Feedback aggregation API: sentiment summary, per-chapter ratings
- Publishing module: metadata schema (title, subtitle, description, categories, keywords, ISBNs)
- KDP integration: file submission via KDP API (or manual package generation if API limited)
- Draft2Digital API integration
- Migration: `publishing_profiles`, `submissions` tables

**Frontend (FE):**
- Beta reader portal: separate route (`/beta/{token}`), clean reading interface
  - Chapter navigation, inline highlight-to-comment, structured feedback form per chapter
- Author's beta management: invite readers, view feedback dashboard, aggregated sentiment
- Publishing setup: metadata form, cover upload, format selection
- Publish action: validate metadata completeness → submit → track status

**Fullstack (FS):**
- Beta reader email delivery (SendGrid integration)
- Publishing platform API integration testing (sandbox/test modes)
- End-to-end: invite beta reader → reader gives feedback → author sees aggregated results

#### Dependencies
- Phase 1e (export — publishing needs formatted output)
- Phase 1a (auth — beta readers use token-based lightweight auth)

#### Definition of Done
- [ ] Author invites beta readers via email; readers access manuscript via unique link
- [ ] Beta readers can read chapters, highlight text, leave inline comments, fill structured feedback
- [ ] Author dashboard shows aggregated feedback per chapter (ratings, common themes)
- [ ] Metadata form captures all fields needed for publishing platforms
- [ ] At least one publishing integration works end-to-end (Draft2Digital or KDP package generation)
- [ ] Submission status tracking shows current state per platform

#### Effort: 3 team-weeks (9 person-weeks)

---

## 3. Critical Path

### Longest Chain (Blocking Dependencies)

```
1a (Foundation) → 1b (Editor) → 1c (Codex) → 2a (AI) → 2c (Track Changes) → 2d (Desktop)
     3 wk           4 wk          3 wk         4 wk         3 wk              3 wk
                                                                          Total: 20 weeks
```

This is the critical path. **Any slip in 1a, 1b, 1c, or 2a delays everything downstream.**

### Parallelizable Work

| Phase | Can Run In Parallel With | Notes |
|-------|-------------------------|-------|
| **1d** (Versioning, Goals) | **1c** (Codex) | Both depend on 1b. Can overlap W8–W13 if team splits work. Backend does versioning while frontend does codex UI. |
| **1e** (Export, Billing) | **1d** (Versioning) | Export only needs 1b. Billing only needs 1a. Can overlap significantly. |
| **2b** (Timelines, Arcs) | **2a** (AI) | 2b depends on 1c, not on 2a. Can fully parallelize. |
| **3a** (Collab) | **2d** (Desktop) | Independent feature tracks. Desktop wraps existing; collab adds new. |
| **3b** (Beta Readers) | **3a** (Collab) | Partially parallel — beta portal is independent of CRDT. |

### Optimized Parallel Schedule (compresses to ~32 weeks)

```
W1-3:   [=== 1a Foundation ===]
W4-7:   [======= 1b Editor =======]
W8-10:  [=== 1c Codex ===][=== 1d Versioning (BE start) ===]
W11-13: [=== 1d Versioning ===][=== 1e Export/Billing (FE start) ===]
W14-16: [=== 1e Export/Billing ===]
W17-18: [== 1f Beta Launch ==]
W19-22: [======= 2a AI =======][=== 2b Timelines (FE) ===]
W23-25: [=== 2b Timelines ===][=== 2c Track Changes ===]
W26-28: [=== 2c Series ===]
W29-31: [=== 2d Desktop ===][=== 3a Collab (BE start) ===]
W32-35: [======= 3a Collab =======]
W36-38: [=== 3b Beta Readers ===]
```

Realistically, with a team of 3, some overlap is possible but not all. **Target: 34–38 weeks with reasonable slack.**

---

## 4. Infrastructure Phases

### Phase 1: Local Development (W1, maintained throughout)

| Component | Implementation |
|-----------|---------------|
| PostgreSQL 16 | Docker container, port 5432 |
| Redis 7 | Docker container, port 6379 |
| GCS | MinIO container (S3-compatible) or GCS emulator |
| FastAPI | uvicorn with hot-reload |
| Celery | Single worker, all queues, `--concurrency=2` |
| React | Vite dev server with HMR |
| **All via** | `docker compose up` — one command |

### Phase 2: Staging Environment (W15–W17, before beta)

| Component | GCP Service | Config |
|-----------|------------|--------|
| FastAPI | Cloud Run | 1 instance, 2 vCPU / 4GB |
| PostgreSQL | Cloud SQL | db-f1-micro (staging), 10GB SSD |
| Redis | Memorystore Basic M1 | 1GB |
| GCS | Standard bucket | `{project}-staging` |
| Frontend | Cloud Storage + CDN | Static site hosting |
| Celery workers | Cloud Run Jobs | On-demand |
| CI/CD | GitHub Actions → Cloud Run deploy | On merge to `staging` branch |
| Monitoring | Sentry (free tier) | Error tracking |
| **Est. cost** | | **~$80–120/mo** |

### Phase 3: Production Environment (W17–W18, at beta launch)

| Component | GCP Service | Config |
|-----------|------------|--------|
| FastAPI | Cloud Run | 2 instances (min 1 always-on), 2 vCPU / 4GB |
| PostgreSQL | Cloud SQL | db-custom-2-4096, 100GB SSD, 1 read replica |
| Redis | Memorystore Basic M1 | 1GB |
| GCS | Standard + Nearline lifecycle | `{project}-prod` |
| Frontend | Cloud Storage + Cloud CDN | Global edge caching |
| Celery workers | GCE e2-small × 3 | Spot VMs for export/default, on-demand for AI |
| Secrets | Secret Manager | All API keys, DB passwords, JWT secrets |
| DNS | Cloud DNS or Cloudflare | Custom domain |
| SSL | Managed certificates | Auto-provisioned via Cloud Run |
| WAF | Cloud Armor | Basic rules (rate limiting, geo-blocking) |
| Monitoring | Sentry + Cloud Monitoring + Cloud Logging | Alerts on 5xx, latency, error budget |
| Backups | Cloud SQL automated | Daily, 7-day retention |
| **Est. cost** | | **~$340–370/mo** |

### GCP Service Provisioning Timeline

| Week | Services Provisioned |
|------|---------------------|
| W1 | GCP project created, billing set up, IAM roles for team |
| W1 | GCS bucket for dev assets (if not using MinIO) |
| W3 | Container Registry (Artifact Registry) for Docker images |
| W15 | Staging: Cloud SQL, Memorystore, Cloud Run, GCS bucket |
| W16 | Staging: CI/CD pipeline deploys to staging on merge |
| W17 | Production: All services, Cloud CDN, Cloud Armor, Secret Manager |
| W17 | Production: DNS, SSL, domain configuration |
| W18 | Production: Monitoring dashboards, alerts, backup verification |
| W22 | AI workers: scale Cloud Run Jobs or add GCE instances for AI queue |
| W29 | Desktop: signing certificates, auto-update server (GCS-hosted) |
| W32 | Collab: ensure Cloud Run min-instances = 1 for WebSocket, Redis pub/sub config |

---

## 5. Risk Register

### Phase 1a–1b (Foundation + Editor)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Editor framework complexity | Low | Medium | Resolved — switched to TipTap (React-first ProseMirror wrapper). All required extensions ship as npm packages; no custom schema/keymap layer needed. |
| ltree extension not available on Cloud SQL | Low | High | Verify ltree availability on Cloud SQL Postgres 16 in W1. Fallback: materialized path as TEXT column with LIKE queries. |
| Auto-save conflicts with manual save | Medium | Low | Debounce auto-save (3s), show save indicator, prevent double-submit with request deduplication. |

### Phase 1c–1d (Codex + Versioning)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Delta chain corruption causes data loss | Medium | Critical | Always store full keyframes every 10 snapshots. Validate chain integrity on restore. Background job to verify chains weekly. |
| Codex cross-linking performance with large worldbuilds | Low | Medium | Eager-load linked entries with depth limit (2). Paginate codex list. Index `codex_links` on both columns. |
| JSON Patch library edge cases with ProseMirror JSON | Medium | Medium | Evaluate `jsonpatch` and `python-json-patch` early. Write property-based tests (hypothesis) for patch roundtrip correctness. |

### Phase 1e (Export)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ePub generation quality is poor | High | High | Evaluate ebooklib early (W12). Fallback: Pandoc subprocess for ePub. Budget extra time for template tweaking. |
| WeasyPrint PDF rendering is slow for long manuscripts | Medium | Medium | Set Celery timeout to 5 min. Test with 100K-word document early. Consider paged.js or Prince XML if too slow. |
| Stripe webhook reliability | Low | Medium | Implement idempotent webhook handling, retry logic, and webhook signature verification. Log all events. |

### Phase 2a (AI)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI provider API changes or rate limits | Medium | High | Abstract provider behind interface. Support 2+ providers from day 1. Implement circuit breaker pattern. |
| Context assembly token budget exceeded | High | Medium | Hard cap context at 8K tokens. Truncate least-relevant items. Show user what was included/excluded. |
| BYOK key security | Medium | Critical | Fernet encryption at rest. Keys never logged. Decrypt only at call time, never cached. Security audit before launch. |
| AI generation quality varies by model | Medium | Medium | Prompt engineering per model. A/B test prompts. Let power users see/edit system prompt. |

### Phase 2d (Desktop)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Offline sync conflicts are complex | High | High | Keep sync protocol simple: last-write-wins for metadata, append-only for content changes, manual merge UI for conflicts. Defer full CRDT sync to Phase 3a. |
| Tauri cross-platform bugs | Medium | Medium | CI builds for all 3 platforms from day 1. Test on actual hardware (not just CI). Tauri community is active but smaller than Electron. |
| Code signing and distribution | Medium | Medium | Set up Apple Developer + Windows code signing certificates early (W27). Budget for notarization delays. |

### Phase 3a (Collaboration)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Yjs ↔ TipTap binding edge cases | High | High | Use `@tiptap/extension-collaboration` (wraps y-prosemirror). Extensive fuzz testing with concurrent edit scenarios. Graceful degradation: fall back to locking if CRDT fails. |
| WebSocket scaling across multiple Cloud Run instances | Medium | High | Redis pub/sub relay from day 1. Test with 2+ instances in staging. Consider Hocuspocus server if custom implementation is too complex. |
| Data loss on server crash during Yjs flush | Medium | Critical | Flush to Postgres every 60s AND on WebSocket disconnect. Redis persistence (RDB) as additional safety net. Client holds local copy until server ACK. |

### Cross-Cutting Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Team member leaves | Medium | Critical | Document everything. Pair programming on critical modules (editor, sync). No single points of knowledge. |
| Scope creep | High | High | Strict phase gates. Feature freeze per phase. New ideas go to backlog, not current sprint. |
| GCP cost overrun | Low | Medium | Set billing alerts at $200, $400, $600. Review cost weekly in first month of production. Use committed use discounts once stable. |

---

## 6. Team Structure & Work Split

### Team Composition

| Role | Primary Responsibilities | Secondary |
|------|------------------------|-----------|
| **Frontend Dev (FE)** | React UI, TipTap editor, all visual components, CSS/styling | UX decisions, accessibility |
| **Backend Dev (BE)** | FastAPI APIs, DB schema/migrations, Celery tasks, GCS integration | DevOps, CI/CD, monitoring |
| **Fullstack Dev (FS)** | Integration layer, editor ↔ API, sync logic, state management, testing | Fills gaps on either side, TipTap/ProseMirror deep-dive |

### Phase-by-Phase Assignments

| Phase | FE Focus | BE Focus | FS Focus |
|-------|----------|----------|----------|
| **1a** | React scaffold, auth UI, layout shell | FastAPI scaffold, auth, DB, Docker | Docker Compose, CI/CD, env config, GCS |
| **1b** | TipTap editor UI, binder tree | Manuscript APIs, content save/load, search | Editor ↔ API integration, auto-save, perf |
| **1c** | Codex UI, kanban board | Codex APIs, image upload, outline APIs | Codex ↔ editor mentions, kanban ↔ binder sync |
| **1d** | Version history UI, goals dashboard, focus mode | Snapshot engine, delta storage, goals APIs | Auto-snapshot wiring, word count tracking |
| **1e** | Export dialog, billing page, notifications, polish | Export pipeline, Stripe, notifications service | Template system, cross-browser testing, perf audit |
| **1f** | Onboarding flow, bug fixes | Security audit, staging deploy, load testing | Integration testing, docs, bug fixes |
| **2a** | AI sidebar, streaming UI, usage dashboard | AI orchestration, LLM integration, BYOK | Context assembly, editor ↔ AI integration |
| **2b** | Timeline viz, arc planner, relationship graph | Timeline/arc/relationship APIs, templates | Template → outline generation, data sync |
| **2c** | Split editor, track changes UI, series UI | Suggestions API, series API, cross-project codex | TipTap track changes extension, split state |
| **2d** | UI adjustments for desktop, offline indicators | Sync protocol server-side, conflict resolution | Tauri setup, SQLite offline storage, sync client |
| **3a** | Cursor presence, awareness UI | WebSocket server, Yjs provider, Redis pub/sub | y-prosemirror integration, connection management |
| **3b** | Beta reader portal, publishing UI, feedback dashboard | Beta invite system, feedback APIs, publishing APIs | Email delivery, platform API integration |

### Communication & Process

- **Daily standup:** 15 min, async (Slack/Discord thread) or sync
- **Sprint planning:** Monday of each phase start, break phase into 1-week sprints
- **PR reviews:** All PRs require 1 review. Critical code (auth, billing, AI keys) requires 2.
- **Demo:** End of each phase, internal demo + deploy to staging
- **Retro:** End of each phase, 30 min

---

## 7. MVP Launch Criteria

### Minimum Feature Set for Public Beta (End of Phase 1f, W18)

| Category | Must Have | Nice to Have |
|----------|-----------|-------------|
| **Editor** | Rich text with markdown shortcuts, auto-save | Spell check (browser native is fine) |
| **Manuscript** | Projects, binder tree with drag-drop, chapters/scenes | Folder icons, custom labels |
| **Codex** | All entry types, cross-linking, image upload | Codex mentions in editor |
| **Outlining** | Per-scene synopsis, kanban view | Beat sheet (can wait for P1) |
| **Versioning** | Manual + auto snapshots, restore, diff view | Branch support |
| **Goals** | Daily word count target, streak | Session tracking, analytics |
| **Export** | DOCX + PDF + ePub with 3 templates | Custom template editor |
| **Focus mode** | Distraction-free writing, 3+ themes | Ambient sounds |
| **Auth** | Email + Google OAuth | GitHub OAuth |
| **Billing** | One-time purchase via Stripe | AI subscription (can launch with BYOK-only) |
| **Performance** | <500ms page loads, <1s saves | Offline support |
| **Reliability** | Auto-save never loses data, export always completes | — |

### Launch Blockers (Must fix before any public access)

- [ ] Zero data-loss scenarios in normal operation
- [ ] All auth flows work (register, login, OAuth, password reset)
- [ ] Export produces valid, well-formatted files in all 3 formats
- [ ] Payment processing works correctly
- [ ] Rate limiting on all public endpoints
- [ ] Error tracking (Sentry) operational
- [ ] Automated database backups running
- [ ] Terms of Service and Privacy Policy pages

### Beta Testing Strategy

**Phase 1: Closed Alpha (W17–W18)**
- 10–20 users: team members, friends, writers from personal network
- Goal: find critical bugs, UX friction, data integrity issues
- Feedback: direct conversation, shared bug tracker
- Duration: 2 weeks

**Phase 2: Invite-Only Beta (W18–W24)**
- 50–200 users: expand via writing communities (r/writing, NaNoWriMo forums, writing Discord servers)
- Invite code system: each user gets 3 invite codes
- Goal: validate product-market fit, stress-test with real manuscripts (imported from Scrivener/Word)
- Feedback: in-app feedback widget, weekly survey
- Metrics to track:
  - Daily active users (DAU)
  - Words written per session
  - Feature usage frequency (codex, outlining, export, snapshots)
  - Retention: 1-day, 7-day, 30-day
  - NPS score
  - Export success rate
  - Error rate (Sentry)
- Duration: 6 weeks (overlaps with P1 development)

**Phase 3: Open Beta / Public Launch (W24–W26)**
- Remove invite gate
- Launch on Product Hunt, Hacker News, writing subreddits
- Goal: acquire first 1,000 users, validate pricing
- Offer early-bird pricing (20% off one-time purchase for first 500 buyers)

### Success Metrics for MVP

| Metric | Target | Measurement |
|--------|--------|-------------|
| Beta signups | 200+ in first 2 weeks | Registration count |
| 7-day retention | >40% | DAU/WAU |
| Words written per active user per week | >2,000 | Writing sessions data |
| Export usage | >30% of active users export at least once | Export job count |
| Conversion (beta → paid) | >5% | Stripe purchases / total beta users |
| NPS | >30 | Survey |
| Critical bugs | <3 open at any time | Bug tracker |
| Uptime | >99.5% | Cloud Monitoring |

---

## Appendix: Quick Reference — Deliverables by Week

| Week | Milestone |
|------|-----------|
| W3 | ✅ Dev environment works, auth flows complete, CI green |
| W7 | ✅ Editor + binder tree functional, can write and save |
| W10 | ✅ Codex + kanban outlining working |
| W13 | ✅ Snapshots + goals + focus mode complete |
| W16 | ✅ Export + billing + polish done — feature-complete MVP |
| W18 | 🚀 **Beta launch** — 20–50 alpha users |
| W22 | ✅ AI writing features live |
| W24 | 🚀 **Open beta / public launch** |
| W25 | ✅ Timelines + arcs + relationship maps |
| W28 | ✅ Split editor + track changes + series |
| W31 | ✅ Desktop app (Tauri) shipped |
| W35 | ✅ Real-time collaboration live |
| W38 | ✅ Beta reader portal + publishing integrations |

---

*This plan is a living document. Update estimates and timelines as work progresses. Conduct phase-gate reviews at each milestone to re-evaluate scope and priorities based on user feedback.*
