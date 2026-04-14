-- Migration 003: Remove restrictive mode CHECK constraint from conversations.
-- SQLite does not support ALTER COLUMN, so we recreate the table.
-- This also adds 'debug' and 'plan' as valid modes implicitly (no constraint).

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS conversations_new (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New Conversation',
    mode        TEXT NOT NULL DEFAULT 'chat',
    model_id    TEXT,
    provider_id TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO conversations_new (id, project_id, title, mode, model_id, provider_id, created_at, updated_at)
SELECT id, project_id, title, mode, model_id, provider_id, created_at, updated_at
FROM conversations;

DROP TABLE IF EXISTS conversations;

ALTER TABLE conversations_new RENAME TO conversations;

CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);

PRAGMA foreign_keys = ON;
