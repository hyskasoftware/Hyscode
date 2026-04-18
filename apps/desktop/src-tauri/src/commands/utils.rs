use std::process::Command;

/// Create a `Command` that will **not** open a visible console window on Windows.
///
/// On Windows, processes spawned from a GUI application (`windows_subsystem = "windows"`)
/// can still briefly flash a console window for each child process. Setting the
/// `CREATE_NO_WINDOW` creation flag (0x08000000) suppresses that window.
///
/// On non-Windows platforms this is identical to `Command::new`.
pub fn cmd(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut c = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW — prevents the spawned process from allocating a console.
        c.creation_flags(0x0800_0000);
    }
    c
}
