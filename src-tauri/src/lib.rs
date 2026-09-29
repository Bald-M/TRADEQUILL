mod storage;

use tauri::Manager;

fn app_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

#[tauri::command]
async fn workspace_status(app: tauri::AppHandle) -> Result<storage::WorkspaceStatus, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::initialize(data_dir))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn business_snapshot(app: tauri::AppHandle) -> Result<storage::BusinessSnapshot, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::business_snapshot(data_dir))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn save_customer(app: tauri::AppHandle, input: storage::CustomerInput) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::save_customer(data_dir, input))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn save_inquiry(app: tauri::AppHandle, input: storage::InquiryInput) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::save_inquiry(data_dir, input))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn save_quote(app: tauri::AppHandle, input: storage::QuoteInput) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::save_quote(data_dir, input))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn save_sample(app: tauri::AppHandle, input: storage::SampleInput) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::save_sample(data_dir, input))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn append_sample_progress(
    app: tauri::AppHandle,
    input: storage::SampleProgressInput,
) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::append_sample_progress(data_dir, input))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn update_sample_shipment(
    app: tauri::AppHandle,
    input: storage::SampleShipmentInput,
) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::update_sample_shipment(data_dir, input))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn save_follow_up_task(
    app: tauri::AppHandle,
    input: storage::FollowUpTaskInput,
) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::save_follow_up_task(data_dir, input))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn set_follow_up_task_completed(
    app: tauri::AppHandle,
    task_id: i64,
    completed: bool,
) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        storage::set_follow_up_task_completed(data_dir, task_id, completed)
    })
    .await
    .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn due_reminder(
    app: tauri::AppHandle,
    local_date: String,
    local_date_time: String,
) -> Result<Option<storage::ReminderSummary>, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        storage::due_reminder(data_dir, local_date, local_date_time)
    })
    .await
    .map_err(|error| format!("本地存储任务失败：{error}"))?
}

#[tauri::command]
async fn mark_reminder_sent(app: tauri::AppHandle, local_date: String) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || storage::mark_reminder_sent(data_dir, local_date))
        .await
        .map_err(|error| format!("本地存储任务失败：{error}"))?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            workspace_status,
            business_snapshot,
            save_customer,
            save_inquiry,
            save_quote,
            save_sample,
            append_sample_progress,
            update_sample_shipment,
            save_follow_up_task,
            set_follow_up_task_completed,
            due_reminder,
            mark_reminder_sent
        ])
        .run(tauri::generate_context!())
        .expect("error while running TradeQuill");
}
