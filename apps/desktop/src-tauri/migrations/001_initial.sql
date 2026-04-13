-- HysCode Database Schema v1
-- SQLite with WAL mode

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -20000;

-- ─── Projects ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Conversations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New Conversation',
    mode        TEXT NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat', 'build', 'review')),
    model_id    TEXT,
    provider_id TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_conversations_project ON conversations(project_id);

-- ─── Messages ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content         TEXT NOT NULL,
    tool_calls      TEXT, -- JSON array of tool calls
    token_input     INTEGER DEFAULT 0,
    token_output    INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- ─── Context Files ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS context_files (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    content_hash    TEXT,
    token_count     INTEGER DEFAULT 0,
    added_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_context_files_conversation ON context_files(conversation_id);

-- ─── Settings ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Skills ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    scope       TEXT NOT NULL CHECK (scope IN ('builtin', 'global', 'workspace')),
    path        TEXT NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 0,
    metadata    TEXT, -- JSON frontmatter
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── MCP Servers ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcp_servers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    transport   TEXT NOT NULL CHECK (transport IN ('stdio', 'sse', 'websocket')),
    config      TEXT NOT NULL, -- JSON config (command, args, url, etc.)
    is_enabled  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── SDD Sessions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sdd_sessions (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    spec            TEXT,
    plan            TEXT, -- JSON task list
    phase           TEXT NOT NULL DEFAULT 'describe' CHECK (phase IN ('describe', 'spec', 'plan', 'execute', 'review')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── SDD Tasks ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sdd_tasks (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sdd_sessions(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'skipped', 'failed')),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    files       TEXT, -- JSON array of affected files
    output      TEXT, -- agent output for this task
    started_at  TEXT,
    completed_at TEXT
);

CREATE INDEX idx_sdd_tasks_session ON sdd_tasks(session_id);

-- ─── Telemetry (local only) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS telemetry (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event       TEXT NOT NULL,
    provider_id TEXT,
    model_id    TEXT,
    tokens_in   INTEGER DEFAULT 0,
    tokens_out  INTEGER DEFAULT 0,
    cost        REAL DEFAULT 0.0,
    duration_ms INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_telemetry_event ON telemetry(event);
CREATE INDEX idx_telemetry_created ON telemetry(created_at);
