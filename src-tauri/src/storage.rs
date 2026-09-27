use rusqlite::Connection;
use serde::Serialize;
use std::{fs, path::PathBuf, time::Duration};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    database_path: String,
    attachments_path: String,
    schema_version: i64,
}

/// Initialize only the application-owned directory. Never accept a path from the UI.
pub fn initialize(data_dir: PathBuf) -> Result<WorkspaceStatus, String> {
    let initialize = || -> Result<WorkspaceStatus, Box<dyn std::error::Error>> {
        fs::create_dir_all(&data_dir)?;
        let attachments_path = data_dir.join("attachments");
        fs::create_dir_all(&attachments_path)?;
        let database_path = data_dir.join("tradequill.sqlite3");
        let mut connection = Connection::open(&database_path)?;
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        // Serialize first-run migrations when two application windows start together.
        let transaction =
            connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let version: i64 =
            transaction.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version > 1 {
            return Err("数据由更新版本的 TradeQuill 创建，请升级应用后再打开。".into());
        }
        if version == 0 {
            transaction.execute_batch(
                "CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);\n                 INSERT INTO app_metadata (key, value) VALUES ('product', 'TradeQuill');\n                 PRAGMA user_version = 1;",
            )?;
        }
        transaction.commit()?;
        Ok(WorkspaceStatus {
            database_path: database_path.to_string_lossy().into_owned(),
            attachments_path: attachments_path.to_string_lossy().into_owned(),
            schema_version: 1,
        })
    };
    initialize().map_err(|error| format!("无法打开本地工作区：{error}"))
}
