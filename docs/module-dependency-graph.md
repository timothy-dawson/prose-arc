# Module Dependency Graph

Quick reference for which modules depend on which. Dependencies flow downward — no cycles allowed.

## Dependency Direction

```
identity (foundation — no deps)
  ↑
manuscript (depends on: identity)
  ↑
codex (depends on: identity, manuscript)
  ↑
plotting (depends on: identity, manuscript, codex)

versioning (depends on: identity, manuscript)
goals (depends on: identity, manuscript)
notifications (depends on: identity)

ai (depends on: identity, manuscript, codex, plotting)
collab (depends on: identity, manuscript)
export (depends on: identity, manuscript, codex)
publishing (depends on: identity, manuscript, export)
```

## Build Order (phases)

| Phase | Modules Built | Depends On |
|-------|--------------|------------|
| 1a | `identity` (+ core/) | — |
| 1b | `manuscript` | identity |
| 1c | `codex`, `plotting` (foundation) | identity, manuscript |
| 1d | `versioning`, `goals` | identity, manuscript |
| 1e | `export`, `notifications` | identity, manuscript, codex |
| 2a | `ai` | identity, manuscript, codex, plotting |
| 2c | `collab` (track changes only) | identity, manuscript |
| 3a | `collab` (real-time CRDT) | identity, manuscript |
| 3b | `publishing` | identity, manuscript, export |

## Inter-Module Communication Rules

1. **Call module services, not tables.** `export` calls `manuscript.service.get_ordered_content()`, never queries `document_content` directly.
2. **Event bus for side effects.** `manuscript` publishes `document.saved` → `versioning` subscribes to create auto-snapshot, `goals` subscribes to update word count.
3. **Keep event handlers fast.** If the handler needs heavy work, enqueue a Celery task instead of doing it inline.
