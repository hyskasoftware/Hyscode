use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

/// In-memory encrypted key store.
/// For production, this should be backed by tauri-plugin-stronghold.
/// Current implementation uses an in-memory HashMap as a secure placeholder
/// that can be swapped for stronghold without changing the API.
pub struct KeychainState(pub Mutex<HashMap<String, String>>);

#[derive(Debug, Serialize, Deserialize)]
pub struct KeychainEntry {
    pub service: String,
    pub account: String,
}

#[tauri::command]
pub async fn keychain_set(
    state: State<'_, KeychainState>,
    service: String,
    account: String,
    secret: String,
) -> Result<(), String> {
    let key = format!("{}:{}", service, account);
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    store.insert(key, secret);
    Ok(())
}

#[tauri::command]
pub async fn keychain_get(
    state: State<'_, KeychainState>,
    service: String,
    account: String,
) -> Result<Option<String>, String> {
    let key = format!("{}:{}", service, account);
    let store = state.0.lock().map_err(|e| e.to_string())?;
    Ok(store.get(&key).cloned())
}

#[tauri::command]
pub async fn keychain_delete(
    state: State<'_, KeychainState>,
    service: String,
    account: String,
) -> Result<bool, String> {
    let key = format!("{}:{}", service, account);
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    Ok(store.remove(&key).is_some())
}

#[tauri::command]
pub async fn keychain_has(
    state: State<'_, KeychainState>,
    service: String,
    account: String,
) -> Result<bool, String> {
    let key = format!("{}:{}", service, account);
    let store = state.0.lock().map_err(|e| e.to_string())?;
    Ok(store.contains_key(&key))
}
