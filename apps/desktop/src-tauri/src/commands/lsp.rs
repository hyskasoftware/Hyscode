use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub struct LspProcess {
    pub child: Child,
    pub stdin: Option<std::process::ChildStdin>,
}

pub struct LspState(pub Mutex<HashMap<String, LspProcess>>);

#[tauri::command]
pub async fn lsp_start(
    id: String,
    command: String,
    args: Vec<String>,
    root_path: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Resolve the full path to the command if it's not directly on PATH.
    let resolved = resolve_lsp_command(&command);
    let mut child = Command::new(&resolved)
        .args(&args)
        .current_dir(&root_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn LSP process '{}': {}", command, e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture stdout from LSP process")?;

    let stdin = child.stdin.take();

    let server_id = id.clone();

    // Spawn a thread to read LSP stdout and emit events
    let app_handle = app.clone();
    let reader_id = id.clone();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut headers = String::new();

        loop {
            headers.clear();

            // Read headers until empty line
            let mut content_length: usize = 0;
            loop {
                let mut line = String::new();
                match reader.read_line(&mut line) {
                    Ok(0) => return, // EOF
                    Err(_) => return,
                    Ok(_) => {}
                }

                let trimmed = line.trim();
                if trimmed.is_empty() {
                    break;
                }

                if let Some(len_str) = trimmed.strip_prefix("Content-Length: ") {
                    if let Ok(len) = len_str.parse::<usize>() {
                        content_length = len;
                    }
                }
            }

            if content_length == 0 {
                continue;
            }

            // Read body
            let mut body = vec![0u8; content_length];
            match std::io::Read::read_exact(&mut reader, &mut body) {
                Ok(_) => {}
                Err(_) => return,
            }

            let body_str = match String::from_utf8(body) {
                Ok(s) => s,
                Err(_) => continue,
            };

            let event_name = format!("lsp:message:{}", reader_id);
            let _ = app_handle.emit(&event_name, body_str);
        }
    });

    // Store the process
    let state = app.state::<LspState>();
    let mut processes = state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    processes.insert(
        server_id.clone(),
        LspProcess {
            child,
            stdin,
        },
    );

    Ok(server_id)
}

#[tauri::command]
pub async fn lsp_send(id: String, content: String, app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<LspState>();
    let mut processes = state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let process = processes
        .get_mut(&id)
        .ok_or(format!("LSP process '{}' not found", id))?;

    let stdin = process
        .stdin
        .as_mut()
        .ok_or("LSP stdin not available")?;

    let header = format!("Content-Length: {}\r\n\r\n", content.len());
    stdin
        .write_all(header.as_bytes())
        .map_err(|e| format!("Failed to write header: {}", e))?;
    stdin
        .write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write content: {}", e))?;
    stdin
        .flush()
        .map_err(|e| format!("Failed to flush: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn lsp_stop(id: String, app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<LspState>();
    let mut processes = state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if let Some(mut process) = processes.remove(&id) {
        let _ = process.child.kill();
        let _ = process.child.wait();
    }

    Ok(())
}

#[tauri::command]
pub async fn lsp_list_active(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let state = app.state::<LspState>();
    let processes = state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    Ok(processes.keys().cloned().collect())
}

/// Check if a command exists on the system PATH or in common package manager global bin directories.
/// Returns true if the command is found, false otherwise.
#[tauri::command]
pub async fn lsp_probe_server(command: String) -> Result<bool, String> {
    // 1. Try `where` / `which` against the current PATH
    #[cfg(target_os = "windows")]
    let path_found = std::process::Command::new("where")
        .arg(&command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    #[cfg(not(target_os = "windows"))]
    let path_found = std::process::Command::new("which")
        .arg(&command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if path_found {
        return Ok(true);
    }

    // 2. Fallback: check common package-manager global bin directories directly.
    //    On Windows, npm installs `.cmd` wrappers; on Unix plain executables.
    #[cfg(target_os = "windows")]
    {
        let candidates: Vec<std::path::PathBuf> = {
            let mut v = vec![];
            // %APPDATA%\npm  (npm / pnpm global on Windows)
            if let Ok(appdata) = std::env::var("APPDATA") {
                let base = std::path::PathBuf::from(&appdata).join("npm");
                v.push(base.join(format!("{}.cmd", command)));
                v.push(base.join(&command));
            }
            // %LOCALAPPDATA%\pnpm
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                let base = std::path::PathBuf::from(&local).join("pnpm");
                v.push(base.join(format!("{}.cmd", command)));
                v.push(base.join(&command));
            }
            v
        };
        for p in &candidates {
            if p.exists() {
                return Ok(true);
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let candidates: Vec<std::path::PathBuf> = vec![
            // npm global (default prefix)
            std::path::PathBuf::from(&home).join(".npm-global/bin").join(&command),
            // pnpm global
            std::path::PathBuf::from(&home).join(".local/share/pnpm").join(&command),
            // yarn global
            std::path::PathBuf::from(&home).join(".yarn/bin").join(&command),
            // system npm via /usr/local/bin
            std::path::PathBuf::from("/usr/local/bin").join(&command),
            std::path::PathBuf::from("/usr/bin").join(&command),
        ];
        for p in &candidates {
            if p.exists() {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

/// Resolve an LSP command to its full path, checking common global bin directories
/// if the command isn't found directly on PATH.
fn resolve_lsp_command(command: &str) -> String {
    // First check if the command is directly available
    #[cfg(target_os = "windows")]
    let on_path = std::process::Command::new("where")
        .arg(command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    #[cfg(not(target_os = "windows"))]
    let on_path = std::process::Command::new("which")
        .arg(command)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if on_path {
        return command.to_string();
    }

    // Fallback: check common package-manager global bin directories
    #[cfg(target_os = "windows")]
    {
        let mut candidates: Vec<std::path::PathBuf> = vec![];
        if let Ok(appdata) = std::env::var("APPDATA") {
            let base = std::path::PathBuf::from(&appdata).join("npm");
            candidates.push(base.join(format!("{}.cmd", command)));
            candidates.push(base.join(command));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let base = std::path::PathBuf::from(&local).join("pnpm");
            candidates.push(base.join(format!("{}.cmd", command)));
            candidates.push(base.join(command));
        }
        for p in &candidates {
            if p.exists() {
                return p.to_string_lossy().to_string();
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let candidates: Vec<std::path::PathBuf> = vec![
            std::path::PathBuf::from(&home).join(".npm-global/bin").join(command),
            std::path::PathBuf::from(&home).join(".local/share/pnpm").join(command),
            std::path::PathBuf::from(&home).join(".yarn/bin").join(command),
            std::path::PathBuf::from("/usr/local/bin").join(command),
            std::path::PathBuf::from("/usr/bin").join(command),
        ];
        for p in &candidates {
            if p.exists() {
                return p.to_string_lossy().to_string();
            }
        }
    }

    // Return original command as-is if no resolution found
    command.to_string()
}
