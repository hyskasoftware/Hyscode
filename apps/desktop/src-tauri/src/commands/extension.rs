use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
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
}

fn extensions_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".hyscode").join("extensions")
}

#[tauri::command]
pub async fn extension_install(source_path: String) -> Result<ExtensionMeta, String> {
    let source = PathBuf::from(&source_path);

    // Read manifest
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

    // Copy to extensions directory
    let dest = extensions_dir().join(&name);
    if dest.exists() {
        fs::remove_dir_all(&dest)
            .map_err(|e| format!("Failed to remove existing extension: {}", e))?;
    }

    copy_dir_recursive(&source, &dest)
        .map_err(|e| format!("Failed to copy extension files: {}", e))?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    Ok(ExtensionMeta {
        name,
        display_name,
        version,
        description,
        publisher,
        path: dest.to_string_lossy().to_string(),
        enabled: true,
        installed_at: now,
        manifest: Some(manifest),
    })
}

#[tauri::command]
pub async fn extension_uninstall(name: String) -> Result<(), String> {
    let dir = extensions_dir().join(&name);
    if dir.exists() {
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("Failed to remove extension: {}", e))?;
    }
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

    let mut extensions = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to list extensions dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
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

        let name = manifest
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        extensions.push(ExtensionMeta {
            display_name: manifest
                .get("displayName")
                .and_then(|v| v.as_str())
                .unwrap_or(&name)
                .to_string(),
            version: manifest
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("0.0.0")
                .to_string(),
            description: manifest
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            publisher: manifest
                .get("publisher")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            path: path.to_string_lossy().to_string(),
            enabled: true,
            installed_at: String::new(),
            manifest: Some(manifest),
            name,
        });
    }

    Ok(extensions)
}

#[tauri::command]
pub async fn extension_read_asset(name: String, asset_path: String) -> Result<String, String> {
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
