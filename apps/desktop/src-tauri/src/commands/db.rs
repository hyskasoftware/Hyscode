use rusqlite::{params, Connection};
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

// ─── Managed state ──────────────────────────────────────────────────────────

pub struct DbState(pub Mutex<Connection>);

pub fn open_database(app_dir: &std::path::Path) -> Connection {
    std::fs::create_dir_all(app_dir).ok();
    let db_path = app_dir.join("hyscode.db");
    let conn = Connection::open(&db_path).expect("failed to open database");
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
        .expect("failed to set pragmas");
    conn.execute_batch(include_str!("../../migrations/001_initial.sql"))
        .expect("failed to run migration 001");
    conn
}

// ─── Row types ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ConversationRow {
    pub id: String,
    pub title: String,
    pub mode: String,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
    pub message_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct ConversationDetail {
    pub id: String,
    pub title: String,
    pub mode: String,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct MessageRow {
    pub id: String,
    pub role: String,
    pub content: String,
    pub tool_calls: Option<String>,
    pub token_input: i64,
    pub token_output: i64,
    pub created_at: String,
}

// ─── Conversation commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn db_list_conversations(
    state: State<'_, DbState>,
    project_id: String,
) -> Result<Vec<ConversationRow>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.title, c.mode, c.model_id, c.provider_id,
                    COALESCE((SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id), 0),
                    c.created_at, c.updated_at
             FROM conversations c
             WHERE c.project_id = ?1
             ORDER BY c.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(ConversationRow {
                id: row.get(0)?,
                title: row.get(1)?,
                mode: row.get(2)?,
                model_id: row.get(3)?,
                provider_id: row.get(4)?,
                message_count: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn db_get_conversation(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<Option<ConversationDetail>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, mode, model_id, provider_id, created_at, updated_at
             FROM conversations WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let row = stmt
        .query_row(params![conversation_id], |row| {
            Ok(ConversationDetail {
                id: row.get(0)?,
                title: row.get(1)?,
                mode: row.get(2)?,
                model_id: row.get(3)?,
                provider_id: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .ok();
    Ok(row)
}

#[tauri::command]
pub fn db_create_conversation(
    state: State<'_, DbState>,
    id: String,
    project_id: String,
    title: String,
    mode: String,
    model_id: Option<String>,
    provider_id: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO conversations (id, project_id, title, mode, model_id, provider_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, project_id, title, mode, model_id, provider_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_update_conversation(
    state: State<'_, DbState>,
    conversation_id: String,
    title: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(t) = title {
        conn.execute(
            "UPDATE conversations SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![t, conversation_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn db_delete_conversation(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM conversations WHERE id = ?1",
        params![conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Message commands ───────────────────────────────────────────────────────

#[tauri::command]
pub fn db_list_messages(
    state: State<'_, DbState>,
    conversation_id: String,
) -> Result<Vec<MessageRow>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, role, content, tool_calls, token_input, token_output, created_at
             FROM messages
             WHERE conversation_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![conversation_id], |row| {
            Ok(MessageRow {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                tool_calls: row.get(3)?,
                token_input: row.get(4)?,
                token_output: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn db_create_message(
    state: State<'_, DbState>,
    id: String,
    conversation_id: String,
    role: String,
    content: String,
    tool_calls: Option<String>,
    token_input: Option<i64>,
    token_output: Option<i64>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, tool_calls, token_input, token_output)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            conversation_id,
            role,
            content,
            tool_calls,
            token_input.unwrap_or(0),
            token_output.unwrap_or(0)
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?1",
        params![conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
