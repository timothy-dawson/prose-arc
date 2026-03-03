# Phase 1e: Export, Billing & Polish — Task Checklist

**Duration:** Weeks 14–16
**Goal:** Export to DOCX/PDF/ePub, Stripe integration for one-time purchase + AI subscription, in-app notifications, and UI/UX polish pass across all existing features.
**Depends on:** Phase 1b (manuscript content for export), Phase 1c (codex for glossary export), Phase 1a (auth for billing)

---

## Backend Tasks

### Database Migrations

- [x] Create migration: `export_jobs` table
  - Columns: `id`, `project_id` (FK), `user_id` (FK), `format` ('docx' | 'pdf' | 'epub'), `template_id` (FK, nullable), `scope` (JSONB — full manuscript or selected node IDs), `status` ('pending' | 'processing' | 'completed' | 'failed'), `gcs_key` (output file GCS path), `file_size_bytes`, `error_message`, `expires_at` (7-day TTL), `created_at`, `completed_at`
- [x] Create migration: `export_templates` table
  - Columns: `id`, `name`, `format` ('docx' | 'pdf' | 'epub'), `config` (JSONB — style rules: font, margins, headers, chapter breaks, page numbers, etc.), `is_default` (boolean), `created_at`
  - Seed 3 default templates: manuscript submission, paperback, ebook
- [x] Create migration: `subscriptions` table
  - Columns: `id`, `user_id` (FK), `stripe_customer_id`, `stripe_subscription_id` (nullable), `plan` ('free' | 'core' | 'ai_starter' | 'ai_pro'), `status` ('active' | 'canceled' | 'past_due' | 'expired'), `purchased_at`, `expires_at`, `created_at`, `updated_at`
- [x] Create migration: `notifications` table
  - Columns: `id`, `user_id` (FK), `type` ('export_complete' | 'export_failed' | 'system' | 'billing'), `title`, `message`, `data` (JSONB — extra context like export_job_id), `read` (boolean, default false), `created_at`
- [x] Create migration: `notification_preferences` table
  - Columns: `id`, `user_id` (FK), `type`, `enabled` (boolean, default true)
- [x] Verify indexes: `export_jobs(user_id, status)`, `export_jobs(expires_at)`, `subscriptions(user_id)`, `subscriptions(stripe_customer_id)`, `notifications(user_id, read)`, `notifications(created_at)`

### Export Module (`app/modules/export/`)

- [x] Create module structure: `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`, `renderers/`
- [x] SQLAlchemy models: `ExportJob`, `ExportTemplate`
- [x] Pydantic schemas:
  - [x] `ExportCreate` — format, template_id (optional), scope (full or selected binder_node_ids)
  - [x] `ExportJobResponse` — full job with status, format, timestamps, download URL (when complete)
  - [x] `ExportTemplateResponse` — template metadata + config
- [x] Service layer (`export/service.py`):
  - [x] **Create export job:** validate scope, create job record with status='pending', enqueue Celery task
  - [x] **Get export job:** return job with status, download signed URL if completed
  - [x] **List export jobs** for user (paginated, ordered by created_at desc)
  - [x] **Download export:** generate signed GCS URL (1h expiry)
- [x] Export renderers (`export/renderers/`):
  - [x] `base.py` — abstract renderer interface: `render(binder_tree, documents, template_config) → bytes`
  - [x] `docx_renderer.py` — python-docx implementation:
    - [x] Gather binder tree in order → concatenate document content
    - [x] Apply template styles: font, size, margins, line spacing
    - [x] Chapter breaks (page break before each chapter-level node)
    - [x] Headers/footers (title, page numbers)
    - [ ] Front matter (title page)
    - [x] Handle images embedded in TipTap content
  - [x] `pdf_renderer.py` — WeasyPrint implementation:
    - [x] Convert TipTap JSON → HTML → CSS-styled HTML → PDF
    - [x] Template CSS for manuscript/paperback/ebook styles
    - [x] Page numbers, headers/footers, chapter breaks
    - [ ] Table of contents generation
  - [x] `epub_renderer.py` — ebooklib implementation:
    - [x] Create ePub structure: metadata, spine, TOC, chapters as XHTML
    - [x] Convert TipTap JSON → XHTML for each chapter
    - [ ] Cover image support
    - [x] CSS for ebook styling
    - [ ] Validate ePub structure (epubcheck if available)
- [x] Export template system:
  - [x] 3 default templates seeded in migration:
    - [x] **Manuscript submission** — Courier/Times New Roman 12pt, double-spaced, 1" margins, # for scene breaks
    - [x] **Paperback** — serif font, single-spaced, 0.75" margins, decorative chapter headings
    - [x] **Ebook** — clean sans-serif, responsive spacing, minimal styling
  - [x] Template config as JSONB: fonts, sizes, margins, spacing, header/footer content, chapter break style
- [x] API routes (`app/modules/export/router.py`):
  - [x] `POST /projects/{project_id}/export` — create export job (async)
  - [x] `GET /projects/{project_id}/export/{job_id}` — get job status
  - [x] `GET /projects/{project_id}/export` — list export jobs for project
  - [x] `GET /export/templates` — list available templates
- [x] Authorization: exports scoped to user's projects
- [x] Register export router

### Celery Export Task

- [x] `export_document` task (queue='export'):
  - [x] Load binder tree for project (ordered)
  - [x] Load all document content for scope (full or selected nodes)
  - [x] Select renderer based on format
  - [x] Apply template config
  - [x] Render output → bytes
  - [x] Upload to GCS/MinIO: `exports/{project_id}/{job_id}.{format}`
  - [x] Update job record: status='completed', gcs_key, file_size_bytes, completed_at
  - [ ] Set GCS object TTL: 7 days
  - [x] On failure: update job status='failed', error_message
  - [x] Fire `export.completed` or `export.failed` event
  - [x] Celery timeout: 5 minutes
- [x] `cleanup_expired_exports` Celery beat task:
  - [x] Run daily
  - [x] Delete GCS objects where `expires_at < now()`
  - [x] Delete corresponding job records (or mark as expired)

### Billing Module (`app/modules/billing/`)

- [x] Create module structure: `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`
- [x] SQLAlchemy model: `Subscription`
- [x] Pydantic schemas:
  - [x] `CheckoutCreate` — plan ('core' | 'ai_starter' | 'ai_pro')
  - [x] `CheckoutResponse` — Stripe checkout session URL
  - [x] `SubscriptionResponse` — current plan, status, dates
  - [x] `BillingPortalResponse` — Stripe billing portal URL
- [x] Service layer (`billing/service.py`):
  - [x] **Create checkout session:** stubbed (TODO: wire Stripe)
  - [x] **Handle webhook:** `checkout.session.completed` → create/update subscription record
  - [x] **Get subscription status** for user
  - [x] **Create billing portal session** (stubbed)
  - [x] **`require_plan` dependency** for feature gating
- [x] API routes (`app/modules/billing/router.py`):
  - [x] `POST /billing/checkout` — create Stripe checkout session → return URL
  - [x] `POST /billing/webhook` — Stripe webhook endpoint (no auth)
  - [x] `GET /billing/subscription` — get current user's subscription
  - [x] `POST /billing/portal` — create Stripe billing portal session → return URL
- [x] Register billing router

### Notifications Module (`app/modules/notifications/`)

- [x] Create module structure: `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`
- [x] SQLAlchemy models: `Notification`, `NotificationPreference`
- [x] Service layer:
  - [x] **Create notification** — type, title, message, data
  - [x] **List notifications** for user (paginated, unread first)
  - [x] **Mark as read** (single or bulk)
  - [x] **Get unread count**
  - [x] **Update preferences** — enable/disable notification types
- [x] API routes:
  - [x] `GET /notifications` — list (query: unread_only, limit, offset)
  - [x] `GET /notifications/unread-count` — quick count for badge
  - [x] `PATCH /notifications/{id}/read` — mark single as read
  - [x] `POST /notifications/mark-all-read` — bulk mark read
  - [x] `GET /notifications/preferences` — get preferences
  - [x] `PATCH /notifications/preferences` — update preferences
  - [x] `GET /notifications/stream` — SSE endpoint (Redis pub/sub)
- [x] Event bus integration:
  - [x] Subscribe to `export.completed` → create notification "Your export is ready"
  - [x] Subscribe to `export.failed` → create notification "Export failed"
- [x] Register notifications router

### Tests

- [x] Unit tests for export renderers (DOCX, PDF, ePub output validity)
- [x] Integration tests for export API (job lifecycle, scope filtering)
- [x] Integration tests for billing API (free plan, checkout stub, webhook)
- [x] Integration tests for notifications API (CRUD, preferences, mark read)

---

## Frontend Tasks

### Export Dialog

- [x] Export button in project toolbar
- [x] Export dialog (modal):
  - [x] Format selection: DOCX, PDF, ePub (cards)
  - [x] Template selection: dropdown filtered by format
  - [x] Scope selection: "Full manuscript" (default) or "Selected chapters" (checkbox list)
  - [x] "Export" button → calls API → shows progress
- [x] Export progress indicator:
  - [x] After clicking Export: spinner
  - [x] Poll job status every 2 seconds until complete
  - [x] On complete: show "Download" button + success message
  - [x] On failure: show error message + "Try Again" button
- [x] Export history: last 5 exports with status, format, date, download link

### Billing Page

- [x] Billing page accessible from sidebar (`/billing`)
- [x] Current plan display: plan name, status badge
- [x] Plan comparison cards: Free / Core / AI Starter / AI Pro with pricing
- [x] Feature matrix showing what each tier includes
- [x] "Purchase" / "Subscribe" button → calls checkout mutation → redirects to URL
- [x] "Manage Subscription" button for AI tiers → billing portal

### Notifications

- [x] Notification bell icon in top bar with unread badge
- [x] NotificationPanel dropdown: list with icons, timestamps, read/unread dot
- [x] "Mark all as read" button
- [x] SSE stream via `useNotificationStream()` in TopBar — keeps badge current
- [x] Toast notifications (sonner) on export_complete / export_failed

### UI/UX Polish Pass

- [x] **Loading states** — skeleton loaders:
  - [x] Codex entry list (Skeleton component)
  - [x] Version history panel (Skeleton component)
  - [x] Project list (DashboardPage — already had animate-pulse)
- [x] **Error boundary:** `ErrorBoundary` class component wrapping `<App />`
- [x] **Empty states:**
  - [x] No projects → "Create your first project" (DashboardPage)
  - [x] Empty binder → improved empty state text
  - [x] No codex entries → icon + "Start building your world"
  - [x] No snapshots → icon + "Your version history will appear here"
- [x] **Keyboard shortcuts panel:** `?` key opens overlay from ProjectPage
- [x] **Toast notifications:** `<Toaster />` added to App.tsx (bottom-right, rich colors)
- [x] **Skeleton component** (`src/components/common/Skeleton.tsx`)
- [x] **ErrorBoundary component** (`src/components/common/ErrorBoundary.tsx`)
- [x] **KeyboardShortcutsPanel component** (`src/components/common/KeyboardShortcutsPanel.tsx`)

### React Query / Zustand Integration

- [x] `useCreateExport(projectId)` — mutation
- [x] `useExportJob(projectId, jobId)` — polls every 2s while in-flight
- [x] `useExportHistory(projectId)` — list exports
- [x] `useExportTemplates(format?)` — list templates
- [x] `useCheckout(plan)` — creates checkout session, redirects on success
- [x] `useSubscription()` — get current subscription
- [x] `useBillingPortal()` — creates portal session, redirects on success
- [x] `useNotifications(options)` — list notifications
- [x] `useUnreadCount()` — reads from notificationStore (kept fresh by SSE)
- [x] `useMarkRead(id)` — mark single notification read
- [x] `useMarkAllRead()` — bulk mark read
- [x] `useNotificationStream()` — SSE effect hook
- [x] `notificationStore` (Zustand, ephemeral) — unreadCount, setUnreadCount, inc/dec
- [x] API clients: `api/export.ts`, `api/billing.ts`, `api/notifications.ts`

---

## Definition of Done

- [x] Export dialog with DOCX/PDF/ePub format selection + templates + scope
- [x] Export job polling + download on completion
- [x] Billing page with plan comparison + checkout + portal links
- [x] Notification bell with SSE + badge + panel
- [x] Toast notifications for export events
- [x] Keyboard shortcuts panel (`?` key)
- [x] Skeleton loaders in Codex + VersionHistory
- [x] ErrorBoundary wrapping App
- [x] TypeScript: zero errors (`npx tsc --noEmit`)
- [ ] `alembic upgrade head` — migration 0006 applies cleanly
- [ ] All tests pass (`pytest`, `npm test`)
- [ ] CI green
