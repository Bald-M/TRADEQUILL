use super::{open, optional, required, valid_date};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::path::PathBuf;

mod catalog;
mod money;
mod orders;
mod quotation;
mod reports;
pub use catalog::*;
pub use orders::*;
pub use quotation::*;
pub use reports::*;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Record<T> {
    pub id: i64,
    #[serde(flatten)]
    pub data: T,
}

#[derive(Debug, Deserialize)]
pub struct Input<T> {
    pub id: Option<i64>,
    #[serde(flatten)]
    pub data: T,
}

fn encode<T: Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|error| error.to_string())
}

fn decode<T: DeserializeOwned>(value: String) -> Result<T, String> {
    serde_json::from_str(&value).map_err(|error| format!("业务记录无法读取：{error}"))
}

fn records<T: DeserializeOwned>(
    connection: &Connection,
    sql: &str,
) -> Result<Vec<Record<T>>, String> {
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?;
    rows.map(|row| {
        let (id, data) = row.map_err(|error| error.to_string())?;
        Ok(Record {
            id,
            data: decode(data)?,
        })
    })
    .collect()
}

fn record<T: DeserializeOwned>(
    connection: &Connection,
    sql: &str,
    id: i64,
) -> Result<Record<T>, String> {
    let data: Option<String> = connection
        .query_row(sql, [id], |row| row.get(0))
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(Record {
        id,
        data: decode(data.ok_or("记录不存在，请刷新后重试。")?)?,
    })
}

fn date(value: String, label: &str) -> Result<String, String> {
    let value = valid_date(value, label)?;
    if value.len() != 10 || &value[4..5] != "-" || &value[7..8] != "-" {
        return Err(format!("{label}须为 YYYY-MM-DD 格式。"));
    }
    Ok(value)
}

fn optional_decimal(
    value: Option<String>,
    places: u32,
    label: &str,
) -> Result<Option<String>, String> {
    value
        .map(|value| {
            money::parse(&value, places, label).map(|number| money::format(number, places))
        })
        .transpose()
}

fn update_one(changed: usize) -> Result<(), String> {
    if changed == 1 {
        Ok(())
    } else {
        Err("记录已更改或不存在，请刷新后重试。".into())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceSnapshot {
    pub products: Vec<Record<Product>>,
    pub suppliers: Vec<Record<Supplier>>,
    pub offers: Vec<Record<Offer>>,
    pub quotes: Vec<QuoteDocument>,
    pub orders: Vec<Record<Order>>,
    pub seller: String,
}

pub fn commerce_snapshot(data_dir: PathBuf) -> Result<CommerceSnapshot, String> {
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let result = CommerceSnapshot {
        products: records(
            &transaction,
            "SELECT id, data FROM products ORDER BY id DESC",
        )?,
        suppliers: records(
            &transaction,
            "SELECT id, data FROM suppliers ORDER BY id DESC",
        )?,
        offers: records(
            &transaction,
            "SELECT id, data FROM supplier_offers ORDER BY id DESC",
        )?,
        quotes: load_quotes(&transaction)?,
        orders: load_orders(&transaction)?,
        seller: transaction
            .query_row(
                "SELECT value FROM commerce_settings WHERE key='seller'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .unwrap_or_default(),
    };
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(result)
}

pub fn save_seller(data_dir: PathBuf, seller: String) -> Result<(), String> {
    let seller = required(seller, "公司抬头与联系方式", 1000)?;
    open(data_dir)?.execute("INSERT INTO commerce_settings(key,value) VALUES ('seller',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [seller]).map_err(|error| error.to_string())?;
    Ok(())
}
