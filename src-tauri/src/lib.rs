use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, State};

/// Minimum time the splash window stays visible before the main window is
/// revealed — mirrors `SPLASH_MIN_VISIBLE_MS` from the old Electron main.
const SPLASH_MIN_VISIBLE_MS: u64 = 2000;

/// Tracks when the splash became visible so `notify_main_ready` can enforce the
/// minimum on-screen time regardless of how fast the renderer mounts.
struct SplashState {
    shown_at: Mutex<Option<Instant>>,
}

/// Replacement for the old `cwd:get` IPC handler.
#[tauri::command]
fn get_cwd() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/// Called by the renderer once the main UI has mounted. Holds the splash for
/// the remaining minimum-visible window, then shows main and closes splash.
#[tauri::command]
async fn notify_main_ready(
    app: tauri::AppHandle,
    state: State<'_, SplashState>,
) -> Result<(), String> {
    let elapsed = {
        let guard = state.shown_at.lock().map_err(|e| e.to_string())?;
        guard.map(|t| t.elapsed()).unwrap_or_default()
    };
    let remaining = Duration::from_millis(SPLASH_MIN_VISIBLE_MS).saturating_sub(elapsed);
    if !remaining.is_zero() {
        tokio::time::sleep(remaining).await;
    }

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    Ok(())
}

pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .manage(SplashState {
            shown_at: Mutex::new(Some(Instant::now())),
        })
        .invoke_handler(tauri::generate_handler![get_cwd, notify_main_ready])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
