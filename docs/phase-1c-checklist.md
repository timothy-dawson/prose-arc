# Phase 1c: Worldbuilding Codex & Basic Outlining — Task Checklist

**Duration:** Weeks 8–10  
**Goal:** Structured worldbuilding entries (characters, locations, items, lore) with cross-linking, codex mentions in the editor, per-scene synopsis, and kanban board view.  
**Depends on:** Phase 1b (manuscript module, binder tree, TipTap editor)

---

## Backend Tasks

### Database Migrations

- [ ] Create migration: `codex_entries` table
  - See `docs/writing-app-architecture.md` §3 for exact schema
  - Columns: `id`, `project_id`, `entry_type` (character|location|item|lore|custom), `name`, `summary`, `content` (JSONB — structured fields varying by type), `tags` (TEXT[]), `image_url`, `created_at`, `updated_at`
- [ ] Create migration: `codex_links` table
  - Composite PK: `(source_id, target_id)`
  - `link_type` (related|parent_of|ally|enemy|custom), `metadata` (JSONB)
- [ ] Create migration: `codex_mentions` table
  - Composite PK: `(binder_node_id, codex_entry_id)`
  - Cross-reference: which binder nodes mention which codex entries
- [ ] Create migration: `outlines` table
  - `project_id`, `template_type` (three_act|save_the_cat|heros_journey|custom), `structure` (JSONB)
- [ ] Create migration: `beats` table
  - `outline_id`, `binder_node_id` (nullable — links beat to actual chapter/scene), `label`, `description`, `act` (INT), `sort_order`, `metadata` (JSONB)
- [ ] Verify `binder_nodes.synopsis` column already exists in schema (added in 1b migration); if not, add it

### Codex Module (`app/modules/codex/`)

- [ ] Create module structure: `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`
- [ ] SQLAlchemy models: `CodexEntry`, `CodexLink`, `CodexMention`
- [ ] Pydantic schemas:
  - [ ] `CodexEntryCreate` — name, entry_type, summary, content, tags
  - [ ] `CodexEntryUpdate` — all fields optional
  - [ ] `CodexEntryResponse` — full entry with id, timestamps
  - [ ] `CodexEntryList` — paginated list with filtering
  - [ ] `CodexLinkCreate` — source_id, target_id, link_type, metadata
  - [ ] `CodexLinkResponse`
  - [ ] `CodexMentionCreate` — binder_node_id, codex_entry_id
  - [ ] `CodexMentionResponse`
- [ ] Service layer (`codex/service.py`):
  - [ ] Create codex entry (validate entry_type, store structured content)
  - [ ] List codex entries for project (filter by entry_type, search by name/tags)
  - [ ] Get single codex entry
  - [ ] Update codex entry
  - [ ] Delete codex entry (cascades links and mentions)
  - [ ] Create/delete codex link between entries (validate both belong to same project)
  - [ ] Get links for an entry (both directions — outgoing and incoming)
  - [ ] Create/delete codex mention (link binder node ↔ codex entry)
  - [ ] Get mentions for an entry (which scenes reference it)
  - [ ] Get mentions for a binder node (which codex entries are mentioned)
- [ ] Image upload for codex entries:
  - [ ] SHA-256 dedup: compute hash before upload, reuse existing object if hash matches
  - [ ] Upload to GCS (MinIO in dev), store URL in `codex_entries.image_url`
  - [ ] Endpoint: `POST /projects/{project_id}/codex/{entry_id}/image`
- [ ] API routes (`app/api/v1/codex.py`):
  - [ ] `GET /projects/{project_id}/codex` — list entries (query params: `entry_type`, `search`, `tags`)
  - [ ] `POST /projects/{project_id}/codex` — create entry
  - [ ] `GET /projects/{project_id}/codex/{entry_id}` — get entry
  - [ ] `PATCH /projects/{project_id}/codex/{entry_id}` — update entry
  - [ ] `DELETE /projects/{project_id}/codex/{entry_id}` — delete entry
  - [ ] `GET /projects/{project_id}/codex/{entry_id}/mentions` — which binder nodes reference this entry
  - [ ] `POST /projects/{project_id}/codex/link` — create link between entries
  - [ ] `DELETE /projects/{project_id}/codex/link/{source_id}/{target_id}` — delete link
  - [ ] `POST /projects/{project_id}/codex/{entry_id}/image` — upload reference image
- [ ] Authorization: ensure codex entries scoped to user's projects
- [ ] Register codex router in `app/api/v1/__init__.py` (or main router file)

### Plotting Module — Foundation (`app/modules/plotting/`)

- [ ] Create module structure: `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`
- [ ] SQLAlchemy models: `Outline`, `Beat`
- [ ] Pydantic schemas:
  - [ ] `OutlineCreate`, `OutlineUpdate`, `OutlineResponse`
  - [ ] `BeatCreate`, `BeatUpdate`, `BeatResponse`
  - [ ] `BeatReorderRequest` — list of `{beat_id, sort_order}`
- [ ] Service layer (`plotting/service.py`):
  - [ ] Outline CRUD (create, list, get, update)
  - [ ] Beat CRUD (create, list for outline, get, update, delete)
  - [ ] Beat reorder (bulk update sort_order)
  - [ ] Link beat to binder node (set `binder_node_id`)
- [ ] API routes (`app/api/v1/plotting.py`):
  - [ ] `GET /projects/{project_id}/outlines` — list outlines
  - [ ] `POST /projects/{project_id}/outlines` — create outline
  - [ ] `PATCH /projects/{project_id}/outlines/{outline_id}` — update outline
  - [ ] `GET /projects/{project_id}/outlines/{outline_id}/beats` — list beats
  - [ ] `POST /projects/{project_id}/outlines/{outline_id}/beats` — create beat
  - [ ] `PATCH /projects/{project_id}/beats/{beat_id}` — update beat
  - [ ] `POST /projects/{project_id}/beats/reorder` — bulk reorder beats
- [ ] Authorization: scoped to user's projects
- [ ] Register plotting router

### Synopsis Field

- [ ] Expose `binder_nodes.synopsis` in manuscript PATCH endpoint (if not already)
- [ ] Add synopsis to binder node response schema

### Tests

- [ ] Unit tests for codex service layer (CRUD, links, mentions, image dedup)
- [ ] Unit tests for plotting service layer (outline/beat CRUD, reorder)
- [ ] Integration tests for codex API endpoints
- [ ] Integration tests for plotting API endpoints
- [ ] Test: codex entry deletion cascades links and mentions
- [ ] Test: codex link validates both entries belong to same project

---

## Frontend Tasks

### Codex Panel

- [ ] Codex panel component in sidebar (or dedicated view):
  - [ ] Tab navigation by entry type: Characters, Locations, Items, Lore, Custom
  - [ ] List entries for selected type (cards or list items with name + summary)
  - [ ] Search bar: filter entries by name
  - [ ] Tag filter: filter by tags
  - [ ] "New Entry" button per type
  - [ ] Click entry → open entry detail/edit view

### Codex Entry Form

- [ ] Dynamic form based on `entry_type`:
  - [ ] **Character:** Name, Role, Description, Motivation, Backstory, Appearance, Notes
  - [ ] **Location:** Name, Description, Geography, Significance, Notes
  - [ ] **Item:** Name, Description, Origin, Properties, Notes
  - [ ] **Lore:** Name, Category, Description, Rules/Mechanics, Notes
  - [ ] **Custom:** Name, user-defined fields
- [ ] Rich text editor for description field (lightweight TipTap instance or markdown textarea)
- [ ] Image upload with preview (drag-drop or file picker)
- [ ] Tags input (multi-select / free-text chips)
- [ ] Save / Cancel actions
- [ ] Delete entry (with confirmation dialog)

### Cross-Linking UI

- [ ] "Links" section on codex entry detail view
- [ ] "Add Link" button → search/select another codex entry → choose relationship type
- [ ] Display linked entries grouped by link type (allies, enemies, related, etc.)
- [ ] Click linked entry → navigate to that entry
- [ ] Remove link button

### Codex Mentions in Editor

- [ ] TipTap extension or mark for codex mentions:
  - [ ] Select text in editor → "Link to Codex Entry" action (toolbar button or context menu)
  - [ ] Opens search popup to find codex entry by name
  - [ ] Creates inline mention/mark in the editor content
  - [ ] Visual styling: distinct color/underline for codex mentions
- [ ] Click codex mention in editor → opens codex entry detail panel
- [ ] On document save: extract all codex mentions → sync `codex_mentions` table via API

### Outline / Synopsis Panel

- [ ] Synopsis textarea on binder node detail panel (scene/chapter properties)
- [ ] Auto-save synopsis on blur or debounced input
- [ ] Chapter summary field (aggregated or manual)

### Kanban Board

- [ ] Kanban view toggle (alongside binder tree — tab or button to switch views)
- [ ] Columns = chapters, cards = scenes within each chapter
- [ ] Card displays: scene title, synopsis snippet, word count, status badge
- [ ] Drag-and-drop within column (reorder scenes) and between columns (move scene to different chapter)
- [ ] Drag-drop updates `binder_nodes.sort_order` and `parent_id` via bulk reorder API
- [ ] Click card → navigate to that scene in the editor
- [ ] "Add Scene" button at bottom of each column
- [ ] Library: use `@dnd-kit/core` + `@dnd-kit/sortable` (or similar, consistent with 1b if already chosen)

### Zustand / React Query Integration

- [ ] React Query hooks:
  - [ ] `useCodexEntries(projectId, entryType?)` — list with filtering
  - [ ] `useCodexEntry(projectId, entryId)` — single entry
  - [ ] `useCreateCodexEntry`, `useUpdateCodexEntry`, `useDeleteCodexEntry`
  - [ ] `useCodexLinks(entryId)` — links for an entry
  - [ ] `useCreateCodexLink`, `useDeleteCodexLink`
  - [ ] `useCodexMentions(entryId)` — mentions for entry
  - [ ] `useOutlines(projectId)`, `useCreateOutline`, `useUpdateOutline`
  - [ ] `useBeats(outlineId)`, `useCreateBeat`, `useUpdateBeat`, `useReorderBeats`
- [ ] API client functions for all codex and plotting endpoints
- [ ] Zustand store: active codex entry, codex panel open/closed state
- [ ] Optimistic updates for kanban drag-drop reorder

---

## Fullstack / Integration Tasks

- [ ] Codex ↔ editor integration:
  - [ ] Clicking a codex mention in the TipTap editor opens the codex entry in the side panel
  - [ ] Codex mentions persist through save/load cycle (stored in ProseMirror JSON as marks or nodes)
  - [ ] Deleting a codex entry removes/gracefully handles dangling mentions in editor
- [ ] Kanban ↔ binder sync:
  - [ ] Reordering cards in kanban calls binder bulk reorder API
  - [ ] Moving a card between columns updates `parent_id` (chapter reassignment)
  - [ ] Binder tree view reflects kanban changes in real-time (React Query invalidation)
- [ ] Synopsis ↔ kanban sync:
  - [ ] Synopsis edited in scene detail reflects on kanban card
  - [ ] Synopsis snippet on kanban card is truncated with ellipsis
- [ ] Image upload e2e:
  - [ ] Upload image → stored in MinIO (dev) / GCS (prod) → URL saved → displayed in codex entry
  - [ ] SHA-256 dedup: uploading same image twice reuses storage object
- [ ] Integration tests:
  - [ ] Create codex entries of all types → verify structured fields stored correctly
  - [ ] Link two entries → verify link appears from both directions
  - [ ] Create codex mention in editor → save → reload → verify mention persists and is clickable
  - [ ] Kanban drag-drop reorder → verify binder tree order updates
  - [ ] Move scene between chapters in kanban → verify parent change persists
  - [ ] Image upload → verify dedup works (upload same file twice → one storage object)
  - [ ] Delete codex entry → verify mentions and links cascade

---

## Definition of Done

- [ ] User creates codex entries of all types (character, location, item, lore, custom) with structured fields
- [ ] Codex entries link to each other (e.g., Character A → enemy_of → Character B)
- [ ] User can tag text in editor to link to codex entry; clicking mention navigates to entry
- [ ] Image upload works for codex entries with SHA-256 deduplication
- [ ] Each scene has an editable synopsis field
- [ ] Kanban board shows scenes grouped by chapter, drag-drop reorders and moves between chapters
- [ ] Codex search/filter works by type and text
- [ ] Outlines and beats CRUD works (basic — templates come in Phase 2b)
- [ ] All tests pass, CI green
