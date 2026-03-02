# Phase 1b: Core Editor & Manuscript Management — Task Checklist

**Duration:** Weeks 4–7  
**Goal:** ProseMirror editor with binder tree. Authors can create projects, organize chapters/scenes, and write.  
**Depends on:** Phase 1a (auth, DB, project structure, Docker)

---

## Backend Tasks

- [ ] Create migration: `projects`, `binder_nodes` (with ltree extension), `document_content` tables
  - See `docs/writing-app-architecture.md` §3.2 for exact schema
  - `binder_nodes` uses ltree for materialized path + adjacency list
  - `document_content` has both `content_prosemirror` (JSONB) and `content_compressed` (BYTEA) columns
- [ ] Manuscript module service layer (`app/modules/manuscript/service.py`):
  - [ ] Project CRUD (create, list, get, update, delete)
  - [ ] Binder node CRUD (create, get, update, delete)
  - [ ] Binder tree fetch (full tree for a project, ordered)
  - [ ] Binder bulk reorder (accept new sort_order + parent changes for multiple nodes)
  - [ ] Document content save — accept ProseMirror JSON, extract plain text, compute word count
  - [ ] Document content load — decompress if needed, return ProseMirror JSON
  - [ ] Conditional compression: < 64KB → store in `content_prosemirror` (JSONB), ≥ 64KB → zstd-compress into `content_compressed` (BYTEA)
  - [ ] Full-text search across all documents in a project (Postgres tsvector + GIN index)
- [ ] API routes (`app/api/v1/manuscripts.py`):
  - [ ] `GET /projects` — list user's projects
  - [ ] `POST /projects` — create project
  - [ ] `GET /projects/{project_id}` — get project details
  - [ ] `PATCH /projects/{project_id}` — update project
  - [ ] `DELETE /projects/{project_id}` — delete project
  - [ ] `GET /projects/{project_id}/binder` — get full binder tree
  - [ ] `POST /projects/{project_id}/binder` — create binder node
  - [ ] `PATCH /projects/{project_id}/binder/{node_id}` — update node (rename, move, change parent)
  - [ ] `DELETE /projects/{project_id}/binder/{node_id}` — delete node (cascade children)
  - [ ] `POST /projects/{project_id}/binder/reorder` — bulk reorder
  - [ ] `GET /projects/{project_id}/documents/{node_id}` — get document content
  - [ ] `PUT /projects/{project_id}/documents/{node_id}` — save document content
  - [ ] `GET /projects/{project_id}/search?q=...` — full-text search
- [ ] Pydantic schemas for all request/response models (`app/modules/manuscript/schemas.py`)
- [ ] Event publishing: `document.saved` event (payload: project_id, node_id, word_count_delta)
- [ ] Celery tasks:
  - [ ] `update_word_counts` — update `binder_nodes.word_count` and `projects.word_count` aggregate
  - [ ] `reindex_search` — update `document_content.content_text` and tsvector index
- [ ] Authorization: ensure users can only access their own projects (or team projects)
- [ ] Tests: unit tests for service layer, integration tests for API endpoints

## Frontend Tasks

- [ ] **ProseMirror editor integration:**
  - [ ] Set up ProseMirror with custom document schema:
    - Block nodes: paragraph, heading (1-3), blockquote, bullet_list, ordered_list, list_item, horizontal_rule, code_block
    - Inline marks: bold, italic, underline, strikethrough, code
  - [ ] Input rules for markdown shortcuts:
    - `**text**` → bold, `*text*` → italic, `~~text~~` → strikethrough
    - `# ` → heading 1, `## ` → heading 2, `### ` → heading 3
    - `> ` → blockquote, `- ` or `* ` → bullet list, `1. ` → ordered list
    - `` ``` `` → code block, `---` → horizontal rule
  - [ ] Key bindings: Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline), Ctrl+Z (undo), Ctrl+Shift+Z (redo)
  - [ ] Editor toolbar: formatting buttons, heading selector dropdown, list buttons, blockquote, undo/redo
  - [ ] Placeholder text when document is empty ("Start writing...")
- [ ] **Binder tree component:**
  - [ ] Recursive tree view in sidebar showing project hierarchy
  - [ ] Node types with icons: folder 📁, chapter 📄, scene 📝
  - [ ] Drag-and-drop reorder (dnd-kit or similar): reorder within same level, move between parents
  - [ ] Right-click context menu: rename, delete, add child (chapter/scene/folder), duplicate
  - [ ] Inline rename (double-click or F2)
  - [ ] Create new node buttons (+ folder, + chapter, + scene)
  - [ ] Visual indication of currently selected/open node
  - [ ] Expand/collapse folders
- [ ] **Project dashboard:**
  - [ ] List all user's projects as cards (title, word count, last modified)
  - [ ] Create new project button → name input → creates project + opens it
  - [ ] Delete project (with confirmation dialog)
  - [ ] Project settings (title, description) — basic for now
- [ ] **Document view:**
  - [ ] Click binder node → load document content into ProseMirror editor
  - [ ] Auto-save: debounced save after 3 seconds of idle (no typing)
  - [ ] Save indicator in status bar: "Saved" / "Saving..." / "Unsaved changes"
  - [ ] Handle empty documents (new scenes with no content yet)
- [ ] **Search panel:**
  - [ ] Search input in sidebar or via Ctrl+Shift+F
  - [ ] Results list: snippet with highlighted match, document title, chapter name
  - [ ] Click result → navigate to that document
- [ ] **Status bar** (bottom of editor):
  - [ ] Word count (current document)
  - [ ] Project total word count
  - [ ] Save status indicator
  - [ ] Current chapter/scene breadcrumb
- [ ] **Zustand/React Query integration:**
  - [ ] React Query hooks for all API calls (useProjects, useProject, useBinder, useDocument, etc.)
  - [ ] Optimistic updates for binder reorder (instant UI, reconcile with server response)
  - [ ] Zustand store for editor state (current project, current node, dirty tracking)

## Fullstack / Integration Tasks

- [ ] ProseMirror ↔ API save/load cycle:
  - [ ] Editor outputs ProseMirror JSON → PUT to API → stored in Postgres
  - [ ] Load: GET from API → ProseMirror JSON → initialize editor state
  - [ ] Handle content_prosemirror vs content_compressed transparently
- [ ] Auto-save implementation:
  - [ ] Frontend: 3-second debounce after last keystroke
  - [ ] Backend: save endpoint is idempotent (PUT semantics)
  - [ ] Conflict handling: if server has newer version, prompt user (for now, last-write-wins is acceptable)
- [ ] Binder tree state sync:
  - [ ] Optimistic reorder on drag-drop → send to server → reconcile
  - [ ] Handle errors: revert UI if server rejects reorder
- [ ] Performance:
  - [ ] Lazy-load document content — don't fetch all doc bodies when loading binder tree
  - [ ] Binder tree fetch should be fast even with 100+ nodes
  - [ ] Target: < 200ms API response for document load
- [ ] Integration tests:
  - [ ] Create project → add folder → add chapters → add scenes → verify tree structure
  - [ ] Open scene → write content → save → reload page → verify content persists
  - [ ] Drag-drop reorder → verify new order persists
  - [ ] Search across documents → verify results
  - [ ] Large document (> 64KB) → verify compression/decompression cycle

## Definition of Done

- [ ] User creates a project and sees it on the dashboard
- [ ] Binder tree shows hierarchical folder/chapter/scene structure
- [ ] Drag-drop reorder works in binder tree, persists to server
- [ ] ProseMirror editor loads, saves, and restores content correctly
- [ ] All markdown shortcuts work (bold, italic, headings, lists, blockquote)
- [ ] Auto-save triggers after 3s idle, visual indicator shows save status
- [ ] Word count updates in real-time in status bar
- [ ] Full-text search returns results across all documents in project
- [ ] Documents > 64KB compress and decompress transparently
- [ ] < 200ms API response time for document load
- [ ] All tests pass, CI green
