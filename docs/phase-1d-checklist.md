# Phase 1d: Versioning, Goals & Focus Mode — Task Checklist

**Duration:** Weeks 11–13
**Goal:** Snapshot system for version history (delta-based with keyframes), word count goals with streaks, writing session tracking, and distraction-free focus mode.
**Depends on:** Phase 1b (document content, save flow, event bus)

---

## Backend Tasks

### Database Migrations

- [x] Create migration: `snapshots` table
  - See `docs/writing-app-architecture.md` §3 for exact schema
  - Columns: `id`, `project_id`, `binder_node_id` (nullable — NULL = project-level snapshot), `name` (user label), `snapshot_type` ('manual' | 'auto' | 'pre_ai' | 'branch_point'), `parent_snapshot_id` (self-referencing FK), `word_count`, `created_at`
- [x] Create migration: `snapshot_deltas` table
  - Columns: `id`, `snapshot_id` (FK), `binder_node_id` (FK), `delta_gcs_key` (GCS/MinIO object key for compressed diff), `delta_size_bytes`, `base_snapshot_id` (FK — what this delta is relative to)
- [x] Create migration: `goals` table
  - Columns: `id`, `user_id` (FK), `project_id` (FK, nullable), `goal_type` ('daily' | 'project' | 'session'), `target_words`, `deadline` (DATE, nullable), `created_at`
- [x] Create migration: `writing_sessions` table
  - Columns: `id`, `user_id` (FK), `project_id` (FK), `started_at`, `ended_at`, `words_written`, `words_deleted`, `net_words`
- [x] Verify indexes: `snapshots(project_id)`, `snapshots(binder_node_id)`, `snapshot_deltas(snapshot_id)`, `goals(user_id)`, `writing_sessions(user_id, project_id)`

### Versioning Module (`app/modules/versioning/`)

- [x] Create module structure: `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`
- [x] SQLAlchemy models: `Snapshot`, `SnapshotDelta`
- [x] Pydantic schemas:
  - [x] `SnapshotCreate` — binder_node_id (optional), name (optional)
  - [x] `SnapshotResponse` — full snapshot with id, type, word_count, timestamps
  - [x] `SnapshotList` — paginated list for a document or project
  - [x] `SnapshotDiffResponse` — structured diff (additions/deletions/changes) for UI rendering
  - [x] `SnapshotRestoreResponse` — confirmation with restored content preview
- [x] Service layer (`versioning/service.py`):
  - [x] **Create manual snapshot:** capture current document content, compute JSON Patch diff (RFC 6902) from last snapshot, zstd-compress, upload to GCS/MinIO, create snapshot + delta records
  - [x] **Keyframe logic:** every 10th snapshot stores full content (not a delta). Track count per binder_node_id
  - [x] **Create auto-snapshot:** same as manual but triggered by event, only if delta > 50 chars changed
  - [x] **List snapshots** for a document (binder_node_id) or project, ordered by created_at desc
  - [x] **Get single snapshot** with metadata
  - [x] **Restore snapshot:** walk delta chain back to nearest keyframe, apply JSON Patches forward to reconstruct full content, replace current document_content
  - [x] **Diff between two snapshots:** reconstruct both, compute structured diff for UI
  - [x] **Delete snapshot:** remove GCS object + DB record, recompute delta chain if needed (or just mark as deleted)
- [x] GCS/MinIO integration:
  - [x] Upload compressed delta to `snapshots/{project_id}/{node_id}/{snapshot_id}.zst`
  - [x] Upload keyframe (full content) to `snapshots/{project_id}/{node_id}/{snapshot_id}.full.zst`
  - [x] Download and decompress for restore/diff operations
- [x] API routes (`app/modules/versioning/router.py`):
  - [x] `GET /projects/{project_id}/snapshots` — list snapshots (query param: `binder_node_id`)
  - [x] `POST /projects/{project_id}/snapshots` — create manual snapshot
  - [x] `GET /projects/{project_id}/snapshots/{snapshot_id}` — get snapshot metadata
  - [x] `GET /projects/{project_id}/snapshots/{snapshot_id}/diff` — diff against current or another snapshot (query param: `compare_to`)
  - [x] `POST /projects/{project_id}/snapshots/{snapshot_id}/restore` — restore content
  - [x] `DELETE /projects/{project_id}/snapshots/{snapshot_id}` — delete snapshot
  - [x] `GET /projects/{project_id}/documents/{node_id}/history` — document-level snapshot list (shortcut)
- [x] Authorization: snapshots scoped to user's projects
- [x] Register versioning router

### Goals Module (`app/modules/goals/`)

- [x] Create module structure: `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`
- [x] SQLAlchemy models: `Goal`, `WritingSession`
- [x] Pydantic schemas:
  - [x] `GoalCreate` — goal_type, target_words, project_id (optional), deadline (optional)
  - [x] `GoalUpdate` — target_words, deadline (optional)
  - [x] `GoalResponse` — full goal with progress (current words vs target)
  - [x] `GoalStats` — writing analytics for a date range
  - [x] `StreakResponse` — current streak count, longest streak, last active date
  - [x] `WritingSessionStart` — project_id
  - [x] `WritingSessionEnd` — words_written, words_deleted, net_words
  - [x] `WritingSessionResponse`
- [x] Service layer (`goals/service.py`):
  - [x] Goals CRUD (create, list, get, update, delete)
  - [x] **Start writing session:** create record with started_at = now()
  - [x] **End writing session:** set ended_at, words_written/deleted/net, update daily word count accumulator
  - [x] **Streak calculation:** count consecutive days where daily goal was met. Reset on miss. Track current + longest streak.
  - [x] **Stats aggregation:** words written per day/week/month for a date range, average session length, most productive times
  - [x] **Daily progress:** sum today's net_words across sessions, compare to daily goal target
- [x] Redis integration:
  - [x] Live word count accumulator: `wc:{user_id}:{date}` — increment on save, TTL 48h
  - [x] Read live count for real-time progress bar updates
- [x] API routes (`app/modules/goals/router.py`):
  - [x] `GET /goals` — list user's goals
  - [x] `POST /goals` — create goal
  - [x] `PATCH /goals/{goal_id}` — update goal
  - [x] `DELETE /goals/{goal_id}` — delete goal
  - [x] `GET /goals/stats?range=30d` — writing analytics
  - [x] `GET /goals/streak` — current streak info
  - [x] `POST /goals/sessions/start` — begin writing session
  - [x] `POST /goals/sessions/{session_id}/end` — end writing session
- [x] Authorization: goals scoped to authenticated user
- [x] Register goals router

### Celery Tasks

- [x] `create_auto_snapshot` task (queue='default'):
  - Triggered by `document.saved` event via event bus handler
  - Compute delta from last snapshot; skip if < 50 chars changed
  - Compress with zstd, upload to GCS/MinIO
  - Create snapshot record; maintain keyframe every 10th snapshot
- [x] `update_word_counts` task (queue='default'):
  - Triggered on document save
  - Recount words for document, update `binder_nodes.word_count`
  - Update project aggregate word count
  - Update `writing_sessions` and Redis live counter `wc:{user_id}:{date}`
- [x] Event bus subscriptions:
  - [x] Subscribe to `document.saved` → enqueue `create_auto_snapshot`
  - [x] Subscribe to `document.saved` → enqueue `update_word_counts`

### Tests

- [x] Unit tests for versioning service:
  - [x] Manual snapshot creation + delta storage
  - [x] Keyframe every 10th snapshot
  - [x] Restore from delta chain (test with 15+ snapshots spanning keyframes)
  - [x] Diff between two snapshots produces correct structured diff
  - [x] Delete snapshot handles chain correctly
- [x] Unit tests for goals service:
  - [x] Goals CRUD
  - [x] Writing session start/end
  - [x] Streak calculation (consecutive days, reset on miss)
  - [x] Stats aggregation over date ranges
- [x] Integration tests for versioning API endpoints
- [x] Integration tests for goals API endpoints
- [ ] Test: auto-snapshot fires on document save (event bus → Celery task)
- [ ] Test: word count updates propagate to binder_nodes and Redis

---

## Frontend Tasks

### Version History Panel

- [x] Version history panel component (sidebar panel or slide-over):
  - [x] Opens from document toolbar button ("History" / clock icon)
  - [x] List snapshots for current document, newest first
  - [x] Each item shows: name/label (or "Auto-save"), date/time, word count
  - [x] Manual snapshot button: text input for label → POST to create snapshot
  - [x] Click snapshot → show diff view
- [x] Snapshot badges: visual distinction for manual vs auto snapshots

### Diff Viewer

- [x] Side-by-side diff view:
  - [x] Left = snapshot content, Right = current (or another snapshot)
  - [x] Color-coded: green for additions, red for deletions, yellow for changes
  - [ ] Synchronized scrolling between panels
- [ ] Inline diff view (alternative toggle):
  - [ ] Single column with inline additions/deletions marked
- [x] Dropdown to select comparison target (current, or pick another snapshot)

### Restore Flow

- [x] Restore button on snapshot detail
- [x] Confirmation dialog: "This will replace current content with the snapshot from [date]. This action creates a new snapshot of the current state before restoring."
- [x] Preview of snapshot content before confirming
- [x] On confirm: call restore API → reload editor content → show success toast

### Goals Dashboard

- [x] Goals settings panel (accessible from toolbar or settings):
  - [x] Set daily word count target (number input)
  - [x] Set project word count target + optional deadline
  - [x] Set session word count target
  - [x] Save/update/delete goals
- [x] Progress display (visible in main editor view — bottom bar or sidebar widget):
  - [x] Daily progress bar: words written today / daily target
  - [x] Project progress bar: total words / project target
  - [x] Session progress: words this session / session target
  - [x] Percentage and raw number labels
- [x] Streak display:
  - [x] Current streak count with fire emoji (🔥) or similar
  - [x] Longest streak record
  - [ ] Visual calendar heatmap (optional — stretch goal): days colored by word count

### Writing Session Tracking

- [x] Auto-start session on first keystroke in editor
- [x] Session timer visible in bottom bar (elapsed time)
- [x] Words written this session counter (real-time, updated on save or debounced)
- [x] End session on:
  - [ ] Manual "End Session" button
  - [x] Inactivity timeout (e.g., 15 min no keystrokes)
  - [x] Navigating away / closing editor
- [ ] Session summary toast on end: "You wrote X words in Y minutes"

### Focus / Distraction-Free Mode

- [x] Focus mode toggle:
  - [x] Keyboard shortcut: `F11`
  - [x] Toolbar button (eye icon or expand icon)
- [x] Focus mode behavior:
  - [x] Full-screen editor (hide sidebar, toolbar, status bar, all chrome)
  - [x] Typewriter scrolling: current line/paragraph stays vertically centered
  - [ ] Minimal floating toolbar on text selection (bold, italic, etc.)
  - [x] Word count + session timer still visible (subtle, bottom-right)
  - [x] `Escape` exits focus mode
- [x] Ambient themes (3–4 options):
  - [x] **Minimal** — clean white/light gray
  - [x] **Dark** — dark background, light text
  - [x] **Sepia** — warm yellowish tones (classic e-reader feel)
  - [x] **Forest** — dark green tones
- [x] Theme picker accessible in focus mode (small gear icon, corner)
- [x] Persist selected theme in user preferences (localStorage or user settings API)

### Zustand / React Query Integration

- [x] React Query hooks:
  - [x] `useSnapshots(projectId, nodeId?)` — list snapshots
  - [x] `useCreateSnapshot(projectId)` — manual snapshot mutation
  - [x] `useSnapshotDiff(projectId, snapshotId, compareTo?)` — diff query
  - [x] `useRestoreSnapshot(projectId, snapshotId)` — restore mutation
  - [x] `useDeleteSnapshot(projectId, snapshotId)`
  - [x] `useGoals()` — list user's goals
  - [x] `useCreateGoal`, `useUpdateGoal`, `useDeleteGoal`
  - [x] `useGoalStats(range)` — writing analytics
  - [x] `useStreak()` — current streak info
  - [x] `useStartSession(projectId)`, `useEndSession(sessionId)`
- [x] API client functions for all versioning and goals endpoints
- [x] Zustand store:
  - [x] Focus mode state: `focusMode`, `focusTheme` (persisted)
  - [x] Active writing session: `sessionId`, `sessionStartTime`, `wordsAtSessionStart`
  - [x] Version history panel open/closed (via `activePanel` in editorStore)

---

## Fullstack / Integration Tasks

- [x] Auto-snapshot integration:
  - [x] Backend `document.saved` event → enqueue `create_auto_snapshot` Celery task
  - [x] Task computes delta, compresses, uploads to MinIO/GCS, creates DB records
  - [x] Frontend version history panel refreshes (React Query invalidation) after save
- [x] Word count tracking pipeline:
  - [x] On document save → `update_word_counts` task fires
  - [x] Task updates `binder_nodes.word_count`, project aggregate, Redis live counter
  - [x] Frontend reads Redis counter (via goals stats endpoint or WebSocket) for real-time progress bar
  - [x] Writing session tracks net words (written - deleted)
- [x] Restore safety:
  - [x] Restore endpoint creates an auto-snapshot of current content BEFORE overwriting
  - [x] User can always "undo" a restore by restoring the pre-restore snapshot
- [x] Focus mode persistence:
  - [x] Theme preference saved to localStorage
  - [x] Focus mode state does NOT persist across page reloads (intentional — user re-enters consciously)
- [ ] Integration tests:
  - [ ] Write document → save → verify auto-snapshot created in MinIO with correct delta
  - [ ] Create 15+ snapshots → verify keyframes at snapshot 1, 11 → restore snapshot 7 → verify correct content
  - [ ] Restore snapshot → verify pre-restore snapshot auto-created
  - [ ] Diff between snapshot 3 and snapshot 8 → verify correct additions/deletions
  - [ ] Start writing session → write 500 words → end session → verify words_written = 500, daily progress updated
  - [ ] Set daily goal of 1000 words → write 1000+ words across sessions → verify streak increments
  - [ ] Focus mode → typewriter scroll → verify current line stays centered
  - [ ] Focus mode theme switch → exit → re-enter → verify theme persisted

---

## Definition of Done

- [x] Manual snapshot creates a labeled version, visible in history panel
- [x] Auto-snapshots fire on save for non-trivial changes (> 50 chars delta)
- [x] Delta-based storage with keyframe every 10th snapshot works correctly
- [x] GCS/MinIO stores compressed deltas; Postgres stores only metadata/pointers
- [x] Diff view correctly shows additions/deletions between any two snapshots
- [x] Restore replaces current content with snapshot content (with pre-restore safety snapshot)
- [ ] Delta chain + keyframe restore verified with 15+ snapshots
- [x] User sets daily word goal, sees progress bar update as they write
- [x] Streak counter increments on days goal is met, resets on miss
- [x] Writing session auto-starts on typing, shows words written + elapsed time
- [x] Focus mode hides all chrome, typewriter scroll works, Escape exits
- [x] 3+ ambient themes available and persisted
- [ ] All tests pass, CI green
