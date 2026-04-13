use serde::{Deserialize, Serialize};
use tauri::{Emitter, State, Window};

use super::keychain::KeychainState;

#[derive(Debug, Deserialize)]
pub struct AiStreamRequest {
    /// Unique request ID for correlating events
    pub request_id: String,
    /// Provider ID: "anthropic", "openai", "gemini", "ollama", "openrouter"
    pub provider: String,
    /// Full URL to POST to
    pub url: String,
    /// HTTP headers (without auth — auth is injected from keychain)
    pub headers: std::collections::HashMap<String, String>,
    /// JSON request body as string
    pub body: String,
    /// Timeout in milliseconds (default 120000)
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiStreamChunk {
    pub request_id: String,
    pub data: String,
    pub done: bool,
    pub error: Option<String>,
    pub status_code: Option<u16>,
}

/// Get the keychain key name for a provider's API key
fn provider_key_name(provider: &str) -> String {
    format!("hyscode:{}_api_key", provider)
}

/// Get the auth header for a provider
fn get_auth_header(provider: &str, api_key: &str) -> (String, String) {
    match provider {
        "anthropic" => ("x-api-key".to_string(), api_key.to_string()),
        "gemini" => {
            // Gemini uses query parameter, not header. Return empty header.
            ("x-goog-api-key".to_string(), api_key.to_string())
        }
        // OpenAI, OpenRouter, and others use Bearer token
        _ => ("Authorization".to_string(), format!("Bearer {}", api_key)),
    }
}

#[tauri::command]
pub async fn ai_stream_request(
    window: Window,
    keychain: State<'_, KeychainState>,
    request: AiStreamRequest,
) -> Result<(), String> {
    let request_id = request.request_id.clone();

    // Get API key from keychain (ollama doesn't need one)
    let api_key = if request.provider == "ollama" {
        None
    } else {
        let key_name = provider_key_name(&request.provider);
        let store = keychain.0.lock().map_err(|e| e.to_string())?;
        let key = store.get(&key_name).cloned();
        if key.is_none() {
            let _ = window.emit(
                "ai:chunk",
                AiStreamChunk {
                    request_id: request_id.clone(),
                    data: String::new(),
                    done: true,
                    error: Some(format!(
                        "No API key configured for provider '{}'",
                        request.provider
                    )),
                    status_code: None,
                },
            );
            return Ok(());
        }
        key
    };

    // Spawn async task to handle streaming
    let window_clone = window.clone();
    let req_id = request_id.clone();

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let timeout = std::time::Duration::from_millis(request.timeout_ms.unwrap_or(120_000));

        let mut req_builder = client
            .post(&request.url)
            .timeout(timeout);

        // Add user-provided headers
        for (key, value) in &request.headers {
            req_builder = req_builder.header(key.as_str(), value.as_str());
        }

        // Inject auth header from keychain
        if let Some(ref key) = api_key {
            let (header_name, header_value) = get_auth_header(&request.provider, key);
            req_builder = req_builder.header(header_name.as_str(), header_value.as_str());
        }

        req_builder = req_builder.body(request.body);

        // Make the request
        let response = match req_builder.send().await {
            Ok(resp) => resp,
            Err(e) => {
                let _ = window_clone.emit(
                    "ai:chunk",
                    AiStreamChunk {
                        request_id: req_id,
                        data: String::new(),
                        done: true,
                        error: Some(format!("HTTP request failed: {}", e)),
                        status_code: None,
                    },
                );
                return;
            }
        };

        let status = response.status().as_u16();

        if status >= 400 {
            let error_body = response.text().await.unwrap_or_default();
            let _ = window_clone.emit(
                "ai:chunk",
                AiStreamChunk {
                    request_id: req_id,
                    data: error_body,
                    done: true,
                    error: Some(format!("HTTP {}", status)),
                    status_code: Some(status),
                },
            );
            return;
        }

        // Stream the response body in chunks
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes).to_string();
                    let _ = window_clone.emit(
                        "ai:chunk",
                        AiStreamChunk {
                            request_id: req_id.clone(),
                            data: text,
                            done: false,
                            error: None,
                            status_code: Some(status),
                        },
                    );
                }
                Err(e) => {
                    let _ = window_clone.emit(
                        "ai:chunk",
                        AiStreamChunk {
                            request_id: req_id.clone(),
                            data: String::new(),
                            done: true,
                            error: Some(format!("Stream read error: {}", e)),
                            status_code: Some(status),
                        },
                    );
                    return;
                }
            }
        }

        // Stream completed
        let _ = window_clone.emit(
            "ai:chunk",
            AiStreamChunk {
                request_id: req_id,
                data: String::new(),
                done: true,
                error: None,
                status_code: Some(status),
            },
        );
    });

    Ok(())
}

/// Cancel an in-progress streaming request.
/// Currently this just signals — actual cancellation depends on the reqwest client.
#[tauri::command]
pub async fn ai_stream_cancel(
    window: Window,
    request_id: String,
) -> Result<(), String> {
    // Emit a cancel event that the frontend can use to stop processing chunks
    let _ = window.emit(
        "ai:chunk",
        AiStreamChunk {
            request_id,
            data: String::new(),
            done: true,
            error: Some("Cancelled by user".to_string()),
            status_code: None,
        },
    );
    Ok(())
}
