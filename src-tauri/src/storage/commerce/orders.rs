use super::*;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CostEntry {
    pub category: String,
    pub amount: String,
    pub currency: String,
    pub occurred_on: String,
    pub notes: String,
    pub supplier_id: Option<i64>,
    #[serde(default)]
    pub supplier_name: String,
    pub product_id: Option<i64>,
    pub offer_id: Option<i64>,
    pub rate: Option<String>,
    pub rate_on: Option<String>,
    pub confirmed: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profit {
    pub missing_rates: usize,
    pub complete: bool,
    pub purchase: Option<String>,
    pub freight: Option<String>,
    pub tax: Option<String>,
    pub other: Option<String>,
    pub total_cost: Option<String>,
    pub profit: Option<String>,
    pub margin: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub number: String,
    pub source_quote_id: i64,
    pub quote: QuoteDocument,
    pub ordered_on: String,
    pub delivery_on: Option<String>,
    pub status: String,
    pub notes: String,
    pub version: i64,
    pub costs: Vec<CostEntry>,
    pub costs_complete: bool,
    pub completeness_note: String,
    pub profit: Profit,
}

pub(super) fn profit(order: &Order) -> Result<Profit, String> {
    let currency = &order.quote.fields.currency;
    let places = money::scale(currency)?;
    let mut amounts = [0_i128; 4];
    let mut missing = 0;
    for entry in &order.costs {
        let original = money::parse(&entry.amount, money::scale(&entry.currency)?, "费用")?;
        let converted = if &entry.currency == currency {
            original
        } else if let (Some(rate), Some(_)) = (&entry.rate, &entry.rate_on) {
            money::convert(original, &entry.currency, currency, rate)?
        } else {
            missing += 1;
            continue;
        };
        let index = match entry.category.as_str() {
            "purchase" => 0,
            "freight" => 1,
            "tax" => 2,
            "other" => 3,
            _ => return Err("费用分类无效。".into()),
        };
        amounts[index] += i128::from(converted);
    }
    if missing > 0 || (order.costs.is_empty() && !order.costs_complete) {
        return Ok(Profit {
            missing_rates: missing,
            ..Profit::default()
        });
    }
    let total = money::bounded(amounts.iter().sum())?;
    let revenue = money::parse(&order.quote.total, places, "订单收入")?;
    let profit = money::bounded(i128::from(revenue) - i128::from(total))?;
    Ok(Profit {
        missing_rates: 0,
        complete: order.costs_complete && order.costs.iter().all(|entry| entry.confirmed),
        purchase: Some(money::format(money::bounded(amounts[0])?, places)),
        freight: Some(money::format(money::bounded(amounts[1])?, places)),
        tax: Some(money::format(money::bounded(amounts[2])?, places)),
        other: Some(money::format(money::bounded(amounts[3])?, places)),
        total_cost: Some(money::format(total, places)),
        profit: Some(money::format(profit, places)),
        margin: money::margin(profit, revenue)?,
    })
}

pub(super) fn load_orders(connection: &Connection) -> Result<Vec<Record<Order>>, String> {
    let mut orders: Vec<Record<Order>> = records(
        connection,
        "SELECT id,data FROM orders ORDER BY ordered_on DESC,id DESC",
    )?;
    for order in &mut orders {
        order.data.profit = profit(&order.data)?;
    }
    Ok(orders)
}

fn history(connection: &Connection, id: i64, action: &str, order: &Order) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO order_history(order_id,action,data) VALUES (?1,?2,?3)",
            params![id, action, encode(order)?],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn create_order(data_dir: PathBuf, quote_id: i64, ordered_on: String) -> Result<i64, String> {
    let ordered_on = date(ordered_on, "订单日期")?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    if let Some(id) = transaction
        .query_row(
            "SELECT order_id FROM order_quote_sources WHERE quote_id=?1",
            [quote_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
    {
        return Ok(id);
    }
    let quote = quote(&transaction, quote_id)?;
    let active: Option<i64> = transaction
        .query_row(
            "SELECT id FROM orders WHERE series_id=?1 AND status!='cancelled'",
            [quote.series_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    if active.is_some() {
        return Err("这份报价已有未取消的订单，请查看原订单；首版不支持拆单。".into());
    }
    let last_used: Option<i64> = transaction.query_row("SELECT MAX(v.revision) FROM order_quote_sources s JOIN quote_versions v ON v.quote_id=s.quote_id WHERE v.series_id=?1", [quote.series_id], |row| row.get(0)).map_err(|error| error.to_string())?;
    if last_used.is_some_and(|revision| quote.revision <= revision) {
        return Err("取消后重新下单须使用报价的新修订。".into());
    }
    let mut order = Order {
        number: String::new(),
        source_quote_id: quote_id,
        quote,
        ordered_on,
        delivery_on: None,
        status: "draft".into(),
        notes: String::new(),
        version: 1,
        costs: vec![],
        costs_complete: false,
        completeness_note: String::new(),
        profit: Profit::default(),
    };
    order.profit = profit(&order)?;
    transaction.execute("INSERT INTO orders(source_quote_id,series_id,customer_id,ordered_on,status,version,data) VALUES (?1,?2,?3,?4,'draft',1,'')", params![quote_id,order.quote.series_id,order.quote.fields.customer_id,order.ordered_on]).map_err(|error| error.to_string())?;
    let id = transaction.last_insert_rowid();
    order.number = format!("SO-{id:06}");
    transaction
        .execute(
            "INSERT INTO order_quote_sources(quote_id,order_id) VALUES (?1,?2)",
            params![quote_id, id],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "UPDATE orders SET data=?1 WHERE id=?2",
            params![encode(&order)?, id],
        )
        .map_err(|error| error.to_string())?;
    history(&transaction, id, "从报价创建草稿", &order)?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderUpdate {
    pub id: i64,
    pub expected_version: i64,
    pub ordered_on: String,
    pub delivery_on: Option<String>,
    pub notes: String,
    pub source_quote_id: i64,
    pub reason: String,
}

fn mutable_order(connection: &Connection, id: i64, expected: i64) -> Result<Order, String> {
    let order: Record<Order> = record(connection, "SELECT data FROM orders WHERE id=?1", id)?;
    if order.data.version != expected {
        return Err("订单已被更新，请刷新后重试，当前输入已保留。".into());
    }
    if order.data.status == "cancelled" {
        return Err("已取消订单仅供查阅，不能更改。".into());
    }
    Ok(order.data)
}

fn persist_order(
    connection: &Connection,
    id: i64,
    order: &mut Order,
    action: &str,
) -> Result<(), String> {
    order.version += 1;
    order.profit = profit(order)?;
    update_one(connection.execute("UPDATE orders SET source_quote_id=?1,ordered_on=?2,status=?3,version=?4,data=?5 WHERE id=?6 AND version=?7",params![order.source_quote_id,order.ordered_on,order.status,order.version,encode(order)?,id,order.version-1]).map_err(|error| error.to_string())?)?;
    history(connection, id, action, order)
}

pub fn update_order(data_dir: PathBuf, input: OrderUpdate) -> Result<(), String> {
    let reason = required(input.reason, "更正原因", 500)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let mut order = mutable_order(&transaction, input.id, input.expected_version)?;
    if order.status != "draft" {
        return Err("已确认订单的销售数据和日期已冻结；更正请取消后用报价新修订重开。".into());
    }
    order.ordered_on = date(input.ordered_on, "订单日期")?;
    order.delivery_on = input
        .delivery_on
        .map(|value| date(value, "承诺交付日期"))
        .transpose()?;
    if order
        .delivery_on
        .as_ref()
        .is_some_and(|value| value < &order.ordered_on)
    {
        return Err("交付日期不能早于订单日期。".into());
    }
    order.notes = optional(input.notes, "订单备注", 2000)?;
    if input.source_quote_id != order.source_quote_id {
        let quote = quote(&transaction, input.source_quote_id)?;
        if quote.series_id != order.quote.series_id || quote.revision <= order.quote.revision {
            return Err("草稿只能承接同一报价的较新修订。".into());
        }
        if quote.fields.currency != order.quote.fields.currency && !order.costs.is_empty() {
            return Err("已有成本记录，不能更改订单币种；请先更正成本或取消后重开。".into());
        }
        if order.costs.iter().any(|entry| {
            entry
                .product_id
                .is_some_and(|id| !quote.fields.lines.iter().any(|line| line.product_id == id))
        }) {
            return Err("新报价修订移除了现有成本关联的产品；请先在成本中解除产品/供货关联或更正该费用，再承接修订。原订单和成本已保留。".into());
        }
        transaction
            .execute(
                "INSERT INTO order_quote_sources(quote_id,order_id) VALUES (?1,?2)",
                params![input.source_quote_id, input.id],
            )
            .map_err(|_| "该报价版本已被其他订单使用。".to_string())?;
        order.quote = quote;
        order.source_quote_id = input.source_quote_id;
        order.costs_complete = false;
        order.completeness_note.clear();
    }
    persist_order(
        &transaction,
        input.id,
        &mut order,
        &format!("更正草稿：{reason}"),
    )?;
    transaction.commit().map_err(|error| error.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderTransition {
    pub id: i64,
    pub expected_version: i64,
    pub status: String,
    pub reason: String,
}

pub fn transition_order(data_dir: PathBuf, input: OrderTransition) -> Result<(), String> {
    let reason = required(input.reason, "状态变更说明", 500)?;
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let mut order = mutable_order(&transaction, input.id, input.expected_version)?;
    if !matches!(
        (order.status.as_str(), input.status.as_str()),
        ("draft", "confirmed" | "cancelled") | ("confirmed", "cancelled")
    ) {
        return Err("不允许该订单状态变更。".into());
    }
    order.status = input.status;
    let action = format!(
        "状态变更为 {}：{reason}",
        if order.status == "confirmed" {
            "已确认"
        } else {
            "已取消"
        }
    );
    persist_order(&transaction, input.id, &mut order, &action)?;
    transaction.commit().map_err(|error| error.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CostsInput {
    pub order_id: i64,
    pub expected_version: i64,
    pub entries: Vec<CostEntry>,
    pub complete: bool,
    pub completeness_note: String,
    pub reason: String,
}

pub fn save_order_costs(data_dir: PathBuf, input: CostsInput) -> Result<(), String> {
    let reason = required(input.reason, "成本更正说明", 500)?;
    if input.entries.len() > 200 {
        return Err("每单最多 200 条费用。".into());
    }
    let mut connection = open(data_dir)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let mut order = mutable_order(&transaction, input.order_id, input.expected_version)?;
    let mut entries = input.entries;
    for entry in &mut entries {
        if !["purchase", "freight", "tax", "other"].contains(&entry.category.as_str()) {
            return Err("费用分类无效。".into());
        }
        let places = money::scale(&entry.currency)?;
        entry.amount = money::format(money::parse(&entry.amount, places, "费用金额")?, places);
        entry.occurred_on = date(std::mem::take(&mut entry.occurred_on), "费用日期")?;
        entry.notes = optional(std::mem::take(&mut entry.notes), "费用备注", 1000)?;
        entry.supplier_name = if let Some(id) = entry.supplier_id {
            record::<Supplier>(&transaction, "SELECT data FROM suppliers WHERE id=?1", id)?
                .data
                .name
        } else {
            String::new()
        };
        if let Some(id) = entry.product_id {
            if !order
                .quote
                .fields
                .lines
                .iter()
                .any(|line| line.product_id == id)
            {
                return Err("成本产品必须属于该订单。".into());
            }
        }
        if let Some(id) = entry.offer_id {
            let offer = record::<Offer>(
                &transaction,
                "SELECT data FROM supplier_offers WHERE id=?1",
                id,
            )?
            .data;
            if entry.product_id != Some(offer.product_id)
                || entry.supplier_id != Some(offer.supplier_id)
            {
                return Err("供货参考必须与成本产品和供应商一致。".into());
            }
        }
        if entry.currency == order.quote.fields.currency {
            entry.rate = None;
            entry.rate_on = None;
        } else {
            entry.rate = optional_decimal(entry.rate.take(), 6, "手动汇率")?;
            entry.rate_on = entry
                .rate_on
                .take()
                .map(|value| date(value, "汇率日期"))
                .transpose()?;
            if entry.rate.is_some() != entry.rate_on.is_some() {
                return Err("手动汇率和汇率日期须同时填写，也可都留空标记待补全。".into());
            }
            if let Some(rate) = &entry.rate {
                money::convert(0, &entry.currency, &order.quote.fields.currency, rate)?;
            }
        }
    }
    order.completeness_note = if input.complete {
        required(input.completeness_note, "成本完整确认说明", 1000)?
    } else {
        optional(input.completeness_note, "成本确认说明", 1000)?
    };
    if input.complete && entries.iter().any(|entry| !entry.confirmed) {
        return Err("成本完整确认前，请逐条确认参考价或暂估费用。".into());
    }
    order.costs = entries;
    order.costs_complete = input.complete;
    persist_order(
        &transaction,
        input.order_id,
        &mut order,
        &format!("成本更新：{reason}"),
    )?;
    transaction.commit().map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderEvent {
    pub id: i64,
    pub occurred_at: String,
    pub action: String,
    pub snapshot: Order,
}

pub fn order_history(data_dir: PathBuf, order_id: i64) -> Result<Vec<OrderEvent>, String> {
    let connection = open(data_dir)?;
    let mut statement = connection.prepare("SELECT id,occurred_at,action,data FROM order_history WHERE order_id=?1 ORDER BY id DESC").map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([order_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|error| error.to_string())?;
    rows.map(|row| {
        let (id, occurred_at, action, data) = row.map_err(|error| error.to_string())?;
        Ok(OrderEvent {
            id,
            occurred_at,
            action,
            snapshot: decode(data)?,
        })
    })
    .collect()
}

pub fn draft_cost_from_offer(
    data_dir: PathBuf,
    order_id: i64,
    line_index: usize,
    offer_id: i64,
    occurred_on: String,
) -> Result<CostEntry, String> {
    let connection = open(data_dir)?;
    let order: Record<Order> =
        record(&connection, "SELECT data FROM orders WHERE id=?1", order_id)?;
    let line = order
        .data
        .quote
        .fields
        .lines
        .get(line_index)
        .ok_or("订单明细不存在。")?;
    let offer: Record<Offer> = record(
        &connection,
        "SELECT data FROM supplier_offers WHERE id=?1",
        offer_id,
    )?;
    let supplier: Record<Supplier> = record(
        &connection,
        "SELECT data FROM suppliers WHERE id=?1",
        offer.data.supplier_id,
    )?;
    if !offer.data.active || supplier.data.archived || offer.data.product_id != line.product_id {
        return Err("请选择该产品的有效供货参考。".into());
    }
    let price = offer
        .data
        .price
        .as_ref()
        .ok_or("该供货参考价格未知，请手动录入成本。")?;
    let amount = money::line_total(&line.quantity, price, &offer.data.currency)?;
    Ok(CostEntry {
        category: "purchase".into(),
        amount: money::format(amount, money::scale(&offer.data.currency)?),
        currency: offer.data.currency,
        occurred_on: date(occurred_on, "费用日期")?,
        notes: format!(
            "供货参考：单价 {price}；报价日期 {}。请确认实际成本。",
            offer.data.quoted_on.unwrap_or_default()
        ),
        supplier_id: Some(offer.data.supplier_id),
        supplier_name: supplier.data.name,
        product_id: Some(line.product_id),
        offer_id: Some(offer_id),
        rate: None,
        rate_on: None,
        confirmed: false,
    })
}
