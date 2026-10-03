use super::*;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Parameter {
    pub name: String,
    pub value: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub code: String,
    pub name: String,
    pub parameters: Vec<Parameter>,
    pub unit: String,
    pub moq: Option<String>,
    pub lead_days_min: Option<i64>,
    pub lead_days_max: Option<i64>,
    pub notes: String,
    pub archived: bool,
}

pub type ProductInput = Input<Product>;

pub(super) fn lead_days(min: Option<i64>, max: Option<i64>) -> Result<(), String> {
    match (min, max) {
        (None, None) => Ok(()),
        (Some(min), Some(max)) if min >= 0 && max >= min && max <= 3650 => Ok(()),
        _ => Err("交期须同时填写最小/最大天数，范围为 0–3650，且最大值不小于最小值。".into()),
    }
}

pub(super) fn validate_product(mut product: Product) -> Result<Product, String> {
    product.code = required(product.code, "产品编号", 80)?;
    product.name = required(product.name, "产品名称", 160)?;
    product.unit = required(product.unit, "计量单位", 40)?;
    product.notes = optional(product.notes, "产品备注", 2000)?;
    product.moq = optional_decimal(product.moq, 3, "MOQ")?;
    if product.moq.as_deref() == Some("0.000") {
        return Err("MOQ 须大于零；未知时请留空。".into());
    }
    lead_days(product.lead_days_min, product.lead_days_max)?;
    if product.parameters.len() > 30 {
        return Err("每个产品最多 30 个参数。".into());
    }
    let mut names = std::collections::HashSet::new();
    for parameter in &mut product.parameters {
        parameter.name = required(std::mem::take(&mut parameter.name), "参数名称", 80)?;
        parameter.value = required(std::mem::take(&mut parameter.value), "参数值", 500)?;
        if !names.insert(parameter.name.to_lowercase()) {
            return Err("参数名称不能重复。".into());
        }
    }
    Ok(product)
}

pub fn save_product(data_dir: PathBuf, input: ProductInput) -> Result<i64, String> {
    let product = validate_product(input.data)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let key = product.code.to_lowercase();
    let duplicate: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM products WHERE code_key=?1 AND id!=?2)",
            params![key, input.id.unwrap_or(0)],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if duplicate {
        return Err("产品编号已存在（不区分大小写），请编辑原档案或使用其他编号。".into());
    }
    let data = encode(&product)?;
    let id = if let Some(id) = input.id {
        update_one(
            transaction
                .execute(
                    "UPDATE products SET code_key=?1,data=?2 WHERE id=?3",
                    params![key, data, id],
                )
                .map_err(|error| error.to_string())?,
        )?;
        id
    } else {
        transaction
            .execute(
                "INSERT INTO products(code_key,data) VALUES (?1,?2)",
                params![key, data],
            )
            .map_err(|error| error.to_string())?;
        transaction.last_insert_rowid()
    };
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(id)
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Supplier {
    pub name: String,
    pub contact: String,
    pub email: String,
    pub phone: String,
    pub address: String,
    pub notes: String,
    pub archived: bool,
}

pub type SupplierInput = Input<Supplier>;

pub fn save_supplier(data_dir: PathBuf, input: SupplierInput) -> Result<i64, String> {
    let mut supplier = input.data;
    supplier.name = required(supplier.name, "供应商名称", 160)?;
    supplier.contact = optional(supplier.contact, "联系人", 120)?;
    supplier.email = optional(supplier.email, "邮箱", 254)?;
    if !supplier.email.is_empty()
        && (!supplier.email.contains('@') || supplier.email.chars().any(char::is_whitespace))
    {
        return Err("请输入有效的供应商邮箱。".into());
    }
    supplier.phone = optional(supplier.phone, "电话", 80)?;
    supplier.address = optional(supplier.address, "地址", 500)?;
    supplier.notes = optional(supplier.notes, "供应商备注", 2000)?;
    let key = supplier.name.to_lowercase();
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let duplicate: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM suppliers WHERE name_key=?1 AND id!=?2)",
            params![key, input.id.unwrap_or(0)],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if duplicate {
        return Err("供应商名称已存在（不区分大小写），请编辑或恢复原档案。".into());
    }
    let data = encode(&supplier)?;
    let id = if let Some(id) = input.id {
        update_one(
            transaction
                .execute(
                    "UPDATE suppliers SET name_key=?1,data=?2 WHERE id=?3",
                    params![key, data, id],
                )
                .map_err(|error| error.to_string())?,
        )?;
        id
    } else {
        transaction
            .execute(
                "INSERT INTO suppliers(name_key,data) VALUES (?1,?2)",
                params![key, data],
            )
            .map_err(|error| error.to_string())?;
        transaction.last_insert_rowid()
    };
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(id)
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Offer {
    pub product_id: i64,
    pub supplier_id: i64,
    pub supplier_code: String,
    pub price: Option<String>,
    pub currency: String,
    pub quoted_on: Option<String>,
    pub moq: Option<String>,
    pub lead_days_min: Option<i64>,
    pub lead_days_max: Option<i64>,
    pub notes: String,
    pub active: bool,
}

pub type OfferInput = Input<Offer>;

pub fn save_offer(data_dir: PathBuf, input: OfferInput) -> Result<i64, String> {
    let mut offer = input.data;
    offer.supplier_code = optional(offer.supplier_code, "供应商货号", 80)?;
    offer.price = optional_decimal(offer.price, 4, "采购参考单价")?;
    money::scale(&offer.currency)?;
    offer.quoted_on = offer
        .quoted_on
        .map(|value| date(value, "参考报价日期"))
        .transpose()?;
    if offer.price.is_some() && offer.quoted_on.is_none() {
        return Err("填写采购参考价时须同时填写报价日期。".into());
    }
    offer.moq = optional_decimal(offer.moq, 3, "供货 MOQ")?;
    if offer.moq.as_deref() == Some("0.000") {
        return Err("供货 MOQ 须大于零；未知时留空。".into());
    }
    lead_days(offer.lead_days_min, offer.lead_days_max)?;
    offer.notes = optional(offer.notes, "供货备注", 2000)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let product: Record<Product> = record(
        &transaction,
        "SELECT data FROM products WHERE id=?1",
        offer.product_id,
    )?;
    let supplier: Record<Supplier> = record(
        &transaction,
        "SELECT data FROM suppliers WHERE id=?1",
        offer.supplier_id,
    )?;
    if offer.active && (product.data.archived || supplier.data.archived) {
        return Err("归档产品或供应商不能新增/启用供货关联，请先恢复档案。".into());
    }
    let duplicate: bool = transaction.query_row("SELECT EXISTS(SELECT 1 FROM supplier_offers WHERE product_id=?1 AND supplier_id=?2 AND id!=?3)", params![offer.product_id, offer.supplier_id, input.id.unwrap_or(0)], |row| row.get(0)).map_err(|error| error.to_string())?;
    if duplicate {
        return Err("该产品与供应商已有供货关联，请编辑原关联（包括已解除的关联）。".into());
    }
    let data = encode(&offer)?;
    let id = if let Some(id) = input.id {
        update_one(transaction.execute("UPDATE supplier_offers SET data=?1 WHERE id=?2 AND product_id=?3 AND supplier_id=?4", params![data, id, offer.product_id, offer.supplier_id]).map_err(|error| error.to_string())?)?;
        id
    } else {
        transaction
            .execute(
                "INSERT INTO supplier_offers(product_id,supplier_id,data) VALUES (?1,?2,?3)",
                params![offer.product_id, offer.supplier_id, data],
            )
            .map_err(|error| error.to_string())?;
        transaction.last_insert_rowid()
    };
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(id)
}
