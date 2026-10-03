mod quote_pdf;
mod storage;
use tauri_plugin_dialog::DialogExt;

use storage::commerce;
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

#[tauri::command]
async fn commerce_snapshot(app: tauri::AppHandle) -> Result<commerce::CommerceSnapshot, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::commerce_snapshot(data_dir))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn save_product(app: tauri::AppHandle, input: commerce::ProductInput) -> Result<i64, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::save_product(data_dir, input))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn save_supplier(
    app: tauri::AppHandle,
    input: commerce::SupplierInput,
) -> Result<i64, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::save_supplier(data_dir, input))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn save_offer(app: tauri::AppHandle, input: commerce::OfferInput) -> Result<i64, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::save_offer(data_dir, input))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn save_seller(app: tauri::AppHandle, seller: String) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::save_seller(data_dir, seller))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn save_structured_quote(
    app: tauri::AppHandle,
    input: commerce::StructuredQuoteInput,
) -> Result<i64, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::save_structured_quote(data_dir, input))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn get_quote_document(
    app: tauri::AppHandle,
    quote_id: i64,
) -> Result<commerce::QuoteDocument, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::get_quote_document(data_dir, quote_id))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn create_order(
    app: tauri::AppHandle,
    quote_id: i64,
    ordered_on: String,
) -> Result<i64, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        commerce::create_order(data_dir, quote_id, ordered_on)
    })
    .await
    .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn update_order(app: tauri::AppHandle, input: commerce::OrderUpdate) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::update_order(data_dir, input))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn transition_order(
    app: tauri::AppHandle,
    input: commerce::OrderTransition,
) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::transition_order(data_dir, input))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn save_order_costs(
    app: tauri::AppHandle,
    input: commerce::CostsInput,
) -> Result<(), String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::save_order_costs(data_dir, input))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn order_history(
    app: tauri::AppHandle,
    order_id: i64,
) -> Result<Vec<commerce::OrderEvent>, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::order_history(data_dir, order_id))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn draft_cost_from_offer(
    app: tauri::AppHandle,
    order_id: i64,
    line_index: usize,
    offer_id: i64,
    occurred_on: String,
) -> Result<commerce::CostEntry, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        commerce::draft_cost_from_offer(data_dir, order_id, line_index, offer_id, occurred_on)
    })
    .await
    .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn order_report(
    app: tauri::AppHandle,
    filter: commerce::ReportFilter,
) -> Result<commerce::OrderReport, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || commerce::order_report(data_dir, filter))
        .await
        .map_err(|error| format!("本地业务任务失败：{error}"))?
}

#[tauri::command]
async fn export_quote_pdf(app: tauri::AppHandle, quote_id: i64) -> Result<Option<String>, String> {
    let data_dir = app_data_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let quote = commerce::get_quote_document(data_dir, quote_id)?;
        let bytes = quote_pdf::render(&quote)?;
        let Some(selected) = app
            .dialog()
            .file()
            .set_title("保存报价 PDF")
            .add_filter("PDF", &["pdf"])
            .set_file_name(format!("{}.pdf", quote.number))
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let path = selected.into_path().map_err(|error| error.to_string())?;
        quote_pdf::save(&path, &bytes)?;
        Ok(Some(
            path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
        ))
    })
    .await
    .map_err(|error| format!("PDF 导出任务失败：{error}"))?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            workspace_status,
            export_quote_pdf,
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
            commerce_snapshot,
            save_product,
            save_supplier,
            save_offer,
            save_seller,
            save_structured_quote,
            get_quote_document,
            create_order,
            update_order,
            transition_order,
            save_order_costs,
            order_history,
            draft_cost_from_offer,
            order_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TradeQuill");
}
