use super::*;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportFilter {
    pub from: String,
    pub through: String,
    pub customer_id: Option<i64>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportTotals {
    pub order_ids: Vec<i64>,
    pub revenue: String,
    pub purchase: String,
    pub freight: String,
    pub tax: String,
    pub other: String,
    pub total_cost: String,
    pub profit: String,
    pub margin: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyReport {
    pub currency: String,
    pub order_ids: Vec<i64>,
    pub revenue: String,
    pub incomplete_count: usize,
    pub missing_rate_count: usize,
    pub uncomputed_count: usize,
    pub confirmed: ReportTotals,
    pub estimated: ReportTotals,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderReport {
    pub from: String,
    pub through: String,
    pub included_count: usize,
    pub incomplete_count: usize,
    pub missing_rate_count: usize,
    pub currencies: Vec<CurrencyReport>,
    pub orders: Vec<Record<Order>>,
}

fn totals(orders: &[&Record<Order>], currency: &str) -> Result<ReportTotals, String> {
    let places = money::scale(currency)?;
    let mut sums = [0_i128; 5];
    for order in orders {
        let profit = &order.data.profit;
        let values = [
            &order.data.quote.total,
            profit.purchase.as_ref().ok_or("成本未完整。")?,
            profit.freight.as_ref().ok_or("成本未完整。")?,
            profit.tax.as_ref().ok_or("成本未完整。")?,
            profit.other.as_ref().ok_or("成本未完整。")?,
        ];
        for (index, value) in values.iter().enumerate() {
            sums[index] += i128::from(money::parse(value, places, "统计金额")?);
        }
    }
    let revenue = money::bounded(sums[0])?;
    let cost = money::bounded(sums[1..].iter().sum())?;
    let result = money::bounded(i128::from(revenue) - i128::from(cost))?;
    Ok(ReportTotals {
        order_ids: orders.iter().map(|order| order.id).collect(),
        revenue: money::format(revenue, places),
        purchase: money::format(money::bounded(sums[1])?, places),
        freight: money::format(money::bounded(sums[2])?, places),
        tax: money::format(money::bounded(sums[3])?, places),
        other: money::format(money::bounded(sums[4])?, places),
        total_cost: money::format(cost, places),
        profit: money::format(result, places),
        margin: money::margin(result, revenue)?,
    })
}

pub(super) fn report(
    orders: Vec<Record<Order>>,
    filter: ReportFilter,
) -> Result<OrderReport, String> {
    let from = date(filter.from, "开始日期")?;
    let through = date(filter.through, "结束日期")?;
    if from > through {
        return Err("开始日期不能晚于结束日期。".into());
    }
    let orders: Vec<_> = orders
        .into_iter()
        .filter(|order| {
            order.data.status == "confirmed"
                && order.data.ordered_on >= from
                && order.data.ordered_on <= through
                && filter
                    .customer_id
                    .is_none_or(|id| id == order.data.quote.fields.customer_id)
        })
        .collect();
    let mut groups: BTreeMap<String, Vec<&Record<Order>>> = BTreeMap::new();
    for order in &orders {
        groups
            .entry(order.data.quote.fields.currency.clone())
            .or_default()
            .push(order);
    }
    let mut currencies = Vec::new();
    for (currency, group) in groups {
        let places = money::scale(&currency)?;
        let revenue: i128 = group
            .iter()
            .map(|order| money::parse(&order.data.quote.total, places, "收入").map(i128::from))
            .collect::<Result<Vec<_>, _>>()?
            .iter()
            .sum();
        let confirmed: Vec<_> = group
            .iter()
            .copied()
            .filter(|order| order.data.profit.complete)
            .collect();
        let estimated: Vec<_> = group
            .iter()
            .copied()
            .filter(|order| !order.data.profit.complete && order.data.profit.profit.is_some())
            .collect();
        currencies.push(CurrencyReport {
            currency: currency.clone(),
            order_ids: group.iter().map(|order| order.id).collect(),
            revenue: money::format(money::bounded(revenue)?, places),
            incomplete_count: group
                .iter()
                .filter(|order| !order.data.costs_complete)
                .count(),
            missing_rate_count: group
                .iter()
                .filter(|order| order.data.profit.missing_rates > 0)
                .count(),
            uncomputed_count: group
                .iter()
                .filter(|order| order.data.profit.profit.is_none())
                .count(),
            confirmed: totals(&confirmed, &currency)?,
            estimated: totals(&estimated, &currency)?,
        });
    }
    Ok(OrderReport {
        from,
        through,
        included_count: orders.len(),
        incomplete_count: orders
            .iter()
            .filter(|order| !order.data.costs_complete)
            .count(),
        missing_rate_count: orders
            .iter()
            .filter(|order| order.data.profit.missing_rates > 0)
            .count(),
        currencies,
        orders,
    })
}

pub fn order_report(data_dir: PathBuf, filter: ReportFilter) -> Result<OrderReport, String> {
    report(load_orders(&open(data_dir)?)?, filter)
}
