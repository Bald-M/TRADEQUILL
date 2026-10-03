//! Decimal input and arithmetic shared by quotations, costs and reports.
//! Values cross IPC as strings; no monetary operation uses binary floating point.

pub const LIMIT: i64 = 9_000_000_000_000_000;

pub fn scale(currency: &str) -> Result<u32, String> {
    match currency {
        "JPY" => Ok(0),
        "USD" | "CNY" | "EUR" | "GBP" => Ok(2),
        _ => Err("请选择支持的币种。".into()),
    }
}

pub fn parse(value: &str, places: u32, label: &str) -> Result<i64, String> {
    let value = value.trim();
    let mut parts = value.split('.');
    let whole = parts.next().unwrap_or_default();
    let fraction = parts.next().unwrap_or_default();
    if whole.is_empty()
        || !whole.bytes().all(|c| c.is_ascii_digit())
        || !fraction.bytes().all(|c| c.is_ascii_digit())
        || fraction.len() > places as usize
        || parts.next().is_some()
        || value.len() > 24
    {
        return Err(format!("{label}必须是非负数字，最多 {places} 位小数。"));
    }
    let whole: i128 = whole.parse().map_err(|_| format!("{label}数值过大。"))?;
    let fraction: i128 = if fraction.is_empty() {
        0
    } else {
        fraction
            .parse()
            .map_err(|_| format!("{label}格式不正确。"))?
    };
    bounded(
        whole * 10_i128.pow(places)
            + fraction * 10_i128.pow(places - value.split('.').nth(1).unwrap_or("").len() as u32),
    )
    .map_err(|_| format!("{label}数值过大。"))
}

pub fn bounded(value: i128) -> Result<i64, String> {
    if value.abs() > i128::from(LIMIT) {
        Err("金额或数量超出支持范围，请减少数值。".into())
    } else {
        Ok(value as i64)
    }
}

pub fn format(value: i64, places: u32) -> String {
    format_wide(i128::from(value), places)
}

fn format_wide(value: i128, places: u32) -> String {
    let magnitude = value.abs();
    let sign = if value < 0 { "-" } else { "" };
    if places == 0 {
        return format!("{sign}{magnitude}");
    }
    let factor = 10_i128.pow(places);
    format!(
        "{sign}{}.{:0width$}",
        magnitude / factor,
        magnitude % factor,
        width = places as usize
    )
}

pub fn round_ratio(numerator: i128, denominator: i128) -> Result<i64, String> {
    let rounded = (numerator.abs() + denominator / 2) / denominator;
    bounded(if numerator < 0 { -rounded } else { rounded })
}

pub fn line_total(quantity: &str, price: &str, currency: &str) -> Result<i64, String> {
    let quantity = parse(quantity, 3, "数量")?;
    if quantity == 0 {
        return Err("数量必须大于零。".into());
    }
    let price = parse(price, 4, "单价")?;
    round_ratio(
        i128::from(quantity) * i128::from(price),
        10_i128.pow(7 - scale(currency)?),
    )
}

pub fn convert(amount: i64, from: &str, to: &str, rate: &str) -> Result<i64, String> {
    let rate = parse(rate, 6, "汇率")?;
    if rate == 0 || rate > 1_000_000_000_000 {
        return Err("汇率须大于零且不超过 1000000。".into());
    }
    round_ratio(
        i128::from(amount) * i128::from(rate) * 10_i128.pow(scale(to)?),
        10_i128.pow(6 + scale(from)?),
    )
}

pub fn margin(profit: i64, revenue: i64) -> Result<Option<String>, String> {
    if revenue == 0 {
        return Ok(None);
    }
    let magnitude =
        (i128::from(profit).abs() * 10_000 + i128::from(revenue) / 2) / i128::from(revenue);
    Ok(Some(format_wide(
        if profit < 0 { -magnitude } else { magnitude },
        2,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_decimal_rounding_currency_scales_and_limits() {
        assert_eq!(line_total("0.1", "0.2", "USD").unwrap(), 2);
        assert_eq!(line_total("1", "0.005", "USD").unwrap(), 1);
        assert_eq!(line_total("3", "0.5", "JPY").unwrap(), 2);
        assert_eq!(convert(100, "USD", "JPY", "150.125").unwrap(), 150);
        assert_eq!(convert(150, "JPY", "USD", "0.006667").unwrap(), 100);
        assert_eq!(margin(-100, 300).unwrap().as_deref(), Some("-33.33"));
        assert_eq!(margin(-100, 0).unwrap(), None);
        for bad in ["-1", "NaN", "1e3", "1.0001", "1..2", "", "9000000000000001"] {
            assert!(parse(bad, 3, "数量").is_err(), "{bad}");
        }
        assert!(line_total("9000000000000", "900000000000", "USD").is_err());
        assert!(parse("1.1", 0, "日元").is_err());
        assert!(convert(1, "USD", "CNY", "0").is_err());
    }
}
