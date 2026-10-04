use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

const MAX_FILE_BYTES: usize = 5 * 1024 * 1024;
const MAX_TEXT_CHARS: usize = 500_000;
const MAX_PAGES: usize = 100;
const MAX_DOCUMENTS: i64 = 100;
const MAX_MANAGED_BYTES: i64 = 500 * 1024 * 1024;
const PDF_TIMEOUT: Duration = Duration::from_secs(10);
const PDF_WORKER_FLAG: &str = "--tradequill-extract-pdf";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductParameter {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductInput {
    pub id: Option<i64>,
    pub sku: String,
    pub name: String,
    pub unit: String,
    pub parameters: Vec<ProductParameter>,
    pub moq: Option<String>,
    pub lead_time_days: Option<i64>,
    pub lead_time_max_days: Option<i64>,
    pub lead_time_note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductRecord {
    pub id: i64,
    pub sku: String,
    pub name: String,
    pub unit: String,
    pub parameters: Vec<ProductParameter>,
    pub moq: Option<String>,
    pub lead_time_days: Option<i64>,
    pub lead_time_max_days: Option<i64>,
    pub lead_time_note: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub internal_notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileImportInput {
    pub file_name: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgePage {
    pub page: i64,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub token: String,
    pub file_name: String,
    pub format: String,
    pub pages: Vec<KnowledgePage>,
    pub digest: String,
    pub expires_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeInput {
    pub id: Option<i64>,
    pub expected_version: Option<i64>,
    pub title: String,
    pub product_id: Option<i64>,
    pub tags: Vec<String>,
    pub source: String,
    pub kind: String,
    #[serde(default)]
    pub conflict_note: String,
    pub status: String,
    pub visibility: String,
    pub text: String,
    pub preview_token: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSummary {
    pub id: i64,
    pub title: String,
    pub product_id: Option<i64>,
    pub tags: Vec<String>,
    pub source: String,
    pub kind: String,
    pub conflict_note: String,
    pub status: String,
    pub visibility: String,
    pub archived: bool,
    pub deleted: bool,
    pub version: i64,
    pub format: String,
    pub file_name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeVersion {
    pub version: i64,
    pub format: String,
    pub file_name: String,
    pub created_at: String,
    pub current: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeDetail {
    pub document: KnowledgeSummary,
    pub pages: Vec<KnowledgePage>,
    pub history: Vec<KnowledgeVersion>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSnapshot {
    pub products: Vec<ProductRecord>,
    pub documents: Vec<KnowledgeSummary>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSearchInput {
    pub query: String,
    #[serde(default)]
    pub all_products: bool,
    #[serde(default)]
    pub product_ids: Vec<i64>,
    #[serde(default)]
    pub document_ids: Vec<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub confirmed_only: bool,
    pub public_only: bool,
    pub include_general: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSnippet {
    pub document_id: i64,
    pub version: i64,
    pub page: i64,
    pub title: String,
    pub text: String,
    pub product_id: Option<i64>,
    pub product_archived: bool,
    pub source: String,
    pub conflict_note: String,
    pub status: String,
    pub visibility: String,
    pub format: String,
}

// All managed file copies live in SQLite BLOBs, making preview confirmation,
// version replacement and content deletion atomic with the parsed text.
pub(crate) fn migrate(transaction: &Transaction<'_>) -> rusqlite::Result<()> {
    transaction.execute_batch(
        "CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            parameters_json TEXT NOT NULL,
            moq TEXT,
            lead_time_days INTEGER,
            lead_time_note TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE TABLE knowledge_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
            tags_json TEXT NOT NULL,
            source TEXT NOT NULL,
            kind TEXT NOT NULL,
            conflict_note TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            visibility TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0,
            deleted INTEGER NOT NULL DEFAULT 0,
            current_version INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE TABLE knowledge_versions (
            document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
            version INTEGER NOT NULL,
            format TEXT NOT NULL,
            file_name TEXT NOT NULL,
            digest TEXT NOT NULL,
            file_bytes BLOB,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            PRIMARY KEY(document_id,version)
        );
        CREATE TABLE knowledge_pages (
            document_id INTEGER NOT NULL,
            version INTEGER NOT NULL,
            page INTEGER NOT NULL,
            text TEXT NOT NULL,
            PRIMARY KEY(document_id,version,page),
            FOREIGN KEY(document_id,version) REFERENCES knowledge_versions(document_id,version)
                ON DELETE CASCADE
        );
        CREATE TABLE knowledge_import_previews (
            token TEXT PRIMARY KEY NOT NULL,
            file_name TEXT NOT NULL,
            format TEXT NOT NULL,
            digest TEXT NOT NULL,
            file_bytes BLOB NOT NULL,
            pages_json TEXT NOT NULL,
            expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now','+15 minutes'))
        );
        CREATE INDEX knowledge_products_idx ON knowledge_documents(product_id,deleted,archived);
        CREATE INDEX knowledge_digest_idx ON knowledge_versions(digest);",
    )
}

fn clean(value: String, label: &str, max: usize, required: bool) -> Result<String, String> {
    let value = value.trim().to_owned();
    if required && value.is_empty() {
        return Err(format!("{label}不能为空。"));
    }
    if value.chars().count() > max || value.chars().any(|c| c == '\0') {
        return Err(format!("{label}过长或包含不支持的字符。"));
    }
    Ok(value)
}

fn db_error(error: rusqlite::Error) -> String {
    format!("本地资料保存或读取失败：{error}")
}

fn open_catalog(data_dir: PathBuf) -> Result<Connection, String> {
    let connection = crate::storage::open(data_dir)?;
    connection
        .pragma_update(None, "secure_delete", "ON")
        .map_err(db_error)?;
    connection.execute("DELETE FROM knowledge_import_previews WHERE expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')", []).map_err(db_error)?;
    Ok(connection)
}

fn ensure_managed_capacity(connection: &Connection, max_bytes: i64) -> Result<(), String> {
    let total: i64 = connection
        .query_row(
            "SELECT
            COALESCE((SELECT sum(length(file_bytes)) FROM knowledge_versions),0) +
            COALESCE((SELECT sum(length(CAST(text AS BLOB))) FROM knowledge_pages),0) +
            COALESCE((SELECT sum(length(file_bytes)+length(CAST(pages_json AS BLOB)))
                FROM knowledge_import_previews),0)",
            [],
            |row| row.get(0),
        )
        .map_err(db_error)?;
    if total > max_bytes {
        return Err("资料副本与版本总容量达到500MiB，请删除不再需要的资料后重试。".into());
    }
    Ok(())
}

fn positive_decimal(value: Option<String>) -> Result<Option<String>, String> {
    let Some(value) = value.filter(|s| !s.trim().is_empty()) else {
        return Ok(None);
    };
    let value = value.trim();
    let parts: Vec<_> = value.split('.').collect();
    if parts.len() > 2
        || parts[0].is_empty()
        || parts[0].len() > 9
        || !parts[0].bytes().all(|c| c.is_ascii_digit())
        || parts.get(1).is_some_and(|part| {
            part.is_empty() || part.len() > 3 || !part.bytes().all(|c| c.is_ascii_digit())
        })
        || !value.bytes().any(|c| (b'1'..=b'9').contains(&c))
    {
        return Err("MOQ 必须为大于零的数量，最多 9 位整数和 3 位小数；未知请留空。".into());
    }
    let whole = parts[0].trim_start_matches('0');
    let whole = if whole.is_empty() { "0" } else { whole };
    let fraction = parts.get(1).map(|s| s.trim_end_matches('0')).unwrap_or("");
    Ok(Some(if fraction.is_empty() {
        whole.into()
    } else {
        format!("{whole}.{fraction}")
    }))
}

pub fn save_product(data_dir: PathBuf, input: ProductInput) -> Result<ProductRecord, String> {
    let mut connection = open_catalog(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(db_error)?;
    let record = save_product_in_transaction(&transaction, input)?;
    transaction.commit().map_err(db_error)?;
    Ok(record)
}

pub(crate) fn save_product_in_transaction(
    transaction: &Transaction<'_>,
    mut input: ProductInput,
) -> Result<ProductRecord, String> {
    input.sku = clean(input.sku, "产品编号", 80, true)?;
    input.name = clean(input.name, "产品名称", 200, true)?;
    input.unit = clean(input.unit, "计量单位", 40, true)?;
    input.lead_time_note = clean(input.lead_time_note, "交期说明", 500, false)?;
    input.moq = positive_decimal(input.moq)?;
    input.lead_time_max_days = input.lead_time_max_days.or(input.lead_time_days);
    crate::storage::commerce::lead_days(input.lead_time_days, input.lead_time_max_days)?;
    if input.lead_time_days.is_some() && input.lead_time_note.is_empty() {
        return Err("填写交期时请说明起算条件，例如确认订单后。".into());
    }
    if input.parameters.len() > 30 {
        return Err("每个产品最多 30 个参数。".into());
    }
    let mut names = Vec::new();
    for parameter in &mut input.parameters {
        parameter.name = clean(parameter.name.clone(), "参数名称", 80, true)?;
        parameter.value = clean(parameter.value.clone(), "参数值", 500, true)?;
        let key = parameter.name.to_lowercase();
        if names.contains(&key) {
            return Err("参数名称不能重复。".into());
        }
        names.push(key);
    }
    let duplicate: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM products WHERE sku=?1 COLLATE NOCASE AND id!=?2)",
            params![input.sku, input.id.unwrap_or(-1)],
            |row| row.get(0),
        )
        .map_err(db_error)?;
    if duplicate {
        return Err("产品编号已存在（含已归档产品），请使用不同编号。".into());
    }
    let parameters = serde_json::to_string(&input.parameters).map_err(|e| e.to_string())?;
    let id = if let Some(id) = input.id {
        let changed = transaction
            .execute(
                "UPDATE products SET sku=?1,name=?2,unit=?3,parameters_json=?4,moq=?5,
                lead_time_days=?6,lead_time_note=?7,lead_time_max_days=?9,
                updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?8",
                params![
                    input.sku,
                    input.name,
                    input.unit,
                    parameters,
                    input.moq,
                    input.lead_time_days,
                    input.lead_time_note,
                    id,
                    input.lead_time_max_days
                ],
            )
            .map_err(db_error)?;
        if changed == 0 {
            return Err("产品不存在，请刷新列表。".into());
        }
        id
    } else {
        transaction.execute(
            "INSERT INTO products(sku,name,unit,parameters_json,moq,lead_time_days,lead_time_note,lead_time_max_days)
                VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
            params![input.sku,input.name,input.unit,parameters,input.moq,
                input.lead_time_days,input.lead_time_note,input.lead_time_max_days],
        ).map_err(db_error)?;
        transaction.last_insert_rowid()
    };
    read_product(transaction, id)
}

fn product_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProductRecord> {
    let parameters: String = row.get(4)?;
    let parameters = serde_json::from_str(&parameters).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(e))
    })?;
    Ok(ProductRecord {
        id: row.get(0)?,
        sku: row.get(1)?,
        name: row.get(2)?,
        unit: row.get(3)?,
        parameters,
        moq: row.get(5)?,
        lead_time_days: row.get(6)?,
        lead_time_note: row.get(7)?,
        archived: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        lead_time_max_days: row.get(11)?,
        internal_notes: row.get(12)?,
    })
}

pub(crate) fn read_product(connection: &Connection, id: i64) -> Result<ProductRecord, String> {
    connection
        .query_row(
            "SELECT id,sku,name,unit,parameters_json,moq,lead_time_days,
        lead_time_note,archived,created_at,updated_at,lead_time_max_days,internal_notes FROM products WHERE id=?1",
            [id],
            product_row,
        )
        .optional()
        .map_err(db_error)?
        .ok_or_else(|| "产品不存在，请刷新列表。".into())
}

pub fn set_product_archived(
    data_dir: PathBuf,
    product_id: i64,
    archived: bool,
) -> Result<(), String> {
    let connection = open_catalog(data_dir)?;
    let count = connection.execute(
        "UPDATE products SET archived=?1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?2",
        params![archived,product_id],
    ).map_err(db_error)?;
    if count == 0 {
        return Err("产品不存在。".into());
    }
    Ok(())
}

pub fn list_catalog(data_dir: PathBuf) -> Result<CatalogSnapshot, String> {
    let connection = open_catalog(data_dir)?;
    let products = read_products(&connection)?;
    let documents = read_summaries(&connection, false)?;
    Ok(CatalogSnapshot {
        products,
        documents,
    })
}

pub(crate) fn read_products(connection: &Connection) -> Result<Vec<ProductRecord>, String> {
    let mut products = connection
        .prepare(
            "SELECT id,sku,name,unit,parameters_json,moq,
        lead_time_days,lead_time_note,archived,created_at,updated_at,lead_time_max_days,internal_notes FROM products
        ORDER BY archived,name,id",
        )
        .map_err(db_error)?;
    let result = products
        .query_map([], product_row)
        .map_err(db_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_error);
    result
}

fn summary_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<KnowledgeSummary> {
    let tags: String = row.get(3)?;
    let tags = serde_json::from_str(&tags).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(e))
    })?;
    Ok(KnowledgeSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        product_id: row.get(2)?,
        tags,
        source: row.get(4)?,
        kind: row.get(5)?,
        status: row.get(6)?,
        visibility: row.get(7)?,
        archived: row.get(8)?,
        deleted: row.get(9)?,
        version: row.get(10)?,
        format: row.get(11)?,
        file_name: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
        conflict_note: row.get(15)?,
    })
}

const SUMMARY_SQL: &str = "SELECT d.id,d.title,d.product_id,d.tags_json,d.source,d.kind,
    d.status,d.visibility,d.archived,d.deleted,d.current_version,COALESCE(v.format,''),
    COALESCE(v.file_name,''),d.created_at,d.updated_at,d.conflict_note FROM knowledge_documents d
    LEFT JOIN knowledge_versions v ON v.document_id=d.id AND v.version=d.current_version";

fn read_summaries(connection: &Connection, deleted: bool) -> Result<Vec<KnowledgeSummary>, String> {
    let mut statement = connection
        .prepare(&format!(
            "{SUMMARY_SQL} WHERE d.deleted=?1 ORDER BY d.archived,d.updated_at DESC,d.id DESC"
        ))
        .map_err(db_error)?;
    let rows = statement
        .query_map([deleted], summary_row)
        .map_err(db_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_error)?;
    Ok(rows)
}

fn read_summary(connection: &Connection, id: i64) -> Result<KnowledgeSummary, String> {
    connection
        .query_row(&format!("{SUMMARY_SQL} WHERE d.id=?1"), [id], summary_row)
        .optional()
        .map_err(db_error)?
        .ok_or_else(|| "资料不存在。".into())
}

fn read_pages(
    connection: &Connection,
    id: i64,
    version: i64,
) -> Result<Vec<KnowledgePage>, String> {
    let mut statement = connection
        .prepare(
            "SELECT page,text FROM knowledge_pages
        WHERE document_id=?1 AND version=?2 ORDER BY page",
        )
        .map_err(db_error)?;
    let rows = statement
        .query_map(params![id, version], |row| {
            Ok(KnowledgePage {
                page: row.get(0)?,
                text: row.get(1)?,
            })
        })
        .map_err(db_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_error)?;
    Ok(rows)
}

pub fn get_knowledge_document(
    data_dir: PathBuf,
    document_id: i64,
) -> Result<KnowledgeDetail, String> {
    let connection = open_catalog(data_dir)?;
    let document = read_summary(&connection, document_id)?;
    let pages = read_pages(&connection, document_id, document.version)?;
    let mut statement = connection
        .prepare(
            "SELECT version,format,file_name,created_at
        FROM knowledge_versions WHERE document_id=?1 ORDER BY version DESC",
        )
        .map_err(db_error)?;
    let history = statement
        .query_map([document_id], |row| {
            let version = row.get(0)?;
            Ok(KnowledgeVersion {
                version,
                format: row.get(1)?,
                file_name: row.get(2)?,
                created_at: row.get(3)?,
                current: version == document.version,
            })
        })
        .map_err(db_error)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_error)?;
    Ok(KnowledgeDetail {
        document,
        pages,
        history,
    })
}

fn validate_pages(pages: Vec<String>) -> Result<Vec<KnowledgePage>, String> {
    if pages.is_empty() || pages.len() > MAX_PAGES {
        return Err("资料没有可提取页面，或超过 100 页上限。".into());
    }
    let mut total = 0;
    let mut nonempty = false;
    let mut result = Vec::new();
    for (index, text) in pages.into_iter().enumerate() {
        let text = text.trim().to_owned();
        let count = text.chars().count();
        total += count;
        if total > MAX_TEXT_CHARS {
            return Err("提取文字超过 50 万字符上限。".into());
        }
        if text.chars().any(|c| c == '\0' || c == '\u{fffd}')
            || text
                .chars()
                .filter(|c| c.is_control() && !c.is_whitespace())
                .count()
                > 0
        {
            return Err("资料含乱码或不支持的控制字符，请改用 UTF-8 文本。".into());
        }
        nonempty |= !text.is_empty();
        result.push(KnowledgePage {
            page: index as i64 + 1,
            text,
        });
    }
    if !nonempty {
        return Err("未提取到文字；扫描 PDF 需要先转为含文本的 PDF，本应用不提供 OCR。".into());
    }
    Ok(result)
}

fn file_format(name: &str) -> Result<&'static str, String> {
    let name = name.to_ascii_lowercase();
    if name.ends_with(".txt") {
        Ok("txt")
    } else if name.ends_with(".md") || name.ends_with(".markdown") {
        Ok("md")
    } else if name.ends_with(".pdf") {
        Ok("pdf")
    } else {
        Err("只支持 UTF-8 TXT、Markdown 和含文本的 PDF。".into())
    }
}

fn extract_pdf(bytes: &[u8]) -> Result<Vec<KnowledgePage>, String> {
    let document =
        pdf_extract::Document::load_mem(bytes).map_err(|_| "无法解析 PDF，请检查文件是否损坏。")?;
    if document.is_encrypted() {
        return Err("暂不支持加密 PDF，请先提供未加密的资料副本。".into());
    }
    let count = document.get_pages().len();
    if count == 0 || count > MAX_PAGES {
        return Err("PDF 必须包含 1–100 页。".into());
    }
    drop(document);
    let pages = pdf_extract::extract_text_from_mem_by_pages(bytes)
        .map_err(|_| "PDF 文字提取失败，请换用 TXT/Markdown 或另一份 PDF。")?;
    if pages.len() != count {
        return Err("部分 PDF 页面提取失败，未导入不完整内容。".into());
    }
    validate_pages(pages)
}

#[derive(Serialize, Deserialize)]
struct PdfWorkerOutput {
    pages: Vec<KnowledgePage>,
    error: Option<String>,
}

/// Called before starting Tauri. The worker does not initialize Tauri/app state
/// or use paths/the database; its parsing input is limited to stdin bytes.
pub fn maybe_run_pdf_worker() -> bool {
    if !std::env::args().any(|arg| arg == PDF_WORKER_FLAG) {
        return false;
    }
    let result = std::panic::catch_unwind(|| -> Result<Vec<KnowledgePage>, String> {
        let mut bytes = Vec::new();
        std::io::stdin()
            .take((MAX_FILE_BYTES + 1) as u64)
            .read_to_end(&mut bytes)
            .map_err(|_| "无法读取待解析 PDF。")?;
        if bytes.len() > MAX_FILE_BYTES {
            return Err("PDF 超过 5 MiB 上限。".into());
        }
        extract_pdf(&bytes)
    })
    .unwrap_or_else(|_| Err("PDF 解析失败，请换用 TXT/Markdown。".into()));
    let output = match result {
        Ok(pages) => PdfWorkerOutput { pages, error: None },
        Err(error) => PdfWorkerOutput {
            pages: Vec::new(),
            error: Some(error),
        },
    };
    let _ = serde_json::to_writer(std::io::stdout(), &output);
    true
}

fn parse_pdf_bounded(bytes: Vec<u8>) -> Result<Vec<KnowledgePage>, String> {
    let executable = std::env::current_exe().map_err(|_| "无法启动 PDF 解析，请重试。")?;
    let mut child = Command::new(executable)
        .arg(PDF_WORKER_FLAG)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "无法启动 PDF 解析，请重试。")?;
    let mut stdin = child.stdin.take().ok_or("无法连接 PDF 解析器。")?;
    let stdout = child.stdout.take().ok_or("无法读取 PDF 提取预览。")?;
    let writer = thread::spawn(move || stdin.write_all(&bytes));
    let reader = thread::spawn(move || {
        let mut output = Vec::new();
        stdout
            .take((MAX_TEXT_CHARS * 8 + 1) as u64)
            .read_to_end(&mut output)
            .map(|_| output)
    });
    let start = Instant::now();
    let result = loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                break if status.success() {
                    Ok(())
                } else {
                    Err("PDF 解析器退出，请换用其他资料。")
                }
            }
            Ok(None) if start.elapsed() < PDF_TIMEOUT => thread::sleep(Duration::from_millis(20)),
            Ok(None) => {
                let _ = child.kill();
                break Err("PDF 解析超过 10 秒，已停止；请减少页数或改用文本。");
            }
            Err(_) => {
                let _ = child.kill();
                break Err("无法取得 PDF 解析结果。");
            }
        }
    };
    let _ = child.wait();
    let _ = writer.join();
    let output = reader
        .join()
        .map_err(|_| "无法读取 PDF 提取结果。")?
        .map_err(|_| "无法读取 PDF 提取结果。")?;
    result?;
    if output.len() > MAX_TEXT_CHARS * 8 {
        return Err("PDF 提取内容过大，已停止。".into());
    }
    let output: PdfWorkerOutput =
        serde_json::from_slice(&output).map_err(|_| "PDF 返回的提取结果无效。")?;
    if let Some(error) = output.error {
        return Err(error);
    }
    Ok(output.pages)
}

pub fn preview_knowledge_import(
    data_dir: PathBuf,
    input: FileImportInput,
) -> Result<ImportPreview, String> {
    preview_knowledge_import_with_capacity(data_dir, input, MAX_MANAGED_BYTES)
}

fn preview_knowledge_import_with_capacity(
    data_dir: PathBuf,
    input: FileImportInput,
    max_bytes: i64,
) -> Result<ImportPreview, String> {
    let file_name = clean(input.file_name, "文件名", 200, true)?;
    if file_name.contains(['/', '\\']) {
        return Err("请选择文件，不接受文件路径。".into());
    }
    if input.bytes.is_empty() || input.bytes.len() > MAX_FILE_BYTES {
        return Err("资料必须为非空文件，单文件最大 5 MiB。".into());
    }
    let format = file_format(&file_name)?;
    let digest = format!("{:x}", Sha256::digest(&input.bytes));
    let mut connection = open_catalog(data_dir)?;
    let duplicate: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM knowledge_versions v
        JOIN knowledge_documents d ON d.id=v.document_id WHERE v.digest=?1 AND d.deleted=0)",
            [&digest],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    if duplicate {
        return Err("相同文件已导入（包括旧版本及归档资料），请查看已有资料。".into());
    }
    let pages = if format == "pdf" {
        parse_pdf_bounded(input.bytes.clone())?
    } else {
        let text =
            std::str::from_utf8(&input.bytes).map_err(|_| "文本不是 UTF-8，请转换编码后重试。")?;
        validate_pages(vec![text.trim_start_matches('\u{feff}').into()])?
    };
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(db_error)?;
    transaction.execute("DELETE FROM knowledge_import_previews WHERE expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')",[]).map_err(db_error)?;
    let count: i64 = transaction
        .query_row("SELECT count(*) FROM knowledge_import_previews", [], |r| {
            r.get(0)
        })
        .map_err(db_error)?;
    if count >= 10 {
        return Err("待确认预览已达到 10 份，请先保存资料或在 15 分钟过期后重试。".into());
    }
    let token: String = transaction
        .query_row("SELECT lower(hex(randomblob(24)))", [], |r| r.get(0))
        .map_err(db_error)?;
    transaction.execute("INSERT INTO knowledge_import_previews(token,file_name,format,digest,file_bytes,pages_json)
        VALUES(?1,?2,?3,?4,?5,?6)",params![token,file_name,format,digest,input.bytes,
        serde_json::to_string(&pages).map_err(|e|e.to_string())?]).map_err(db_error)?;
    let expires_at = transaction
        .query_row(
            "SELECT expires_at FROM knowledge_import_previews WHERE token=?1",
            [&token],
            |r| r.get(0),
        )
        .map_err(db_error)?;
    ensure_managed_capacity(&transaction, max_bytes)?;
    transaction.commit().map_err(db_error)?;
    Ok(ImportPreview {
        token,
        file_name,
        format: format.into(),
        pages,
        digest,
        expires_at,
    })
}

struct VersionContent {
    format: String,
    file_name: String,
    digest: String,
    bytes: Option<Vec<u8>>,
    pages: Vec<KnowledgePage>,
}

fn version_content(
    transaction: &Transaction<'_>,
    input: &KnowledgeInput,
) -> Result<VersionContent, String> {
    if input.kind != "file" {
        if input.preview_token.is_some() {
            return Err("文本条目不能使用文件预览。".into());
        }
        let pages = validate_pages(vec![input.text.clone()])?;
        return Ok(VersionContent {
            format: "text".into(),
            file_name: String::new(),
            digest: String::new(),
            bytes: None,
            pages,
        });
    }
    if let Some(token) = &input.preview_token {
        let found = transaction.query_row("SELECT format,file_name,digest,file_bytes,pages_json
            FROM knowledge_import_previews WHERE token=?1 AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')",
            [token],|r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,
                r.get::<_,Vec<u8>>(3)?,r.get::<_,String>(4)?))).optional().map_err(db_error)?;
        let (format, file_name, digest, bytes, pages) =
            found.ok_or("文件预览已过期或已保存，请重新选择文件。")?;
        return Ok(VersionContent {
            format,
            file_name,
            digest,
            bytes: Some(bytes),
            pages: serde_json::from_str(&pages).map_err(|_| "提取预览数据无效，请重新导入。")?,
        });
    }
    // A metadata-only revision reuses the controlled original and parsed pages.
    let id = input.id.ok_or("请先选择文件并检查提取预览。")?;
    let (format, file_name, digest, bytes, version) = transaction
        .query_row(
            "SELECT v.format,v.file_name,v.digest,v.file_bytes,v.version FROM knowledge_versions v
         JOIN knowledge_documents d ON d.id=v.document_id AND d.current_version=v.version
         WHERE d.id=?1 AND d.deleted=0 AND d.kind='file'",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .optional()
        .map_err(db_error)?
        .ok_or("请先选择文件并检查提取预览。")?;
    Ok(VersionContent {
        format,
        file_name,
        digest,
        bytes,
        pages: read_pages(transaction, id, version)?,
    })
}

pub fn save_knowledge(
    data_dir: PathBuf,
    input: KnowledgeInput,
) -> Result<KnowledgeSummary, String> {
    save_knowledge_with_capacity(data_dir, input, MAX_MANAGED_BYTES)
}

fn save_knowledge_with_capacity(
    data_dir: PathBuf,
    mut input: KnowledgeInput,
    max_bytes: i64,
) -> Result<KnowledgeSummary, String> {
    input.title = clean(input.title, "资料标题", 200, true)?;
    input.source = clean(input.source, "来源", 500, true)?;
    input.conflict_note = clean(input.conflict_note, "冲突说明", 2000, false)?;
    if !["text", "faq", "file"].contains(&input.kind.as_str())
        || !["draft", "confirmed"].contains(&input.status.as_str())
        || !["public", "internal"].contains(&input.visibility.as_str())
    {
        return Err("资料类型、确认状态或使用范围无效。".into());
    }
    if input.tags.len() > 20 {
        return Err("每份资料最多 20 个标签。".into());
    }
    for tag in &mut input.tags {
        *tag = clean(tag.clone(), "标签", 40, true)?;
    }
    input.tags.sort();
    input.tags.dedup();
    let mut connection = open_catalog(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(db_error)?;
    if let Some(id) = input.product_id {
        read_product(&transaction, id)?;
    }
    let version = if let Some(id) = input.id {
        let document = read_summary(&transaction, id)?;
        if document.deleted {
            return Err("资料已删除，不能更新。".into());
        }
        if input.expected_version != Some(document.version) {
            return Err("资料已被更新，请刷新后重新检查；未覆盖已有版本。".into());
        }
        document.version + 1
    } else {
        let count: i64 = transaction
            .query_row(
                "SELECT count(*) FROM knowledge_documents WHERE deleted=0",
                [],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        if count >= MAX_DOCUMENTS {
            return Err("资料库已达到 100 份上限，请先删除不需要的资料。".into());
        }
        1
    };
    let content = version_content(&transaction, &input)?;
    if !content.digest.is_empty() {
        let duplicate:bool=transaction.query_row("SELECT EXISTS(SELECT 1 FROM knowledge_versions v
            JOIN knowledge_documents d ON d.id=v.document_id WHERE v.digest=?1 AND d.deleted=0 AND d.id!=?2)",
            params![content.digest,input.id.unwrap_or(-1)],|r|r.get(0)).map_err(db_error)?;
        if duplicate {
            return Err("相同文件已由另一份资料保存，请查看已有资料。".into());
        }
    }
    let tags = serde_json::to_string(&input.tags).map_err(|e| e.to_string())?;
    let id = if let Some(id) = input.id {
        transaction
            .execute(
                "UPDATE knowledge_documents SET title=?1,product_id=?2,tags_json=?3,
            source=?4,kind=?5,status=?6,visibility=?7,current_version=?8,
            updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),conflict_note=?10 WHERE id=?9",
                params![
                    input.title,
                    input.product_id,
                    tags,
                    input.source,
                    input.kind,
                    input.status,
                    input.visibility,
                    version,
                    id,
                    input.conflict_note
                ],
            )
            .map_err(db_error)?;
        id
    } else {
        transaction.execute("INSERT INTO knowledge_documents(title,product_id,tags_json,source,kind,status,visibility,current_version,conflict_note)
            VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",params![input.title,input.product_id,tags,input.source,input.kind,input.status,input.visibility,version,input.conflict_note]).map_err(db_error)?;
        transaction.last_insert_rowid()
    };
    transaction
        .execute(
            "INSERT INTO knowledge_versions(document_id,version,format,file_name,digest,file_bytes)
        VALUES(?1,?2,?3,?4,?5,?6)",
            params![
                id,
                version,
                content.format,
                content.file_name,
                content.digest,
                content.bytes
            ],
        )
        .map_err(db_error)?;
    for page in content.pages {
        transaction
            .execute(
                "INSERT INTO knowledge_pages(document_id,version,page,text)
        VALUES(?1,?2,?3,?4)",
                params![id, version, page.page, page.text],
            )
            .map_err(db_error)?;
    }
    if let Some(token) = input.preview_token {
        transaction
            .execute(
                "DELETE FROM knowledge_import_previews WHERE token=?1",
                [token],
            )
            .map_err(db_error)?;
    }
    let summary = read_summary(&transaction, id)?;
    ensure_managed_capacity(&transaction, max_bytes)?;
    transaction.commit().map_err(db_error)?;
    Ok(summary)
}

pub fn set_knowledge_archived(
    data_dir: PathBuf,
    document_id: i64,
    archived: bool,
) -> Result<(), String> {
    let connection = open_catalog(data_dir)?;
    let count = connection
        .execute(
            "UPDATE knowledge_documents SET archived=?1,
        updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?2 AND deleted=0",
            params![archived, document_id],
        )
        .map_err(db_error)?;
    if count == 0 {
        return Err("资料不存在或已删除。".into());
    }
    Ok(())
}

pub fn delete_knowledge(data_dir: PathBuf, document_id: i64) -> Result<(), String> {
    let mut connection = open_catalog(data_dir)?;
    // secure_delete also removes deleted BLOB/text cells from SQLite free pages.
    connection
        .pragma_update(None, "secure_delete", "ON")
        .map_err(db_error)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(db_error)?;
    let document = read_summary(&transaction, document_id)?;
    if document.deleted {
        return Ok(());
    }
    transaction
        .execute(
            "DELETE FROM knowledge_import_previews WHERE digest IN
        (SELECT digest FROM knowledge_versions WHERE document_id=?1)",
            [document_id],
        )
        .map_err(db_error)?;
    transaction
        .execute(
            "DELETE FROM knowledge_versions WHERE document_id=?1",
            [document_id],
        )
        .map_err(db_error)?;
    // Keep only a minimal tombstone so saved answers can report deleted sources.
    transaction.execute("UPDATE knowledge_documents SET deleted=1,title='已删除资料',source='',tags_json='[]',
        status='draft',visibility='internal',conflict_note='',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1",
        [document_id]).map_err(db_error)?;
    transaction.commit().map_err(db_error)?;
    Ok(())
}

pub fn check_knowledge_reference(
    data_dir: PathBuf,
    document_id: i64,
    version: i64,
) -> Result<String, String> {
    let connection = open_catalog(data_dir)?;
    let state = connection
        .query_row(
            "SELECT deleted,archived,current_version FROM knowledge_documents WHERE id=?1",
            [document_id],
            |r| {
                Ok((
                    r.get::<_, bool>(0)?,
                    r.get::<_, bool>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            },
        )
        .optional()
        .map_err(db_error)?;
    Ok(match state {
        None => "missing",
        Some((true, _, _)) => "deleted",
        Some((_, true, _)) => "archived",
        Some((_, _, current)) if current != version => "old_version",
        _ => "current",
    }
    .into())
}

fn snippet(text: &str, terms: &[String]) -> String {
    let chars: Vec<char> = text.chars().collect();
    let lower = text.to_lowercase();
    let first = terms
        .iter()
        .filter_map(|term| lower.find(term))
        .min()
        .and_then(|byte| {
            // Lowercasing can expand a character, so map back to the original text.
            let mut lowered_bytes = 0;
            chars.iter().position(|ch| {
                lowered_bytes += ch.to_lowercase().map(char::len_utf8).sum::<usize>();
                lowered_bytes > byte
            })
        })
        .unwrap_or(0);
    let start = first.saturating_sub(120).min(chars.len());
    let end = (start + 600).min(chars.len());
    let mut out: String = chars[start..end].iter().collect();
    if start > 0 {
        out.insert(0, '…');
    }
    if end < chars.len() {
        out.push('…');
    }
    out
}

pub fn search_knowledge(
    data_dir: PathBuf,
    input: KnowledgeSearchInput,
) -> Result<Vec<KnowledgeSnippet>, String> {
    let query = clean(input.query, "检索词", 200, false)?;
    if input.product_ids.len() > 100 || input.document_ids.len() > 100 || input.tags.len() > 20 {
        return Err("检索范围超过上限。".into());
    }
    let connection = open_catalog(data_dir)?;
    for id in &input.product_ids {
        read_product(&connection, *id)?;
    }
    let terms: Vec<String> = query.split_whitespace().map(|s| s.to_lowercase()).collect();
    let documents = read_summaries(&connection, false)?;
    let mut results = Vec::new();
    for document in documents {
        if document.archived
            || (input.confirmed_only && document.status != "confirmed")
            || (input.public_only && document.visibility != "public")
            || (!input.document_ids.is_empty() && !input.document_ids.contains(&document.id))
            || (!input.tags.is_empty() && !input.tags.iter().all(|tag| document.tags.contains(tag)))
        {
            continue;
        }
        let in_scope = match document.product_id {
            None => input.include_general,
            Some(id) => input.all_products || input.product_ids.contains(&id),
        };
        if !in_scope {
            continue;
        }
        let product_archived = match document.product_id {
            Some(id) => read_product(&connection, id)?.archived,
            None => false,
        };
        for page in read_pages(&connection, document.id, document.version)? {
            let searchable = format!(
                "{} {} {}",
                document.title,
                document.tags.join(" "),
                page.text
            )
            .to_lowercase();
            if terms.iter().all(|term| searchable.contains(term)) {
                results.push(KnowledgeSnippet {
                    document_id: document.id,
                    version: document.version,
                    page: page.page,
                    title: document.title.clone(),
                    text: snippet(&page.text, &terms),
                    product_id: document.product_id,
                    product_archived,
                    source: document.source.clone(),
                    conflict_note: document.conflict_note.clone(),
                    status: document.status.clone(),
                    visibility: document.visibility.clone(),
                    format: document.format.clone(),
                });
                if results.len() >= 40 {
                    return Ok(results);
                }
            }
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests;
