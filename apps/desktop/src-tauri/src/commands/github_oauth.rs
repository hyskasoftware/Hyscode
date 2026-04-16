use serde::{Deserialize, Serialize};
use tauri::State;

use super::keychain::KeychainState;

// ─── GitHub OAuth Device Flow ─────────────────────────────────────────────────
// Implements the GitHub Device Flow for authenticating with GitHub Copilot.
//
// Flow:
// 1. `github_oauth_start` → POST to GitHub with client_id, get device_code + user_code
// 2. User visits verification_uri and enters user_code
// 3. `github_oauth_poll` → POST to GitHub to check if user authorized, get access_token
// 4. Store access_token in keychain as `hyscode:github_copilot_access_token`
// 5. `github_copilot_ensure_token` → Exchange access_token for short-lived Copilot API token
// 6. Store Copilot token as `hyscode:github_copilot_token` for use by the AI proxy

#[derive(Debug, Serialize)]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: String,
}

#[derive(Debug, Deserialize)]
struct GitHubDeviceResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CopilotTokenResponse {
    token: String,
    expires_at: i64,
}

/// Step 1: Start the GitHub OAuth Device Flow.
/// Returns device_code, user_code, and verification_uri for the user.
#[tauri::command]
pub async fn github_oauth_start(
    client_id: String,
) -> Result<DeviceFlowResponse, String> {
    let client = reqwest::Client::new();

    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("scope", "copilot"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to start device flow: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub device flow error: {}", body));
    }

    let data: GitHubDeviceResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse device flow response: {}", e))?;

    Ok(DeviceFlowResponse {
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        expires_in: data.expires_in,
        interval: data.interval,
    })
}

/// Step 2: Poll GitHub to check if user has authorized the device.
/// Returns the access_token on success, or an error with "authorization_pending" if still waiting.
#[tauri::command]
pub async fn github_oauth_poll(
    keychain: State<'_, KeychainState>,
    client_id: String,
    device_code: String,
) -> Result<OAuthTokenResponse, String> {
    let client = reqwest::Client::new();

    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to poll OAuth: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub OAuth error: {}", body));
    }

    let data: GitHubTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse OAuth response: {}", e))?;

    if let Some(err) = data.error {
        return Err(match err.as_str() {
            "authorization_pending" => "authorization_pending".to_string(),
            "slow_down" => "slow_down".to_string(),
            "expired_token" => "Device code expired. Please restart the auth flow.".to_string(),
            "access_denied" => "User denied access.".to_string(),
            _ => data.error_description.unwrap_or(err),
        });
    }

    let access_token = data
        .access_token
        .ok_or("No access_token in response")?;
    let token_type = data.token_type.unwrap_or_else(|| "bearer".to_string());
    let scope = data.scope.unwrap_or_default();

    // Store the long-lived access token in keychain
    {
        let mut store = keychain.0.lock().map_err(|e| e.to_string())?;
        store.insert(
            "hyscode:github_copilot_access_token".to_string(),
            access_token.clone(),
        );
        super::keychain::persist_keychain_ref(&store);
    }

    Ok(OAuthTokenResponse {
        access_token,
        token_type,
        scope,
    })
}

/// Step 3: Exchange the long-lived GitHub access token for a short-lived Copilot API token.
/// Called before each AI request to ensure the token is fresh.
#[tauri::command]
pub async fn github_copilot_ensure_token(
    keychain: State<'_, KeychainState>,
) -> Result<String, String> {
    // Read the long-lived access token
    let access_token = {
        let store = keychain.0.lock().map_err(|e| e.to_string())?;
        store
            .get("hyscode:github_copilot_access_token")
            .cloned()
            .ok_or_else(|| "No GitHub access token. Please authenticate first.".to_string())?
    };

    let client = reqwest::Client::new();

    let resp = client
        .get("https://api.github.com/copilot_internal/v2/token")
        .header("Authorization", format!("token {}", access_token))
        .header("User-Agent", "HysCode/0.1.0")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to get Copilot token: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        if status == 401 {
            // Access token is invalid/revoked — clear it
            let mut store = keychain.0.lock().map_err(|e| e.to_string())?;
            store.remove("hyscode:github_copilot_access_token");
            store.remove("hyscode:github_copilot_token");
            super::keychain::persist_keychain_ref(&store);
            return Err("GitHub access token is invalid. Please re-authenticate.".to_string());
        }
        return Err(format!("Copilot token exchange failed ({}): {}", status, body));
    }

    let data: CopilotTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Copilot token: {}", e))?;

    // Store the short-lived Copilot API token
    {
        let mut store = keychain.0.lock().map_err(|e| e.to_string())?;
        store.insert(
            "hyscode:github_copilot_token".to_string(),
            data.token.clone(),
        );
        super::keychain::persist_keychain_ref(&store);
    }

    Ok(data.token)
}

/// Disconnect GitHub Copilot — remove all stored tokens.
#[tauri::command]
pub async fn github_copilot_disconnect(
    keychain: State<'_, KeychainState>,
) -> Result<(), String> {
    let mut store = keychain.0.lock().map_err(|e| e.to_string())?;
    store.remove("hyscode:github_copilot_access_token");
    store.remove("hyscode:github_copilot_token");
    super::keychain::persist_keychain_ref(&store);
    Ok(())
}

/// Check if GitHub Copilot is authenticated (has a stored access token).
#[tauri::command]
pub async fn github_copilot_is_authenticated(
    keychain: State<'_, KeychainState>,
) -> Result<bool, String> {
    let store = keychain.0.lock().map_err(|e| e.to_string())?;
    Ok(store.contains_key("hyscode:github_copilot_access_token"))
}
