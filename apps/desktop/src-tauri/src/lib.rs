use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;

mod commands;

use commands::keychain::KeychainState;
use commands::lsp::LspState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(commands::pty::PtyState(Mutex::new(HashMap::new())))
        .manage(LspState(Mutex::new(HashMap::new())))
        .manage(KeychainState(Mutex::new(commands::keychain::load_keychain())))
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::list_dir,
            commands::fs::create_file,
            commands::fs::delete_path,
            commands::fs::stat_path,
            commands::fs::search_files,
            commands::fs::rename_path,
            commands::fs::create_directory,
            // Git commands
            commands::git::git_is_repo,
            commands::git::git_init,
            commands::git::git_status,
            commands::git::git_diff_file,
            commands::git::git_diff_hunks,
            commands::git::git_file_content,
            commands::git::git_add,
            commands::git::git_add_all,
            commands::git::git_unstage,
            commands::git::git_discard,
            commands::git::git_commit,
            commands::git::git_log,
            commands::git::git_log_file,
            commands::git::git_branch_current,
            commands::git::git_branch_list,
            commands::git::git_branch_create,
            commands::git::git_branch_delete,
            commands::git::git_checkout,
            commands::git::git_remote_list,
            commands::git::git_ahead_behind,
            commands::git::git_stash,
            commands::git::git_stash_list,
            commands::git::git_stash_pop,
            // PTY commands
            commands::pty::pty_spawn,
            commands::pty::pty_write,
            commands::pty::pty_resize,
            commands::pty::pty_kill,
            // Extension commands
            commands::extension::extension_install,
            commands::extension::extension_uninstall,
            commands::extension::extension_list,
            commands::extension::extension_read_asset,
            // LSP commands
            commands::lsp::lsp_start,
            commands::lsp::lsp_send,
            commands::lsp::lsp_stop,
            commands::lsp::lsp_list_active,
            // Keychain commands
            commands::keychain::keychain_set,
            commands::keychain::keychain_get,
            commands::keychain::keychain_delete,
            commands::keychain::keychain_has,
            // AI streaming commands
            commands::ai::ai_stream_request,
            commands::ai::ai_stream_cancel,
        ])
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running HysCode");
}
