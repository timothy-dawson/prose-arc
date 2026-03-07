# Phase 1f: MVP Hardening & Beta Launch — Task Checklist

**Duration:** Weeks 17–18
**Goal:** Security audit, performance testing, staging/production deployment, monitoring, user onboarding flow, and invite-only beta launch. No new features — hardening, testing, and deployment only.
**Depends on:** All Phase 1 phases complete (1a–1e)

---

## Security Audit

### Input Validation

- [ ] Audit all API endpoints for Pydantic model validation (no raw dict inputs)
- [ ] Enforce size limits on all text fields:
  - [ ] Document content: max 5MB per document
  - [ ] Codex entry descriptions: max 500KB
  - [ ] Snapshot names/labels: max 255 chars
  - [ ] Project names: max 255 chars
  - [ ] Synopsis fields: max 10KB
- [ ] Validate file uploads:
  - [ ] Image uploads: max 10MB, content-type whitelist (image/jpeg, image/png, image/gif, image/webp)
  - [ ] Verify content-type matches actual file content (magic bytes check)
- [ ] Sanitize all user-supplied strings that appear in HTML exports (XSS prevention)
- [ ] Validate binder node IDs, project IDs, etc. are UUIDs (not arbitrary strings)

### Rate Limiting

- [ ] Install and configure slowapi (or custom middleware)
- [ ] Rate limits per endpoint category:
  - [ ] Auth endpoints (login, register, password reset): 5 req/min per IP
  - [ ] Export creation: 10 req/hour per user
  - [ ] AI endpoints (future-proofing): 20 req/min per user
  - [ ] General API: 100 req/min per user
  - [ ] Webhook endpoints: no user rate limit (Stripe IPs only)
- [ ] Return proper 429 responses with `Retry-After` header
- [ ] Rate limit storage: Redis

### Authentication & Authorization

- [ ] Verify all protected endpoints require valid JWT
- [ ] Verify project-scoped endpoints check project ownership
- [ ] Verify no IDOR vulnerabilities: user A cannot access user B's projects/documents/exports
- [ ] JWT secret is strong (min 256-bit) and loaded from environment/Secret Manager
- [ ] JWT refresh token rotation: old refresh tokens invalidated on use
- [ ] Password reset flow: time-limited tokens (1 hour), single-use
- [ ] OAuth state parameter validated (CSRF protection)

### CORS & Headers

- [ ] CORS origins locked to production domain(s) only (no wildcard in prod)
- [ ] Security headers middleware:
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - [ ] `X-XSS-Protection: 0` (rely on CSP instead)
  - [ ] Content-Security-Policy (appropriate for SPA)
- [ ] HTTPS enforced in production (Cloud Run handles TLS termination)

### Database Security

- [ ] Verify all queries use parameterized statements (SQLAlchemy ORM — confirm no raw SQL with string interpolation)
- [ ] Database user has minimum required permissions (no superuser)
- [ ] Connection string uses SSL in production (`sslmode=require`)

### Stripe Security

- [ ] Webhook signature verification is enforced (reject invalid signatures)
- [ ] Stripe secret key never exposed to frontend
- [ ] Checkout sessions use `success_url` and `cancel_url` on allowed domains only

### OWASP Top 10 Checklist

- [ ] A01: Broken Access Control — IDOR audit complete, all endpoints scoped
- [ ] A02: Cryptographic Failures — JWT secrets strong, passwords hashed (bcrypt), BYOK keys encrypted (Fernet)
- [ ] A03: Injection — parameterized queries, input validation
- [ ] A04: Insecure Design — rate limiting, account lockout after failed logins
- [ ] A05: Security Misconfiguration — CORS locked, debug off in prod, no default credentials
- [ ] A06: Vulnerable Components — `pip audit` and `npm audit` clean (or known issues documented)
- [ ] A07: Auth Failures — strong passwords enforced, JWT expiry appropriate
- [ ] A08: Data Integrity — webhook signatures verified, CSRF protection on state-changing endpoints
- [ ] A09: Logging Failures — structured logging for auth events, failed access attempts
- [ ] A10: SSRF — no user-supplied URLs fetched server-side (except controlled integrations)

---

## Performance Testing

### Load Testing

- [ ] Set up load testing tool (locust, k6, or similar)
- [ ] Test scenarios:
  - [ ] Document save: 100 concurrent users, target < 1s p95
  - [ ] Binder tree load: 100 concurrent users, target < 500ms p95
  - [ ] Full-text search: 50 concurrent users, target < 500ms p95
  - [ ] Export creation: 20 concurrent users, target < 5s to enqueue
  - [ ] Auth (login): 50 concurrent users, target < 500ms p95
  - [ ] Codex list/search: 50 concurrent users, target < 500ms p95
- [ ] Run against staging environment (not local dev)
- [ ] Document results and bottlenecks

### Database Optimization

- [ ] Run `EXPLAIN ANALYZE` on all major queries:
  - [ ] Project list by user
  - [ ] Binder tree load for project
  - [ ] Document content load
  - [ ] Full-text search
  - [ ] Codex entries list/filter
  - [ ] Snapshot list for document
  - [ ] Goals/stats aggregation
  - [ ] Notification list
- [ ] Add missing indexes identified by slow queries
- [ ] Verify connection pooling configuration (SQLAlchemy pool size appropriate for Cloud Run concurrency)
- [ ] Verify N+1 query issues resolved (use `selectinload`/`joinedload` appropriately)

### Frontend Performance

- [ ] Lighthouse audit: target > 80 for Performance, Accessibility, Best Practices
- [ ] Bundle size analysis (`vite-plugin-visualizer` or similar):
  - [ ] Identify and lazy-load heavy components
  - [ ] Verify tree-shaking is working (no full library imports)
  - [ ] Total JS bundle < 500KB gzipped (target)
- [ ] Verify code splitting: routes lazy-loaded
- [ ] Image optimization: all images compressed, appropriate formats

---

## Staging Deployment

### GCP Infrastructure Setup

- [ ] Cloud SQL instance: `db-f1-micro` (staging), PostgreSQL 16, 10GB SSD
  - [ ] Enable ltree extension
  - [ ] Create database and user
  - [ ] SSL connection enforced
- [ ] Memorystore Redis: Basic M1, 1GB
- [ ] GCS bucket: `prosearc-staging` with lifecycle policy (30-day cleanup for exports)
- [ ] Cloud Run service (backend):
  - [ ] 1 instance, 2 vCPU / 4GB RAM
  - [ ] Environment variables from Secret Manager
  - [ ] Health check endpoint configured
  - [ ] Min instances: 0, Max instances: 3
- [ ] Cloud Run service (Celery worker):
  - [ ] Separate service or Cloud Run Jobs for async tasks
  - [ ] All 3 queues: default, ai, export
- [ ] Frontend: Cloud Storage static hosting + Cloud CDN
  - [ ] Build React app → upload to GCS bucket
  - [ ] CDN cache configuration (cache static assets, no-cache for index.html)
- [ ] Artifact Registry: Docker image repository for backend images

### CI/CD Pipeline

- [ ] GitHub Actions workflow for staging deploy:
  - [ ] Trigger: merge to `staging` branch
  - [ ] Steps: lint → type-check → test → build Docker image → push to Artifact Registry → deploy to Cloud Run
  - [ ] Frontend: build → upload to GCS → invalidate CDN cache
- [ ] Alembic migrations run as part of deploy (pre-deploy step)
- [ ] Rollback procedure documented (redeploy previous image tag)

### DNS & SSL

- [ ] Staging subdomain: `staging.prosearc.com` (or similar)
- [ ] SSL certificate: managed by Cloud Run (auto-provisioned)
- [ ] Custom domain mapping on Cloud Run

### Environment Configuration

- [ ] All secrets in GCP Secret Manager:
  - [ ] `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - [ ] `MINIO_*` replaced with `GCS_*` config
- [ ] `APP_ENV=staging` with appropriate feature flags
- [ ] Stripe test mode keys for staging

---

## Production Deployment

### GCP Infrastructure Setup

- [ ] Cloud SQL instance: `db-custom-2-4096`, PostgreSQL 16, 100GB SSD
  - [ ] 1 read replica (for search/analytics queries)
  - [ ] Automated daily backups, 7-day retention
  - [ ] Point-in-time recovery enabled
  - [ ] SSL enforced, private IP (VPC connector)
- [ ] Memorystore Redis: Basic M1, 1GB
- [ ] GCS buckets:
  - [ ] `prosearc-prod` (primary: documents, snapshots, exports)
  - [ ] Lifecycle policy: exports expire after 7 days, snapshots retained indefinitely
  - [ ] Nearline storage class for old snapshots (> 90 days)
- [ ] Cloud Run service (backend):
  - [ ] 2 instances (min 1 always-on), 2 vCPU / 4GB RAM
  - [ ] VPC connector for Cloud SQL private IP
  - [ ] Concurrency: 80 requests per instance
  - [ ] Request timeout: 300s (for long exports)
- [ ] Celery workers: GCE e2-small × 3 (spot VMs for export/default, on-demand for AI queue)
  - [ ] Supervisor or systemd for process management
  - [ ] Auto-restart on failure
- [ ] Cloud CDN for frontend static assets (global edge caching)
- [ ] Cloud Armor (WAF):
  - [ ] Rate limiting rules
  - [ ] Geographic restrictions (if needed)
  - [ ] Bot/DDoS protection

### DNS & SSL (Production)

- [ ] `prosearc.com` and `www.prosearc.com` → Cloud Run / CDN
- [ ] `api.prosearc.com` → Cloud Run backend
- [ ] Managed SSL certificates (auto-renewal)
- [ ] DNS via Cloud DNS or Cloudflare

### Secrets & Configuration

- [ ] All production secrets in Secret Manager (separate from staging)
- [ ] JWT secret: cryptographically random, 256+ bits
- [ ] Stripe live mode keys
- [ ] JWT secret rotation plan documented (but not yet rotated)

### CI/CD (Production)

- [ ] GitHub Actions workflow for production deploy:
  - [ ] Trigger: merge to `main` branch (or manual approval)
  - [ ] Same pipeline as staging + manual approval gate
  - [ ] Blue-green or rolling deployment (Cloud Run handles this)
- [ ] Rollback: one-click redeploy of previous revision in Cloud Run

---

## Monitoring & Alerting

### Error Tracking

- [ ] Sentry integration:
  - [ ] Backend: `sentry-sdk[fastapi]` configured with environment tag
  - [ ] Frontend: `@sentry/react` configured with environment tag
  - [ ] Source maps uploaded for frontend (for readable stack traces)
  - [ ] Alert rules: notify on first occurrence of new error
  - [ ] Ignore known non-errors (404s on expected paths, etc.)

### Cloud Monitoring

- [ ] Dashboards:
  - [ ] API health: request count, latency (p50/p95/p99), error rate (4xx/5xx)
  - [ ] Cloud Run: instance count, CPU utilization, memory utilization, request count
  - [ ] Cloud SQL: connections, query latency, CPU, storage usage
  - [ ] Redis: memory usage, connected clients, command latency
  - [ ] Celery: queue depth, task success/failure rate, task duration
- [ ] Alert policies:
  - [ ] 5xx error rate > 5% for 5 minutes → PagerDuty/email/Slack
  - [ ] API latency p95 > 2s for 5 minutes → warning
  - [ ] Cloud SQL CPU > 80% for 10 minutes → warning
  - [ ] Cloud SQL storage > 80% → warning
  - [ ] Redis memory > 80% → warning
  - [ ] Celery queue depth > 100 for 10 minutes → warning
  - [ ] Zero healthy Cloud Run instances → critical

### Logging

- [ ] Structured logging (structlog) with JSON output
- [ ] Log levels: INFO for requests, WARNING for recoverable errors, ERROR for failures
- [ ] Request ID tracing: unique ID per request, propagated through Celery tasks
- [ ] Cloud Logging integration (automatic with Cloud Run)
- [ ] Log-based metrics for business events (signups, exports, purchases)

### Uptime Monitoring

- [ ] Cloud Monitoring uptime check: health endpoint every 1 minute
- [ ] External uptime monitor (UptimeRobot or similar) as backup
- [ ] Status page (optional — can use Instatus or similar free tier)

---

## User Onboarding

### First-Run Experience

- [ ] New user detection: check if user has zero projects
- [ ] Project creation wizard (step-by-step modal):
  - [ ] Step 1: "Welcome to Prose Arc!" — brief intro (2–3 sentences)
  - [ ] Step 2: "Create your first project" — project name, genre (optional), description (optional)
  - [ ] Step 3: "Choose a starting structure" — blank project, or pre-populated with sample chapter/scene
  - [ ] Step 4: Project created → redirect to editor with tooltip tour
- [ ] Option to skip wizard ("I'll explore on my own")

### Tooltip Tour

- [ ] Guided tour library (react-joyride, shepherd.js, or custom)
- [ ] Tour stops (5–7 key areas):
  1. **Binder tree** — "Organize your chapters and scenes here. Drag to reorder."
  2. **Editor** — "Write here. Changes auto-save every 3 seconds."
  3. **Codex** — "Build your world: characters, locations, items, lore."
  4. **Version history** — "Snapshots of your work. Restore any previous version."
  5. **Goals** — "Set daily word count targets and track your streaks."
  6. **Focus mode** — "Press F11 for distraction-free writing."
  7. **Export** — "When you're ready, export to DOCX, PDF, or ePub."
- [ ] Tour runs once per user (track completion in localStorage or user settings)
- [ ] "Replay tour" option in settings/help menu

### Sample Project

- [ ] Pre-built sample project with demo content:
  - [ ] 2–3 chapters with sample text (public domain excerpt or original)
  - [ ] A few codex entries (characters, location)
  - [ ] A scene with synopsis in kanban view
  - [ ] A snapshot to demonstrate version history
- [ ] Offered as option during onboarding wizard
- [ ] User can delete it when done exploring

### Help & Documentation

- [ ] Help docs (user-facing):
  - [ ] Getting started guide
  - [ ] Editor shortcuts reference
  - [ ] Export guide (formats, templates)
  - [ ] Codex usage guide
  - [ ] Goals & focus mode guide
- [ ] In-app help link (? icon in sidebar → opens docs in new tab)
- [ ] Keyboard shortcuts panel (already in 1e polish — verify it works)

---

## Beta Launch Preparation

### Invite System

- [ ] Beta invite mechanism (choose one):
  - [ ] **Option A: Invite codes** — generate batch of codes, user enters code at registration
  - [ ] **Option B: Email whitelist** — admin adds emails, only whitelisted emails can register
  - [ ] **Option C: Waitlist** — public signup form, admin approves in batches
- [ ] Admin interface (can be simple — CLI script or basic admin page):
  - [ ] Generate invite codes / add emails to whitelist
  - [ ] View registered beta users
  - [ ] Disable/enable registration

### Beta Feedback Collection

- [ ] In-app feedback widget:
  - [ ] Small "Feedback" button (floating, bottom-right or sidebar)
  - [ ] Click → modal: text area + category (bug, feature request, general) + optional screenshot
  - [ ] Submit → store in DB or send to external service (Google Form, Canny, or simple email)
- [ ] Weekly feedback survey (external — Google Forms or Typeform):
  - [ ] Link shown in-app notification once per week
  - [ ] Questions: NPS, feature satisfaction, pain points, feature requests

### Pre-Launch Testing

- [ ] Full end-to-end smoke test on production:
  - [ ] Register new account (email + Google OAuth)
  - [ ] Create project, add chapters, write content
  - [ ] Create codex entries, link to manuscript
  - [ ] Kanban view works, synopsis editing works
  - [ ] Take manual snapshot, view diff, restore
  - [ ] Set daily goal, verify progress tracking
  - [ ] Focus mode with all themes
  - [ ] Export DOCX, PDF, ePub — download and verify
  - [ ] Purchase via Stripe (test mode if not yet live)
  - [ ] Notifications appear for export completion
  - [ ] Keyboard shortcuts panel opens
- [ ] Cross-browser verification: Chrome, Firefox, Safari, Edge
- [ ] Mobile/tablet: verify graceful degradation (not full mobile support, but usable)

### Runbook / Operations Documentation

- [ ] Deploy process: step-by-step for staging and production
- [ ] Rollback procedure: how to revert a bad deploy
- [ ] Database migration: how to run, how to rollback
- [ ] Incident response:
  - [ ] Who to contact
  - [ ] How to check logs (Cloud Logging)
  - [ ] How to check errors (Sentry)
  - [ ] How to restart services
  - [ ] How to scale up (increase Cloud Run instances)
- [ ] Backup & restore: how to restore from Cloud SQL backup
- [ ] Secret rotation: process for rotating JWT secret, Stripe keys

---

## Definition of Done

- [ ] Staging environment deployed and accessible at staging URL
- [ ] Production environment deployed and accessible at prosearc.com
- [ ] All API endpoints have input validation and rate limiting
- [ ] OWASP Top 10 checklist reviewed and addressed
- [ ] Sentry captures errors, Cloud Monitoring dashboards operational
- [ ] Alert policies configured and tested (trigger a test alert)
- [ ] Load test passes: 100 concurrent users at target latencies
- [ ] Zero known critical or high-severity bugs
- [ ] Onboarding flow guides new user through first project creation
- [ ] Tooltip tour covers key UI areas
- [ ] Sample project available for new users
- [ ] Beta invite system works (codes, whitelist, or waitlist)
- [ ] In-app feedback widget functional
- [ ] Help docs published and linked from app
- [ ] Runbook documented for deploys, rollbacks, incidents
- [ ] Full smoke test passes on production
- [ ] Cross-browser testing complete
- [ ] **Beta launch: 20–50 invited users** 🚀
- [ ] All tests pass, CI green
