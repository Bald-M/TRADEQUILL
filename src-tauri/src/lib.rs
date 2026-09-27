mod storage;

use tauri::Manager;

#[tauri::command]
async fn workspace_status(app: tauri::AppHandle) -> Result<storage::WorkspaceStatus, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || storage::initialize(data_dir))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![workspace_status])
        .run(tauri::generate_context!())
        .expect("error while running TradeQuill");
}
