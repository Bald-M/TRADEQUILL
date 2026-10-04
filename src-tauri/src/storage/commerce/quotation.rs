use super::super::valid_inquiry_relation;
use super::*;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteLine {
    pub product_id: i64,
    pub product: Product,
    pub quantity: String,
    pub unit_price: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteFields {
    pub customer_id: i64,
    pub inquiry_id: Option<i64>,
    pub quoted_on: String,
    pub valid_until: String,
    pub seller: String,
    pub terms: String,
    pub currency: String,
    pub discount: String,
    pub tax: String,
    pub freight: String,
    pub lines: Vec<QuoteLine>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredQuoteInput {
    pub request_key: String,
    pub previous_quote_id: Option<i64>,
    #[serde(flatten)]
    pub fields: QuoteFields,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerSnapshot {
    pub name: String,
    pub company: String,
    pub email: String,
    pub phone: String,
    pub country: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteDocument {
    pub quote_id: i64,
    pub series_id: i64,
    pub revision: i64,
    pub number: String,
    pub previous_quote_id: Option<i64>,
    pub customer: CustomerSnapshot,
    #[serde(flatten)]
    pub fields: QuoteFields,
    pub line_amounts: Vec<String>,
    pub below_moq: Vec<usize>,
    pub subtotal: String,
    pub total: String,
}

pub(super) fn load_quotes(connection: &Connection) -> Result<Vec<QuoteDocument>, String> {
    let mut statement = connection
        .prepare("SELECT data FROM quote_versions ORDER BY quote_id DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    rows.map(|row| decode(row.map_err(|error| error.to_string())?))
        .collect()
}

pub(super) fn quote(connection: &Connection, id: i64) -> Result<QuoteDocument, String> {
    let data: Option<String> = connection
        .query_row(
            "SELECT data FROM quote_versions WHERE quote_id=?1",
            [id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    decode(
        data.ok_or("该报价没有结构化明细，请先从旧报价补齐产品、数量、单价及条款后保存新报价。")?,
    )
}

pub fn get_quote_document(data_dir: PathBuf, quote_id: i64) -> Result<QuoteDocument, String> {
    quote(&open(data_dir)?, quote_id)
}

pub fn save_structured_quote(
    data_dir: PathBuf,
    input: StructuredQuoteInput,
) -> Result<i64, String> {
    let request_key = required(input.request_key, "保存请求标识", 80)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    if let Some(id) = transaction
        .query_row(
            "SELECT quote_id FROM quote_versions WHERE request_key=?1",
            [&request_key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
    {
        return Ok(id);
    }
    let mut fields = input.fields;
    valid_inquiry_relation(&transaction, fields.customer_id, fields.inquiry_id)?;
    fields.quoted_on = date(fields.quoted_on, "报价日期")?;
    fields.valid_until = date(fields.valid_until, "有效期")?;
    if fields.valid_until < fields.quoted_on {
        return Err("有效期不能早于报价日期。".into());
    }
    fields.seller = required(fields.seller, "公司抬头", 1000)?;
    fields.terms = required(fields.terms, "贸易及商业条款", 4000)?;
    let places = money::scale(&fields.currency)?;
    let discount = money::parse(&fields.discount, places, "折扣金额")?;
    let tax = money::parse(&fields.tax, places, "向客户收取的税费")?;
    let freight = money::parse(&fields.freight, places, "向客户收取的运费")?;
    fields.discount = money::format(discount, places);
    fields.tax = money::format(tax, places);
    fields.freight = money::format(freight, places);
    if fields.lines.is_empty() || fields.lines.len() > 100 {
        return Err("每份报价须有 1–100 条产品明细。".into());
    }
    let previous = if let Some(id) = input.previous_quote_id {
        let customer: i64 = transaction
            .query_row(
                "SELECT customer_id FROM quote_records WHERE id=?1",
                [id],
                |row| row.get(0),
            )
            .map_err(|_| "来源报价不存在。")?;
        if customer != fields.customer_id {
            return Err("修订报价必须属于同一客户。".into());
        }
        let data: Option<String> = transaction
            .query_row(
                "SELECT data FROM quote_versions WHERE quote_id=?1",
                [id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        // A historical quote can start only one structured family. The immediate
        // transaction serializes concurrent conversions with different request keys.
        if data.is_none() {
            let converted: bool = transaction
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM quote_versions WHERE previous_quote_id=?1)",
                    [id],
                    |row| row.get(0),
                )
                .map_err(|error| error.to_string())?;
            if converted {
                return Err("该旧报价已补齐，请从对应结构化报价的最新版本继续修订。".into());
            }
        }
        data.map(decode::<QuoteDocument>).transpose()?
    } else {
        None
    };
    let mut line_amounts = Vec::new();
    let mut below_moq = Vec::new();
    let mut subtotal: i128 = 0;
    for (index, line) in fields.lines.iter_mut().enumerate() {
        let product = read_product(&transaction, line.product_id)?;
        if product.data.archived
            && !previous.as_ref().is_some_and(|quote| {
                quote
                    .fields
                    .lines
                    .iter()
                    .any(|old| old.product_id == line.product_id)
            })
        {
            return Err("归档产品不能加入新报价；已有报价修订可保留原产品。".into());
        }
        line.product = validate_product(line.product.clone())?;
        let quantity = money::parse(&line.quantity, 3, "数量")?;
        let amount = money::line_total(&line.quantity, &line.unit_price, &fields.currency)?;
        line.quantity = money::format(quantity, 3);
        line.unit_price = money::format(money::parse(&line.unit_price, 4, "单价")?, 4);
        if let Some(moq) = &line.product.moq {
            if quantity < money::parse(moq, 3, "MOQ")? {
                below_moq.push(index);
            }
        }
        subtotal += i128::from(amount);
        line_amounts.push(money::format(amount, places));
    }
    let subtotal = money::bounded(subtotal)?;
    if discount > subtotal {
        return Err("折扣不能超过商品小计。".into());
    }
    let total = money::bounded(
        i128::from(subtotal) - i128::from(discount) + i128::from(tax) + i128::from(freight),
    )?;
    let (series_id, revision) = if let Some(previous) = &previous {
        let latest: i64 = transaction
            .query_row(
                "SELECT MAX(revision) FROM quote_versions WHERE series_id=?1",
                [previous.series_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if previous.revision != latest {
            return Err("该报价已有新修订，请从最新版本继续修订。".into());
        }
        (previous.series_id, latest + 1)
    } else {
        transaction
            .execute("INSERT INTO quote_series DEFAULT VALUES", [])
            .map_err(|error| error.to_string())?;
        (transaction.last_insert_rowid(), 1)
    };
    let customer = transaction
        .query_row(
            "SELECT name,company,email,phone,country FROM customers WHERE id=?1",
            [fields.customer_id],
            |row| {
                Ok(CustomerSnapshot {
                    name: row.get(0)?,
                    company: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    country: row.get(4)?,
                })
            },
        )
        .map_err(|error| error.to_string())?;
    let number = format!("QT-{series_id:06}-R{revision}");
    // The existing legacy table stores hundredths for every currency, including JPY.
    // Keep its historical scale while the structured document uses currency minor units.
    let legacy_amount = if places == 0 {
        total.checked_mul(100).ok_or("报价金额过大。")?
    } else {
        total
    };
    transaction.execute("INSERT INTO quote_records(customer_id,inquiry_id,quoted_on,content,amount_minor,currency,notes) VALUES (?1,?2,?3,?4,?5,?6,'结构化报价：修订另存版本')", params![fields.customer_id,fields.inquiry_id,fields.quoted_on,number,legacy_amount,fields.currency]).map_err(|error| error.to_string())?;
    let quote_id = transaction.last_insert_rowid();
    let document = QuoteDocument {
        quote_id,
        series_id,
        revision,
        number,
        previous_quote_id: input.previous_quote_id,
        customer,
        fields,
        line_amounts,
        below_moq,
        subtotal: money::format(subtotal, places),
        total: money::format(total, places),
    };
    transaction.execute("INSERT INTO quote_versions(quote_id,series_id,revision,previous_quote_id,request_key,data) VALUES (?1,?2,?3,?4,?5,?6)", params![quote_id,series_id,revision,input.previous_quote_id,request_key,encode(&document)?]).map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(quote_id)
}
