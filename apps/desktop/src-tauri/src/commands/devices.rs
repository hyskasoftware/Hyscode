use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::Emitter;

/// A connected physical device or running emulator.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    /// "android", "ios", "web", "linux", "macos", "windows"
    pub platform: String,
    pub emulator: bool,
    pub available: bool,
    /// e.g. "mobile", "web", "desktop"
    pub category: String,
}

/// An available emulator that can be launched.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorInfo {
    pub id: String,
    pub name: String,
    pub platform: String,
}

/// Resolve the Flutter binary: use `flutter_sdk_path` if provided, else "flutter" on PATH.
fn flutter_bin(flutter_sdk_path: Option<&str>) -> String {
    if let Some(sdk) = flutter_sdk_path {
        let trimmed = sdk.trim();
        if !trimmed.is_empty() {
            #[cfg(target_os = "windows")]
            {
                return format!("{}\\bin\\flutter.bat", trimmed.trim_end_matches('\\'));
            }
            #[cfg(not(target_os = "windows"))]
            {
                return format!("{}/bin/flutter", trimmed.trim_end_matches('/'));
            }
        }
    }
    "flutter".to_string()
}

/// List connected devices via `flutter devices --machine`.
/// Returns an empty list if Flutter is not installed.
#[tauri::command]
pub async fn list_devices(flutter_sdk_path: Option<String>) -> Result<Vec<DeviceInfo>, String> {
    let bin = flutter_bin(flutter_sdk_path.as_deref());

    let output = Command::new(&bin)
        .args(["devices", "--machine"])
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                return "flutter_not_found".to_string();
            }
            format!("Failed to run flutter devices: {e}")
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("flutter devices failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // `flutter devices --machine` outputs a JSON array
    let raw: Vec<serde_json::Value> = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse flutter devices output: {e}"))?;

    let devices: Vec<DeviceInfo> = raw
        .into_iter()
        .map(|v| {
            let id = v["id"].as_str().unwrap_or("").to_string();
            let name = v["name"].as_str().unwrap_or("Unknown").to_string();
            let platform = v["targetPlatform"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let emulator = v["emulator"].as_bool().unwrap_or(false);
            let available = v["isSupported"].as_bool().unwrap_or(true);
            let category = v["category"]
                .as_str()
                .unwrap_or("mobile")
                .to_string();

            // Normalize platform names
            let platform = if platform.contains("android") {
                "android".to_string()
            } else if platform.contains("ios") {
                "ios".to_string()
            } else if platform.contains("web") || platform.contains("chrome") {
                "web".to_string()
            } else if platform.contains("linux") {
                "linux".to_string()
            } else if platform.contains("darwin") || platform.contains("macos") {
                "macos".to_string()
            } else if platform.contains("windows") {
                "windows".to_string()
            } else {
                platform
            };

            DeviceInfo {
                id,
                name,
                platform,
                emulator,
                available,
                category,
            }
        })
        .collect();

    Ok(devices)
}

/// List available emulators via `flutter emulators --machine`.
#[tauri::command]
pub async fn list_emulators(flutter_sdk_path: Option<String>) -> Result<Vec<EmulatorInfo>, String> {
    let bin = flutter_bin(flutter_sdk_path.as_deref());

    let output = Command::new(&bin)
        .args(["emulators", "--machine"])
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                return "flutter_not_found".to_string();
            }
            format!("Failed to run flutter emulators: {e}")
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("flutter emulators failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let raw: Vec<serde_json::Value> = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse flutter emulators output: {e}"))?;

    let emulators: Vec<EmulatorInfo> = raw
        .into_iter()
        .map(|v| {
            let id = v["id"].as_str().unwrap_or("").to_string();
            let name = v["name"].as_str().unwrap_or("Unknown").to_string();
            let platform = v["platform"].as_str().unwrap_or("android").to_string();
            EmulatorInfo { id, name, platform }
        })
        .collect();

    Ok(emulators)
}

/// Launch an emulator by its ID. Non-blocking — returns immediately.
#[tauri::command]
pub async fn start_emulator(
    emulator_id: String,
    flutter_sdk_path: Option<String>,
) -> Result<(), String> {
    let bin = flutter_bin(flutter_sdk_path.as_deref());

    // Spawn the emulator launch in the background — don't wait for it
    std::thread::spawn(move || {
        let _ = Command::new(&bin)
            .args(["emulators", "--launch", &emulator_id])
            .output();
    });

    Ok(())
}

/// Run a Flutter or React Native app on a specific device using PTY.
/// Returns the PTY ID for the running process.
#[tauri::command]
pub async fn run_on_device(
    device_id: String,
    project_path: String,
    platform: String,
    flutter_sdk_path: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<'_, super::pty::PtyState>,
) -> Result<String, String> {
    use portable_pty::{native_pty_system, CommandBuilder, PtySize};
    use std::io::Read;

    let pty_system = native_pty_system();
    let size = PtySize {
        rows: 24,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    // Build the command based on platform
    let (cmd_path, cmd_args) = if platform == "react-native-android" {
        ("npx".to_string(), vec![
            "react-native".to_string(),
            "run-android".to_string(),
            "--deviceId".to_string(),
            device_id.clone(),
        ])
    } else if platform == "react-native-ios" {
        ("npx".to_string(), vec![
            "react-native".to_string(),
            "run-ios".to_string(),
            "--device".to_string(),
            device_id.clone(),
        ])
    } else {
        // Default: Flutter
        let bin = flutter_bin(flutter_sdk_path.as_deref());
        (bin, vec![
            "run".to_string(),
            "-d".to_string(),
            device_id.clone(),
        ])
    };

    let mut cmd = CommandBuilder::new(&cmd_path);
    for arg in &cmd_args {
        cmd.arg(arg);
    }
    cmd.cwd(&project_path);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn: {e}"))?;

    drop(pair.slave);

    let pty_id = uuid::Uuid::new_v4().to_string();

    // Reader thread: reads PTY output and emits events to the frontend
    let reader_id = pty_id.clone();
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(
                        "pty:data",
                        serde_json::json!({
                            "pty_id": reader_id,
                            "data": text,
                        }),
                    );
                }
                Err(_) => break,
            }
        }
        let _ = app_clone.emit(
            "pty:exit",
            serde_json::json!({
                "pty_id": reader_id,
                "code": null,
            }),
        );
    });

    // Store the session in the PtyState (reuse the same map as terminal PTYs)
    let writer = pair.master.take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;
    {
        let mut sessions = state.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        sessions.insert(pty_id.clone(), super::pty::PtySession {
            writer,
            master: pair.master,
            child,
        });
    }

    Ok(pty_id)
}
