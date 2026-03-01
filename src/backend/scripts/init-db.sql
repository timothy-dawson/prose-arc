-- PostgreSQL initialization script
-- Runs automatically on first container startup via the initdb volume mount.

-- Enable ltree extension (required for hierarchical document tree in Phase 1b)
CREATE EXTENSION IF NOT EXISTS ltree;

-- Enable pgcrypto for UUID generation (belt-and-suspenders — SQLAlchemy also handles this)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
