mod catalog;
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

async fn catalog_task<T: Send + 'static>(
    app: tauri::AppHandle,
    operation: impl FnOnce(std::path::PathBuf) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || operation(data_dir))
        .await
        .map_err(|_| "本地资料任务未完成，请重试。".to_string())?
}

#[tauri::command]
async fn list_catalog(app: tauri::AppHandle) -> Result<catalog::CatalogSnapshot, String> {
    catalog_task(app, catalog::list_catalog).await
}

#[tauri::command]
async fn save_product(
    app: tauri::AppHandle,
    input: catalog::ProductInput,
) -> Result<catalog::ProductRecord, String> {
    catalog_task(app, move |path| catalog::save_product(path, input)).await
}

#[tauri::command]
async fn set_product_archived(
    app: tauri::AppHandle,
    product_id: i64,
    archived: bool,
) -> Result<(), String> {
    catalog_task(app, move |path| {
        catalog::set_product_archived(path, product_id, archived)
    })
    .await
}

#[tauri::command]
async fn preview_knowledge_import(
    app: tauri::AppHandle,
    input: catalog::FileImportInput,
) -> Result<catalog::ImportPreview, String> {
    catalog_task(app, move |path| {
        catalog::preview_knowledge_import(path, input)
    })
    .await
}

#[tauri::command]
async fn save_knowledge(
    app: tauri::AppHandle,
    input: catalog::KnowledgeInput,
) -> Result<catalog::KnowledgeSummary, String> {
    catalog_task(app, move |path| catalog::save_knowledge(path, input)).await
}

#[tauri::command]
async fn get_knowledge_document(
    app: tauri::AppHandle,
    document_id: i64,
) -> Result<catalog::KnowledgeDetail, String> {
    catalog_task(app, move |path| {
        catalog::get_knowledge_document(path, document_id)
    })
    .await
}

#[tauri::command]
async fn set_knowledge_archived(
    app: tauri::AppHandle,
    document_id: i64,
    archived: bool,
) -> Result<(), String> {
    catalog_task(app, move |path| {
        catalog::set_knowledge_archived(path, document_id, archived)
    })
    .await
}

#[tauri::command]
async fn delete_knowledge(app: tauri::AppHandle, document_id: i64) -> Result<(), String> {
    catalog_task(app, move |path| {
        catalog::delete_knowledge(path, document_id)
    })
    .await
}

#[tauri::command]
async fn search_knowledge(
    app: tauri::AppHandle,
    input: catalog::KnowledgeSearchInput,
) -> Result<Vec<catalog::KnowledgeSnippet>, String> {
    catalog_task(app, move |path| catalog::search_knowledge(path, input)).await
}

#[tauri::command]
async fn check_knowledge_reference(
    app: tauri::AppHandle,
    document_id: i64,
    version: i64,
) -> Result<String, String> {
    catalog_task(app, move |path| {
        catalog::check_knowledge_reference(path, document_id, version)
    })
    .await
}

pub fn run() {
    if catalog::maybe_run_pdf_worker() {
        return;
    }
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
            mark_reminder_sent,
            list_catalog,
            save_product,
            set_product_archived,
            preview_knowledge_import,
            save_knowledge,
            get_knowledge_document,
            set_knowledge_archived,
            delete_knowledge,
            search_knowledge,
            check_knowledge_reference
        ])
        .run(tauri::generate_context!())
        .expect("error while running TradeQuill");
}
