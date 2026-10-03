use chrono::{NaiveDate, NaiveDateTime};
use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, time::Duration};

pub mod commerce;

const SCHEMA_VERSION: i64 = 3;
const FOLLOW_UP_STAGES: [&str; 6] = ["new", "contacted", "quoted", "sampling", "won", "paused"];
const SAMPLE_STAGES: [&str; 6] = [
    "requested",
    "preparing",
    "sent",
    "received",
    "completed",
    "cancelled",
];
const CURRENCIES: [&str; 5] = ["USD", "CNY", "EUR", "GBP", "JPY"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    database_path: String,
    attachments_path: String,
    schema_version: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInput {
    pub id: Option<i64>,
    pub name: String,
    pub company: String,
    pub email: String,
    pub phone: String,
    pub country: String,
    pub source: String,
    pub notes: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerRecord {
    id: i64,
    name: String,
    company: String,
    email: String,
    phone: String,
    country: String,
    source: String,
    notes: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InquiryInput {
    pub id: Option<i64>,
    pub customer_id: i64,
    pub received_on: String,
    pub content: String,
    pub source: String,
    pub country: String,
    pub products: Vec<String>,
    pub stage: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InquiryRecord {
    id: i64,
    customer_id: i64,
    received_on: String,
    content: String,
    source: String,
    country: String,
    products: Vec<String>,
    stage: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteInput {
    pub id: Option<i64>,
    pub customer_id: i64,
    pub inquiry_id: Option<i64>,
    pub quoted_on: String,
    pub content: String,
    pub amount: String,
    pub currency: String,
    pub notes: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteRecord {
    id: i64,
    customer_id: i64,
    inquiry_id: Option<i64>,
    quoted_on: String,
    content: String,
    amount: String,
    currency: String,
    notes: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleInput {
    pub id: Option<i64>,
    pub customer_id: i64,
    pub inquiry_id: Option<i64>,
    pub product: String,
    pub quantity: i64,
    pub requested_on: String,
    pub notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleProgressInput {
    pub sample_id: i64,
    pub stage: String,
    pub occurred_on: String,
    pub notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleShipmentInput {
    pub sample_id: i64,
    pub carrier: String,
    pub tracking_number: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleProgressRecord {
    id: i64,
    sample_id: i64,
    stage: String,
    occurred_on: String,
    notes: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleRecord {
    id: i64,
    customer_id: i64,
    inquiry_id: Option<i64>,
    product: String,
    quantity: i64,
    requested_on: String,
    notes: String,
    carrier: String,
    tracking_number: String,
    current_stage: String,
    created_at: String,
    updated_at: String,
    progress: Vec<SampleProgressRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUpTaskInput {
    pub id: Option<i64>,
    pub customer_id: i64,
    pub inquiry_id: Option<i64>,
    pub due_at: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUpTaskRecord {
    id: i64,
    customer_id: i64,
    inquiry_id: Option<i64>,
    due_at: String,
    content: String,
    completed: bool,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessSnapshot {
    customers: Vec<CustomerRecord>,
    inquiries: Vec<InquiryRecord>,
    quotes: Vec<QuoteRecord>,
    samples: Vec<SampleRecord>,
    tasks: Vec<FollowUpTaskRecord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderSummary {
    local_date: String,
    due_today: i64,
    overdue: i64,
}

/// Initialize only the application-owned directory. Never accept a path from the UI.
pub fn initialize(data_dir: PathBuf) -> Result<WorkspaceStatus, String> {
    let initialize = || -> Result<WorkspaceStatus, Box<dyn std::error::Error>> {
        fs::create_dir_all(&data_dir)?;
        let attachments_path = data_dir.join("attachments");
        fs::create_dir_all(&attachments_path)?;
        let database_path = data_dir.join("tradequill.sqlite3");
        let mut connection = configured_connection(&database_path)?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut version: i64 =
            transaction.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version > SCHEMA_VERSION {
            return Err("数据由更新版本的 TradeQuill 创建，请升级应用后再打开。".into());
        }
        if version == 0 {
            transaction.execute_batch(
                "CREATE TABLE app_metadata (
                    key TEXT PRIMARY KEY NOT NULL,
                    value TEXT NOT NULL
                 );
                 INSERT INTO app_metadata (key, value) VALUES ('product', 'TradeQuill');
                 PRAGMA user_version = 1;",
            )?;
            version = 1;
        }
        if version == 1 {
            transaction.execute_batch(
                "CREATE TABLE customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    company TEXT NOT NULL DEFAULT '',
                    email TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    country TEXT NOT NULL DEFAULT '',
                    source TEXT NOT NULL DEFAULT '',
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE inquiries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    received_on TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT NOT NULL,
                    country TEXT NOT NULL,
                    products_json TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE quote_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE RESTRICT,
                    quoted_on TEXT NOT NULL,
                    content TEXT NOT NULL,
                    amount_minor INTEGER NOT NULL,
                    currency TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE samples (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE RESTRICT,
                    product TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    requested_on TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    carrier TEXT NOT NULL DEFAULT '',
                    tracking_number TEXT NOT NULL DEFAULT '',
                    current_stage TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE sample_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE RESTRICT,
                    stage TEXT NOT NULL,
                    occurred_on TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE follow_up_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE RESTRICT,
                    due_at TEXT NOT NULL,
                    content TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    completed_at TEXT,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE reminder_deliveries (
                    local_date TEXT PRIMARY KEY NOT NULL,
                    sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE INDEX inquiries_customer_idx ON inquiries(customer_id, received_on DESC);
                 CREATE INDEX quotes_customer_idx ON quote_records(customer_id, quoted_on DESC);
                 CREATE INDEX samples_customer_idx ON samples(customer_id, requested_on DESC);
                 CREATE INDEX sample_progress_sample_idx ON sample_progress(sample_id, occurred_on, id);
                 CREATE INDEX tasks_due_idx ON follow_up_tasks(completed, due_at);
                 PRAGMA user_version = 2;",
            )?;
        }
        if version <= 2 {
            transaction.execute_batch(include_str!("storage/commerce/schema.sql"))?;
        }
        transaction.commit()?;
        Ok(WorkspaceStatus {
            database_path: database_path.to_string_lossy().into_owned(),
            attachments_path: attachments_path.to_string_lossy().into_owned(),
            schema_version: SCHEMA_VERSION,
        })
    };
    initialize().map_err(|error| format!("无法打开本地工作区：{error}"))
}

fn configured_connection(path: &PathBuf) -> rusqlite::Result<Connection> {
    let connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(connection)
}

fn open(data_dir: PathBuf) -> Result<Connection, String> {
    initialize(data_dir.clone())?;
    configured_connection(&data_dir.join("tradequill.sqlite3"))
        .map_err(|error| format!("无法连接本地数据库：{error}"))
}

fn required(value: String, label: &str, max: usize) -> Result<String, String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(format!("{label}不能为空。"));
    }
    if value.chars().count() > max {
        return Err(format!("{label}不能超过 {max} 个字符。"));
    }
    Ok(value)
}

fn optional(value: String, label: &str, max: usize) -> Result<String, String> {
    let value = value.trim().to_owned();
    if value.chars().count() > max {
        return Err(format!("{label}不能超过 {max} 个字符。"));
    }
    Ok(value)
}

fn valid_date(value: String, label: &str) -> Result<String, String> {
    let value = required(value, label, 10)?;
    NaiveDate::parse_from_str(&value, "%Y-%m-%d")
        .map_err(|_| format!("{label}必须是有效日期。"))?;
    Ok(value)
}

fn valid_datetime(value: String, label: &str) -> Result<String, String> {
    let value = required(value, label, 16)?;
    NaiveDateTime::parse_from_str(&value, "%Y-%m-%dT%H:%M")
        .map_err(|_| format!("{label}必须是有效的本地日期和时间。"))?;
    Ok(value)
}

fn valid_customer(transaction: &Transaction<'_>, customer_id: i64) -> Result<(), String> {
    let exists: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM customers WHERE id = ?1)",
            [customer_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if exists {
        Ok(())
    } else {
        Err("所选客户不存在，请刷新后重试。".into())
    }
}

fn valid_inquiry_relation(
    transaction: &Transaction<'_>,
    customer_id: i64,
    inquiry_id: Option<i64>,
) -> Result<(), String> {
    valid_customer(transaction, customer_id)?;
    if let Some(inquiry_id) = inquiry_id {
        let actual_customer: Option<i64> = transaction
            .query_row(
                "SELECT customer_id FROM inquiries WHERE id = ?1",
                [inquiry_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        match actual_customer {
            Some(actual) if actual == customer_id => Ok(()),
            Some(_) => Err("只能关联该客户自己的询盘。".into()),
            None => Err("所选询盘不存在，请刷新后重试。".into()),
        }
    } else {
        Ok(())
    }
}

fn normalize_products(products: Vec<String>) -> Result<Vec<String>, String> {
    let mut normalized = Vec::new();
    for value in products {
        let value = required(value, "意向产品", 80)?;
        if !normalized
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(&value))
        {
            normalized.push(value);
        }
    }
    if normalized.is_empty() {
        return Err("至少填写一个意向产品。".into());
    }
    if normalized.len() > 20 {
        return Err("每条询盘最多记录 20 个意向产品。".into());
    }
    Ok(normalized)
}

fn parse_amount(value: String) -> Result<i64, String> {
    let value = required(value, "报价金额", 18)?;
    let parts: Vec<_> = value.split('.').collect();
    if parts.len() > 2 || parts[0].is_empty() || !parts[0].chars().all(|c| c.is_ascii_digit()) {
        return Err("报价金额必须是非负数字，最多保留两位小数。".into());
    }
    let fraction = match parts.get(1) {
        None => 0,
        Some(value) if value.len() <= 2 && value.chars().all(|c| c.is_ascii_digit()) => {
            match value.len() {
                0 => 0,
                1 => value.parse::<i64>().map_err(|_| "报价金额格式不正确。")? * 10,
                _ => value.parse::<i64>().map_err(|_| "报价金额格式不正确。")?,
            }
        }
        _ => return Err("报价金额必须是非负数字，最多保留两位小数。".into()),
    };
    let whole: i64 = parts[0].parse().map_err(|_| "报价金额过大。")?;
    whole
        .checked_mul(100)
        .and_then(|amount| amount.checked_add(fraction))
        .ok_or_else(|| "报价金额过大。".to_owned())
}

fn format_amount(value: i64) -> String {
    format!("{}.{:02}", value / 100, value % 100)
}

pub fn save_customer(data_dir: PathBuf, input: CustomerInput) -> Result<(), String> {
    let name = required(input.name, "客户姓名", 120)?;
    let company = optional(input.company, "公司名称", 160)?;
    let email = optional(input.email, "电子邮箱", 254)?;
    if !email.is_empty() && (!email.contains('@') || email.starts_with('@') || email.ends_with('@'))
    {
        return Err("电子邮箱格式不正确。".into());
    }
    let phone = optional(input.phone, "联系电话", 80)?;
    let country = optional(input.country, "国家或地区", 80)?;
    let source = optional(input.source, "客户来源", 80)?;
    let notes = optional(input.notes, "客户备注", 2000)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    if let Some(id) = input.id {
        let changed = transaction
            .execute(
                "UPDATE customers SET name=?1, company=?2, email=?3, phone=?4, country=?5,
                    source=?6, notes=?7, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?8",
                params![name, company, email, phone, country, source, notes, id],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("该客户已不存在，请刷新后重试。".into());
        }
    } else {
        transaction
            .execute(
                "INSERT INTO customers(name, company, email, phone, country, source, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![name, company, email, phone, country, source, notes],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

pub fn save_inquiry(data_dir: PathBuf, input: InquiryInput) -> Result<(), String> {
    let received_on = valid_date(input.received_on, "询盘日期")?;
    let content = required(input.content, "询盘内容", 4000)?;
    let source = required(input.source, "询盘来源", 80)?;
    let country = required(input.country, "国家或地区", 80)?;
    let products = normalize_products(input.products)?;
    if !FOLLOW_UP_STAGES.contains(&input.stage.as_str()) {
        return Err("请选择有效的跟进阶段。".into());
    }
    let products_json = serde_json::to_string(&products).map_err(|error| error.to_string())?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    valid_customer(&transaction, input.customer_id)?;
    if let Some(id) = input.id {
        let changed = transaction
            .execute(
                "UPDATE inquiries SET received_on=?1, content=?2, source=?3, country=?4,
                    products_json=?5, stage=?6, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id=?7 AND customer_id=?8",
                params![
                    received_on,
                    content,
                    source,
                    country,
                    products_json,
                    input.stage,
                    id,
                    input.customer_id
                ],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("该询盘不属于当前客户，或记录已不存在。".into());
        }
    } else {
        transaction
            .execute(
                "INSERT INTO inquiries(customer_id, received_on, content, source, country, products_json, stage)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![input.customer_id, received_on, content, source, country, products_json, input.stage],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

pub fn save_quote(data_dir: PathBuf, input: QuoteInput) -> Result<(), String> {
    let quoted_on = valid_date(input.quoted_on, "报价日期")?;
    let content = required(input.content, "报价产品或内容", 1000)?;
    let amount = parse_amount(input.amount)?;
    let currency = input.currency.trim().to_uppercase();
    if !CURRENCIES.contains(&currency.as_str()) {
        return Err("请选择支持的报价币种。".into());
    }
    let notes = optional(input.notes, "报价备注", 2000)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    valid_inquiry_relation(&transaction, input.customer_id, input.inquiry_id)?;
    if let Some(id) = input.id {
        let structured: bool = transaction
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM quote_versions WHERE quote_id=?1)",
                [id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if structured {
            return Err("结构化报价请创建新修订，不能覆盖历史版本。".into());
        }
        let changed = transaction
            .execute(
                "UPDATE quote_records SET inquiry_id=?1, quoted_on=?2, content=?3, amount_minor=?4,
                    currency=?5, notes=?6, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id=?7 AND customer_id=?8",
                params![
                    input.inquiry_id,
                    quoted_on,
                    content,
                    amount,
                    currency,
                    notes,
                    id,
                    input.customer_id
                ],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("该报价不属于当前客户，或记录已不存在。".into());
        }
    } else {
        transaction
            .execute(
                "INSERT INTO quote_records(customer_id, inquiry_id, quoted_on, content, amount_minor, currency, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![input.customer_id, input.inquiry_id, quoted_on, content, amount, currency, notes],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

pub fn save_sample(data_dir: PathBuf, input: SampleInput) -> Result<(), String> {
    let product = required(input.product, "样品产品", 160)?;
    if input.quantity <= 0 || input.quantity > 1_000_000 {
        return Err("样品数量必须是 1 到 1000000 之间的整数。".into());
    }
    let requested_on = valid_date(input.requested_on, "申请日期")?;
    let notes = optional(input.notes, "样品备注", 2000)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    valid_inquiry_relation(&transaction, input.customer_id, input.inquiry_id)?;
    if let Some(id) = input.id {
        let existing: Option<(String, String)> = transaction
            .query_row(
                "SELECT requested_on, current_stage FROM samples WHERE id=?1 AND customer_id=?2",
                params![id, input.customer_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        let (previous_requested_on, current_stage) =
            existing.ok_or_else(|| "该样品记录不属于当前客户，或记录已不存在。".to_owned())?;
        if previous_requested_on != requested_on && current_stage != "requested" {
            return Err("样品进入后续阶段后不能更改申请日期；请在进度备注中记录更正。".into());
        }
        let changed = transaction
            .execute(
                "UPDATE samples SET inquiry_id=?1, product=?2, quantity=?3, requested_on=?4,
                    notes=?5, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id=?6 AND customer_id=?7",
                params![
                    input.inquiry_id,
                    product,
                    input.quantity,
                    requested_on,
                    notes,
                    id,
                    input.customer_id
                ],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("该样品记录不属于当前客户，或记录已不存在。".into());
        }
        if previous_requested_on != requested_on {
            transaction
                .execute(
                    "UPDATE sample_progress SET occurred_on=?1 WHERE sample_id=?2 AND stage='requested'",
                    params![requested_on, id],
                )
                .map_err(|error| error.to_string())?;
        }
    } else {
        transaction
            .execute(
                "INSERT INTO samples(customer_id, inquiry_id, product, quantity, requested_on, notes, current_stage)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'requested')",
                params![input.customer_id, input.inquiry_id, product, input.quantity, requested_on, notes],
            )
            .map_err(|error| error.to_string())?;
        let sample_id = transaction.last_insert_rowid();
        transaction
            .execute(
                "INSERT INTO sample_progress(sample_id, stage, occurred_on, notes)
                 VALUES (?1, 'requested', ?2, '创建样品申请')",
                params![sample_id, requested_on],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

fn valid_sample_transition(current: &str, next: &str) -> bool {
    matches!(
        (current, next),
        ("requested", "preparing")
            | ("preparing", "sent")
            | ("sent", "received")
            | ("received", "completed")
            | ("requested" | "preparing" | "sent" | "received", "cancelled")
    )
}

pub fn append_sample_progress(data_dir: PathBuf, input: SampleProgressInput) -> Result<(), String> {
    if !SAMPLE_STAGES.contains(&input.stage.as_str()) {
        return Err("请选择有效的样品阶段。".into());
    }
    let occurred_on = valid_date(input.occurred_on, "进度日期")?;
    let notes = optional(input.notes, "进度备注", 2000)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let current: Option<(String, String)> = transaction
        .query_row(
            "SELECT current_stage,
                    COALESCE((SELECT MAX(occurred_on) FROM sample_progress WHERE sample_id=samples.id), requested_on)
             FROM samples WHERE id=?1",
            [input.sample_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let (current, latest_date) =
        current.ok_or_else(|| "样品记录不存在，请刷新后重试。".to_owned())?;
    if !valid_sample_transition(&current, &input.stage) {
        return Err(format!("不能从 {current} 直接更新到 {}。", input.stage));
    }
    if occurred_on < latest_date {
        return Err("进度日期不能早于上一条样品进度。".into());
    }
    transaction
        .execute(
            "INSERT INTO sample_progress(sample_id, stage, occurred_on, notes) VALUES (?1, ?2, ?3, ?4)",
            params![input.sample_id, input.stage, occurred_on, notes],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "UPDATE samples SET current_stage=?1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?2",
            params![input.stage, input.sample_id],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

pub fn update_sample_shipment(data_dir: PathBuf, input: SampleShipmentInput) -> Result<(), String> {
    let carrier = required(input.carrier, "物流承运方", 120)?;
    let tracking_number = required(input.tracking_number, "物流单号", 160)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let stage: Option<String> = transaction
        .query_row(
            "SELECT current_stage FROM samples WHERE id=?1",
            [input.sample_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let stage = stage.ok_or_else(|| "样品记录不存在，请刷新后重试。".to_owned())?;
    if !matches!(stage.as_str(), "sent" | "received" | "completed") {
        return Err("样品寄出后才能记录物流信息。".into());
    }
    transaction
        .execute(
            "UPDATE samples SET carrier=?1, tracking_number=?2,
                updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?3",
            params![carrier, tracking_number, input.sample_id],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

pub fn save_follow_up_task(data_dir: PathBuf, input: FollowUpTaskInput) -> Result<(), String> {
    let due_at = valid_datetime(input.due_at, "跟进时间")?;
    let content = required(input.content, "跟进内容", 1000)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    valid_inquiry_relation(&transaction, input.customer_id, input.inquiry_id)?;
    if let Some(id) = input.id {
        let changed = transaction
            .execute(
                "UPDATE follow_up_tasks SET inquiry_id=?1, due_at=?2, content=?3,
                    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id=?4 AND customer_id=?5",
                params![input.inquiry_id, due_at, content, id, input.customer_id],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("该跟进任务不属于当前客户，或记录已不存在。".into());
        }
    } else {
        transaction
            .execute(
                "INSERT INTO follow_up_tasks(customer_id, inquiry_id, due_at, content)
                 VALUES (?1, ?2, ?3, ?4)",
                params![input.customer_id, input.inquiry_id, due_at, content],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

pub fn set_follow_up_task_completed(
    data_dir: PathBuf,
    task_id: i64,
    completed: bool,
) -> Result<(), String> {
    let connection = open(data_dir)?;
    let changed = connection
        .execute(
            "UPDATE follow_up_tasks SET completed=?1,
                completed_at=CASE WHEN ?1=1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END,
                updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=?2",
            params![completed, task_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        Err("跟进任务不存在，请刷新后重试。".into())
    } else {
        Ok(())
    }
}

pub fn business_snapshot(data_dir: PathBuf) -> Result<BusinessSnapshot, String> {
    let connection = open(data_dir)?;
    Ok(BusinessSnapshot {
        customers: load_customers(&connection)?,
        inquiries: load_inquiries(&connection)?,
        quotes: load_quotes(&connection)?,
        samples: load_samples(&connection)?,
        tasks: load_tasks(&connection)?,
    })
}

fn load_customers(connection: &Connection) -> Result<Vec<CustomerRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, name, company, email, phone, country, source, notes, created_at, updated_at
             FROM customers ORDER BY updated_at DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let records = statement
        .query_map([], |row| {
            Ok(CustomerRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                company: row.get(2)?,
                email: row.get(3)?,
                phone: row.get(4)?,
                country: row.get(5)?,
                source: row.get(6)?,
                notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(records)
}

fn load_inquiries(connection: &Connection) -> Result<Vec<InquiryRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, customer_id, received_on, content, source, country, products_json,
                    stage, created_at, updated_at
             FROM inquiries ORDER BY received_on DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
            ))
        })
        .map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for row in rows {
        let (
            id,
            customer_id,
            received_on,
            content,
            source,
            country,
            products_json,
            stage,
            created_at,
            updated_at,
        ) = row.map_err(|error| error.to_string())?;
        records.push(InquiryRecord {
            id,
            customer_id,
            received_on,
            content,
            source,
            country,
            products: serde_json::from_str(&products_json)
                .map_err(|error| format!("询盘产品数据损坏：{error}"))?,
            stage,
            created_at,
            updated_at,
        });
    }
    Ok(records)
}

fn load_quotes(connection: &Connection) -> Result<Vec<QuoteRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, customer_id, inquiry_id, quoted_on, content, amount_minor, currency,
                    notes, created_at, updated_at
             FROM quote_records ORDER BY quoted_on DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let records = statement
        .query_map([], |row| {
            let amount: i64 = row.get(5)?;
            Ok(QuoteRecord {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                inquiry_id: row.get(2)?,
                quoted_on: row.get(3)?,
                content: row.get(4)?,
                amount: format_amount(amount),
                currency: row.get(6)?,
                notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(records)
}

fn load_samples(connection: &Connection) -> Result<Vec<SampleRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, customer_id, inquiry_id, product, quantity, requested_on, notes, carrier,
                    tracking_number, current_stage, created_at, updated_at
             FROM samples ORDER BY requested_on DESC, id DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(SampleRecord {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                inquiry_id: row.get(2)?,
                product: row.get(3)?,
                quantity: row.get(4)?,
                requested_on: row.get(5)?,
                notes: row.get(6)?,
                carrier: row.get(7)?,
                tracking_number: row.get(8)?,
                current_stage: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                progress: Vec::new(),
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let mut records = rows;
    for record in &mut records {
        let mut progress_statement = connection
            .prepare(
                "SELECT id, sample_id, stage, occurred_on, notes, created_at
                 FROM sample_progress WHERE sample_id=?1 ORDER BY occurred_on, id",
            )
            .map_err(|error| error.to_string())?;
        record.progress = progress_statement
            .query_map([record.id], |row| {
                Ok(SampleProgressRecord {
                    id: row.get(0)?,
                    sample_id: row.get(1)?,
                    stage: row.get(2)?,
                    occurred_on: row.get(3)?,
                    notes: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
    }
    Ok(records)
}

fn load_tasks(connection: &Connection) -> Result<Vec<FollowUpTaskRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, customer_id, inquiry_id, due_at, content, completed, completed_at,
                    created_at, updated_at
             FROM follow_up_tasks ORDER BY due_at, id",
        )
        .map_err(|error| error.to_string())?;
    let records = statement
        .query_map([], |row| {
            Ok(FollowUpTaskRecord {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                inquiry_id: row.get(2)?,
                due_at: row.get(3)?,
                content: row.get(4)?,
                completed: row.get::<_, i64>(5)? != 0,
                completed_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(records)
}

pub fn due_reminder(
    data_dir: PathBuf,
    local_date: String,
    local_date_time: String,
) -> Result<Option<ReminderSummary>, String> {
    let local_date = valid_date(local_date, "本地日期")?;
    let local_date_time = valid_datetime(local_date_time, "本地时间")?;
    if !local_date_time.starts_with(&local_date) {
        return Err("本地日期与时间不一致。".into());
    }
    if &local_date_time[11..16] < "09:00" {
        return Ok(None);
    }
    let connection = open(data_dir)?;
    let sent: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM reminder_deliveries WHERE local_date=?1)",
            [&local_date],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if sent {
        return Ok(None);
    }
    let start = format!("{local_date}T00:00");
    let end = format!("{local_date}T23:59");
    let overdue: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM follow_up_tasks WHERE completed=0 AND due_at < ?1",
            [&start],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let due_today: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM follow_up_tasks WHERE completed=0 AND due_at >= ?1 AND due_at <= ?2",
            params![start, end],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if overdue + due_today == 0 {
        Ok(None)
    } else {
        Ok(Some(ReminderSummary {
            local_date,
            due_today,
            overdue,
        }))
    }
}

pub fn mark_reminder_sent(data_dir: PathBuf, local_date: String) -> Result<(), String> {
    let local_date = valid_date(local_date, "提醒日期")?;
    let connection = open(data_dir)?;
    connection
        .execute(
            "INSERT OR IGNORE INTO reminder_deliveries(local_date) VALUES (?1)",
            [local_date],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests;
