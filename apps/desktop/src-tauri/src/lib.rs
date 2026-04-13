use tauri::Manager;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
        ])
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running HysCode");
}
