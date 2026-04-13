-- HysCode Extensions Schema v1

-- ─── Extensions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extensions (
    name           TEXT PRIMARY KEY,
    display_name   TEXT NOT NULL,
    version        TEXT NOT NULL,
    description    TEXT DEFAULT '',
    publisher      TEXT NOT NULL,
    path           TEXT NOT NULL,
    enabled        INTEGER NOT NULL DEFAULT 1,
    installed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Extension Settings ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extension_settings (
    extension_name TEXT NOT NULL REFERENCES extensions(name) ON DELETE CASCADE,
    key            TEXT NOT NULL,
    value          TEXT,
    PRIMARY KEY (extension_name, key)
);

CREATE INDEX IF NOT EXISTS idx_extension_settings_ext ON extension_settings(extension_name);
