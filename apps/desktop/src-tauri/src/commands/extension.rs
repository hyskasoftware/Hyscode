use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionMeta {
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub description: String,
    pub publisher: String,
    pub path: String,
    pub enabled: bool,
    pub installed_at: String,
    pub manifest: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub categories: Vec<String>,
    pub activation_events: Vec<String>,
    pub has_main: bool,
}

fn extensions_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".hyscode").join("extensions")
}

fn state_file() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".hyscode").join("extension-state.json")
}

/// Persisted per-extension state (enabled/disabled)
#[derive(Debug, Serialize, Deserialize, Default)]
struct ExtensionStates {
    states: std::collections::HashMap<String, bool>,
}

fn load_states() -> ExtensionStates {
    let path = state_file();
    if !path.exists() {
        return ExtensionStates::default();
    }
    match fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => ExtensionStates::default(),
    }
}

fn save_states(states: &ExtensionStates) -> Result<(), String> {
    let path = state_file();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create state dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(states)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write state file: {}", e))?;
    Ok(())
}

fn parse_manifest(manifest: &serde_json::Value, ext_path: &PathBuf) -> Result<ExtensionMeta, String> {
    let name = manifest
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("extension.json missing 'name' field")?
        .to_string();

    // Validate name (alphanumeric, hyphens, underscores only)
    if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(format!("Invalid extension name '{}': only alphanumeric, hyphens and underscores allowed", name));
    }

    let display_name = manifest
        .get("displayName")
        .and_then(|v| v.as_str())
        .unwrap_or(&name)
        .to_string();

    let version = manifest
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("0.0.0")
        .to_string();

    let description = manifest
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let publisher = manifest
        .get("publisher")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let icon = manifest
        .get("icon")
        .and_then(|v| v.as_str())
        .map(String::from);

    let categories: Vec<String> = manifest
        .get("categories")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let activation_events: Vec<String> = manifest
        .get("activationEvents")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let has_main = manifest.get("main").and_then(|v| v.as_str()).is_some();

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Load enabled state from persisted file
    let states = load_states();
    let enabled = states.states.get(&name).copied().unwrap_or(true);

    Ok(ExtensionMeta {
        name,
        display_name,
        version,
        description,
        publisher,
        path: ext_path.to_string_lossy().to_string(),
        enabled,
        installed_at: now,
        manifest: Some(manifest.clone()),
        icon,
        categories,
        activation_events,
        has_main,
    })
}

/// Install from a folder (existing behavior)
#[tauri::command]
pub async fn extension_install(source_path: String) -> Result<ExtensionMeta, String> {
    let source = PathBuf::from(&source_path);

    let manifest_path = source.join("extension.json");
    if !manifest_path.exists() {
        return Err("No extension.json found in the given folder.".to_string());
    }

    let manifest_str = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read extension.json: {}", e))?;

    let manifest: serde_json::Value = serde_json::from_str(&manifest_str)
        .map_err(|e| format!("Invalid extension.json: {}", e))?;

    let name = manifest
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("extension.json missing 'name' field")?
        .to_string();

    let dest = extensions_dir().join(&name);
    if dest.exists() {
        fs::remove_dir_all(&dest)
            .map_err(|e| format!("Failed to remove existing extension: {}", e))?;
    }

    copy_dir_recursive(&source, &dest)
        .map_err(|e| format!("Failed to copy extension files: {}", e))?;

    let mut meta = parse_manifest(&manifest, &dest)?;
    meta.enabled = true;

    // Persist enabled state
    let mut states = load_states();
    states.states.insert(meta.name.clone(), true);
    save_states(&states)?;

    Ok(meta)
}

/// Install from a .zip file
#[tauri::command]
pub async fn extension_install_zip(zip_path: String) -> Result<ExtensionMeta, String> {
    let zip_file = PathBuf::from(&zip_path);
    if !zip_file.exists() {
        return Err("Zip file not found.".to_string());
    }

    // Create a temp directory to extract into
    let temp_dir = extensions_dir().join("__temp_install__");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to clean temp dir: {}", e))?;
    }
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    // Extract zip
    let file = fs::File::open(&zip_file)
        .map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Invalid zip file: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let entry_path = match entry.enclosed_name() {
            Some(p) => p.to_path_buf(),
            None => continue, // skip entries with invalid paths (path traversal protection)
        };

        let out_path = temp_dir.join(&entry_path);

        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create dir: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }

    // Find extension.json — may be at root or one level deep
    let manifest_path = if temp_dir.join("extension.json").exists() {
        temp_dir.join("extension.json")
    } else {
        // Check one level deep (zip may contain a single root folder)
        let mut found = None;
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() && p.join("extension.json").exists() {
                    found = Some(p.join("extension.json"));
                    break;
                }
            }
        }
        found.ok_or("No extension.json found in zip archive.")?
    };

    let ext_root = manifest_path.parent().unwrap().to_path_buf();

    let manifest_str = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read extension.json: {}", e))?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest_str)
        .map_err(|e| format!("Invalid extension.json: {}", e))?;

    let name = manifest
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("extension.json missing 'name' field")?
        .to_string();

    // Validate name
    if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(format!("Invalid extension name '{}': only alphanumeric, hyphens and underscores allowed", name));
    }

    let dest = extensions_dir().join(&name);
    if dest.exists() {
        fs::remove_dir_all(&dest)
            .map_err(|e| format!("Failed to remove existing extension: {}", e))?;
    }

    // Move extracted extension to final location
    if ext_root == temp_dir {
        fs::rename(&temp_dir, &dest)
            .map_err(|e| format!("Failed to move extension: {}", e))?;
    } else {
        fs::rename(&ext_root, &dest)
            .map_err(|e| format!("Failed to move extension: {}", e))?;
        let _ = fs::remove_dir_all(&temp_dir);
    }

    let mut meta = parse_manifest(&manifest, &dest)?;
    meta.enabled = true;

    let mut states = load_states();
    states.states.insert(meta.name.clone(), true);
    save_states(&states)?;

    Ok(meta)
}

#[tauri::command]
pub async fn extension_uninstall(name: String) -> Result<(), String> {
    // Validate name to prevent path traversal
    if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid extension name.".to_string());
    }

    let dir = extensions_dir().join(&name);
    if dir.exists() {
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("Failed to remove extension: {}", e))?;
    }

    // Remove from state
    let mut states = load_states();
    states.states.remove(&name);
    save_states(&states)?;

    Ok(())
}

/// Toggle extension enabled/disabled, persists to disk
#[tauri::command]
pub async fn extension_toggle(name: String, enabled: bool) -> Result<(), String> {
    let mut states = load_states();
    states.states.insert(name, enabled);
    save_states(&states)?;
    Ok(())
}

#[tauri::command]
pub async fn extension_list() -> Result<Vec<ExtensionMeta>, String> {
    let dir = extensions_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create extensions dir: {}", e))?;
        return Ok(vec![]);
    }

    let states = load_states();
    let mut extensions = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to list extensions dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        // Skip temp install dir
        if path.file_name().map(|n| n == "__temp_install__").unwrap_or(false) {
            continue;
        }

        let manifest_path = path.join("extension.json");
        if !manifest_path.exists() {
            continue;
        }

        let manifest_str = match fs::read_to_string(&manifest_path) {
            Ok(s) => s,
            Err(_) => continue,
        };

        let manifest: serde_json::Value = match serde_json::from_str(&manifest_str) {
            Ok(v) => v,
            Err(_) => continue,
        };

        match parse_manifest(&manifest, &path) {
            Ok(mut meta) => {
                // Override enabled from persisted state
                if let Some(&enabled) = states.states.get(&meta.name) {
                    meta.enabled = enabled;
                }
                extensions.push(meta);
            }
            Err(_) => continue,
        }
    }

    // Sort by display name
    extensions.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));

    Ok(extensions)
}

#[tauri::command]
pub async fn extension_read_asset(name: String, asset_path: String) -> Result<String, String> {
    // Validate name
    if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid extension name.".to_string());
    }

    let full_path = extensions_dir().join(&name).join(&asset_path);

    // Ensure asset_path doesn't escape the extension dir
    let canonical_ext_dir = extensions_dir()
        .join(&name)
        .canonicalize()
        .map_err(|e| format!("Extension not found: {}", e))?;

    let canonical_asset = full_path
        .canonicalize()
        .map_err(|e| format!("Asset not found: {}", e))?;

    if !canonical_asset.starts_with(&canonical_ext_dir) {
        return Err("Access denied: path traversal detected.".to_string());
    }

    fs::read_to_string(&canonical_asset)
        .map_err(|e| format!("Failed to read asset: {}", e))
}

/// Get the extension directory path for the frontend to know where extensions live
#[tauri::command]
pub async fn extension_get_dir() -> Result<String, String> {
    let dir = extensions_dir();
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create extensions dir: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), std::io::Error> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}
