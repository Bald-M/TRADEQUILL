use super::*;
use crate::storage::commerce::*;

fn seeded() -> TempData {
    let root = TempData::new();
    fs::create_dir_all(&root.0).unwrap();
    Connection::open(root.0.join("tradequill.sqlite3"))
        .unwrap()
        .execute_batch(include_str!("../fixtures/schema_v2.sql"))
        .unwrap();
    initialize(root.0.clone()).unwrap();
    root
}
fn product(code: &str) -> Product {
    Product {
        code: code.into(),
        name: "中文测试产品 / Widget".into(),
        parameters: vec![Parameter {
            name: "材质".into(),
            value: "不锈钢 / Stainless steel".into(),
        }],
        unit: "件 / pcs".into(),
        moq: Some("10".into()),
        lead_days_min: Some(5),
        lead_days_max: Some(10),
        notes: "INTERNAL PRODUCT NOTE".into(),
        archived: false,
    }
}
fn supplier(name: &str) -> Supplier {
    Supplier {
        name: name.into(),
        contact: "Seller".into(),
        email: "seller@example.com".into(),
        phone: String::new(),
        address: String::new(),
        notes: "INTERNAL SUPPLIER NOTE".into(),
        archived: false,
    }
}
fn quotation(product_id: i64, key: &str) -> StructuredQuoteInput {
    StructuredQuoteInput {
        request_key: key.into(),
        previous_quote_id: None,
        fields: QuoteFields {
            customer_id: 11,
            inquiry_id: Some(21),
            quoted_on: "2026-10-03".into(),
            valid_until: "2026-10-31".into(),
            seller: "示例贸易公司 / Example Trade\nsales@example.com".into(),
            terms: "FOB Shanghai. Payment: 30% deposit. 余款发货前付清。".into(),
            currency: "USD".into(),
            discount: "0".into(),
            tax: "0".into(),
            freight: "0".into(),
            lines: vec![QuoteLine {
                product_id,
                product: product("W-1"),
                quantity: "10".into(),
                unit_price: "10".into(),
            }],
        },
    }
}
fn setup_quote(root: &TempData, key: &str) -> i64 {
    let id = save_product(
        root.0.clone(),
        ProductInput {
            id: None,
            data: product(key),
        },
    )
    .unwrap();
    save_structured_quote(root.0.clone(), quotation(id, key)).unwrap()
}
fn order(root: &TempData, id: i64) -> Record<Order> {
    commerce_snapshot(root.0.clone())
        .unwrap()
        .orders
        .into_iter()
        .find(|o| o.id == id)
        .unwrap()
}
fn cost(category: &str, amount: &str, currency: &str) -> CostEntry {
    CostEntry {
        category: category.into(),
        amount: amount.into(),
        currency: currency.into(),
        occurred_on: "2026-10-03".into(),
        notes: String::new(),
        supplier_id: None,
        supplier_name: String::new(),
        product_id: None,
        offer_id: None,
        rate: None,
        rate_on: None,
        confirmed: true,
    }
}
fn save_costs(
    root: &TempData,
    id: i64,
    entries: Vec<CostEntry>,
    complete: bool,
) -> Result<(), String> {
    save_order_costs(
        root.0.clone(),
        CostsInput {
            order_id: id,
            expected_version: order(root, id).data.version,
            entries,
            complete,
            completeness_note: "已核对全部费用，未列类别明确为零。".into(),
            reason: "录入测试费用".into(),
        },
    )
}
fn confirm(root: &TempData, id: i64) {
    transition_order(
        root.0.clone(),
        OrderTransition {
            id,
            expected_version: order(root, id).data.version,
            status: "confirmed".into(),
            reason: "客户确认".into(),
        },
    )
    .unwrap();
}
fn report_for(root: &TempData, from: &str, through: &str) -> OrderReport {
    order_report(
        root.0.clone(),
        ReportFilter {
            from: from.into(),
            through: through.into(),
            customer_id: None,
        },
    )
    .unwrap()
}

#[test]
fn catalog_validates_duplicates_archives_and_preserves_independent_suppliers() {
    let root = seeded();
    let p = save_product(
        root.0.clone(),
        ProductInput {
            id: None,
            data: product("W-1"),
        },
    )
    .unwrap();
    assert!(save_product(
        root.0.clone(),
        ProductInput {
            id: None,
            data: product("w-1")
        }
    )
    .unwrap_err()
    .contains("已存在"));
    let mut invalid = product("invalid");
    invalid.moq = Some("-1".into());
    assert!(save_product(
        root.0.clone(),
        ProductInput {
            id: None,
            data: invalid
        }
    )
    .is_err());
    let s = save_supplier(
        root.0.clone(),
        SupplierInput {
            id: None,
            data: supplier("Supplier"),
        },
    )
    .unwrap();
    assert!(save_supplier(
        root.0.clone(),
        SupplierInput {
            id: None,
            data: supplier("SUPPLIER")
        }
    )
    .is_err());
    let s2 = save_supplier(
        root.0.clone(),
        SupplierInput {
            id: None,
            data: supplier("Supplier 2"),
        },
    )
    .unwrap();
    let offer = Offer {
        product_id: p,
        supplier_id: s,
        supplier_code: "REF".into(),
        price: Some("35.0001".into()),
        currency: "CNY".into(),
        quoted_on: Some("2026-10-03".into()),
        moq: None,
        lead_days_min: None,
        lead_days_max: None,
        notes: String::new(),
        active: true,
    };
    let o = save_offer(
        root.0.clone(),
        OfferInput {
            id: None,
            data: offer.clone(),
        },
    )
    .unwrap();
    assert!(save_offer(
        root.0.clone(),
        OfferInput {
            id: None,
            data: offer.clone()
        }
    )
    .is_err());
    let mut second = offer.clone();
    second.supplier_id = s2;
    second.price = None;
    save_offer(
        root.0.clone(),
        OfferInput {
            id: None,
            data: second,
        },
    )
    .unwrap();
    let snapshot = commerce_snapshot(root.0.clone()).unwrap();
    assert_eq!(snapshot.offers.len(), 2);
    assert_eq!(snapshot.products[0].data.moq.as_deref(), Some("10.000"));
    let mut broken = offer.clone();
    broken.product_id = 9999;
    assert!(save_offer(
        root.0.clone(),
        OfferInput {
            id: None,
            data: broken
        }
    )
    .is_err());
    let mut archived = product("W-1");
    archived.archived = true;
    save_product(
        root.0.clone(),
        ProductInput {
            id: Some(p),
            data: archived,
        },
    )
    .unwrap();
    assert!(save_structured_quote(root.0.clone(), quotation(p, "archived-new")).is_err());
    let mut unlink = offer;
    unlink.active = false;
    save_offer(
        root.0.clone(),
        OfferInput {
            id: Some(o),
            data: unlink,
        },
    )
    .unwrap();
    assert_eq!(commerce_snapshot(root.0.clone()).unwrap().offers.len(), 2);
}

#[test]
fn quote_revisions_keep_snapshots_and_legacy_records_without_fabrication() {
    let root = seeded();
    let p = save_product(
        root.0.clone(),
        ProductInput {
            id: None,
            data: product("W-1"),
        },
    )
    .unwrap();
    let mut input = quotation(p, "first");
    input.previous_quote_id = Some(31);
    input.fields.lines[0].quantity = "0.001".into();
    input.fields.lines[0].unit_price = "5".into();
    let id = save_structured_quote(root.0.clone(), input).unwrap();
    let original = get_quote_document(root.0.clone(), id).unwrap();
    assert_eq!(original.total, "0.01");
    assert_eq!(original.below_moq, [0]);
    assert_eq!(original.previous_quote_id, Some(31));
    assert!(save_quote(
        root.0.clone(),
        QuoteInput {
            id: Some(id),
            customer_id: 11,
            inquiry_id: None,
            quoted_on: "2026-10-03".into(),
            content: "overwrite".into(),
            amount: "0".into(),
            currency: "USD".into(),
            notes: String::new()
        }
    )
    .is_err());
    let mut changed = product("W-1");
    changed.name = "Changed product".into();
    changed.archived = true;
    save_product(
        root.0.clone(),
        ProductInput {
            id: Some(p),
            data: changed,
        },
    )
    .unwrap();
    let mut changed_customer = customer("New buyer");
    changed_customer.id = Some(11);
    save_customer(root.0.clone(), changed_customer).unwrap();
    let after = get_quote_document(root.0.clone(), id).unwrap();
    assert_eq!(
        after.fields.lines[0].product.name,
        original.fields.lines[0].product.name
    );
    assert_eq!(after.customer.name, "Legacy Buyer");
    let next = save_structured_quote(
        root.0.clone(),
        StructuredQuoteInput {
            request_key: "revision".into(),
            previous_quote_id: Some(id),
            fields: original.fields.clone(),
        },
    )
    .unwrap();
    assert_eq!(
        get_quote_document(root.0.clone(), next).unwrap().revision,
        2
    );
    assert!(save_structured_quote(
        root.0.clone(),
        StructuredQuoteInput {
            request_key: "stale-revision".into(),
            previous_quote_id: Some(id),
            fields: original.fields
        }
    )
    .is_err());
    let snapshot = business_snapshot(root.0.clone()).unwrap();
    let legacy = snapshot.quotes.iter().find(|q| q.id == 31).unwrap();
    assert_eq!(legacy.amount, "1234.56");
    assert_eq!(legacy.content, "只有文本的旧报价，不推断数量");
    assert!(create_order(root.0.clone(), 31, "2026-10-03".into())
        .unwrap_err()
        .contains("没有结构化明细"));
}

#[test]
fn failed_quote_leaves_no_partial_series_or_rows_and_retry_is_idempotent() {
    let root = seeded();
    let p = save_product(
        root.0.clone(),
        ProductInput {
            id: None,
            data: product("W-1"),
        },
    )
    .unwrap();
    let mut input = quotation(p, "retry-key");
    input.fields.discount = "101".into();
    assert!(save_structured_quote(root.0.clone(), input).is_err());
    let connection = open(root.0.clone()).unwrap();
    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM quote_series", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
    drop(connection);
    let first = save_structured_quote(root.0.clone(), quotation(p, "retry-key")).unwrap();
    let second = save_structured_quote(root.0.clone(), quotation(p, "retry-key")).unwrap();
    assert_eq!(first, second);
    assert_eq!(commerce_snapshot(root.0.clone()).unwrap().quotes.len(), 1);
}

#[test]
fn concurrent_conversion_and_order_transitions_preserve_history_and_frozen_sales() {
    let root = seeded();
    let q = setup_quote(&root, "conversion");
    let handles: Vec<_> = (0..2)
        .map(|_| {
            let path = root.0.clone();
            std::thread::spawn(move || create_order(path, q, "2026-10-03".into()).unwrap())
        })
        .collect();
    let ids: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    assert_eq!(ids[0], ids[1]);
    let id = ids[0];
    let original = get_quote_document(root.0.clone(), q).unwrap();
    let mut revised = original.fields.clone();
    revised.lines[0].unit_price = "20".into();
    let next = save_structured_quote(
        root.0.clone(),
        StructuredQuoteInput {
            request_key: "next".into(),
            previous_quote_id: Some(q),
            fields: revised,
        },
    )
    .unwrap();
    assert_eq!(order(&root, id).data.quote.total, "100.00");
    assert!(create_order(root.0.clone(), next, "2026-10-03".into()).is_err());
    update_order(
        root.0.clone(),
        OrderUpdate {
            id,
            expected_version: 1,
            ordered_on: "2026-10-03".into(),
            delivery_on: Some("2026-10-15".into()),
            notes: "amended".into(),
            source_quote_id: next,
            reason: "客户增加预算".into(),
        },
    )
    .unwrap();
    assert_eq!(order(&root, id).data.quote.total, "200.00");
    assert_eq!(
        create_order(root.0.clone(), q, "2026-10-03".into()).unwrap(),
        id
    );
    assert!(update_order(
        root.0.clone(),
        OrderUpdate {
            id,
            expected_version: 1,
            ordered_on: "2026-10-03".into(),
            delivery_on: None,
            notes: String::new(),
            source_quote_id: next,
            reason: "stale".into()
        }
    )
    .is_err());
    confirm(&root, id);
    assert!(update_order(
        root.0.clone(),
        OrderUpdate {
            id,
            expected_version: 3,
            ordered_on: "2026-10-03".into(),
            delivery_on: None,
            notes: String::new(),
            source_quote_id: next,
            reason: "frozen".into()
        }
    )
    .is_err());
    transition_order(
        root.0.clone(),
        OrderTransition {
            id,
            expected_version: 3,
            status: "cancelled".into(),
            reason: "客户取消".into(),
        },
    )
    .unwrap();
    assert!(save_costs(&root, id, vec![], true).is_err());
    let events = order_history(root.0.clone(), id).unwrap();
    assert_eq!(events.len(), 4);
    assert_eq!(events.last().unwrap().snapshot.quote.total, "100.00");
    assert_eq!(
        report_for(&root, "2026-10-01", "2026-10-31").included_count,
        0
    );
    let latest = get_quote_document(root.0.clone(), next).unwrap();
    let reopen = save_structured_quote(
        root.0.clone(),
        StructuredQuoteInput {
            request_key: "reopen".into(),
            previous_quote_id: Some(next),
            fields: latest.fields,
        },
    )
    .unwrap();
    assert_ne!(
        create_order(root.0.clone(), reopen, "2026-10-04".into()).unwrap(),
        id
    );
}

#[test]
fn reference_cost_is_unconfirmed_and_does_not_follow_supplier_updates() {
    let root = seeded();
    let q = setup_quote(&root, "cost-reference");
    let quote = get_quote_document(root.0.clone(), q).unwrap();
    let p = quote.fields.lines[0].product_id;
    let s = save_supplier(
        root.0.clone(),
        SupplierInput {
            id: None,
            data: supplier("Reference supplier"),
        },
    )
    .unwrap();
    let mut offer = Offer {
        product_id: p,
        supplier_id: s,
        supplier_code: "R1".into(),
        price: Some("35".into()),
        currency: "CNY".into(),
        quoted_on: Some("2026-10-03".into()),
        moq: None,
        lead_days_min: None,
        lead_days_max: None,
        notes: String::new(),
        active: true,
    };
    let offer_id = save_offer(
        root.0.clone(),
        OfferInput {
            id: None,
            data: offer.clone(),
        },
    )
    .unwrap();
    let id = create_order(root.0.clone(), q, "2026-10-03".into()).unwrap();
    confirm(&root, id);
    let mut entry =
        draft_cost_from_offer(root.0.clone(), id, 0, offer_id, "2026-10-03".into()).unwrap();
    assert!(!entry.confirmed);
    assert_eq!(entry.amount, "350.00");
    assert!(save_costs(&root, id, vec![entry.clone()], true).is_err());
    entry.confirmed = true;
    entry.rate = Some("0.142857".into());
    entry.rate_on = Some("2026-10-03".into());
    save_costs(&root, id, vec![entry, cost("freight", "10", "USD")], true).unwrap();
    offer.price = Some("999".into());
    offer.active = false;
    save_offer(
        root.0.clone(),
        OfferInput {
            id: Some(offer_id),
            data: offer,
        },
    )
    .unwrap();
    let stored = order(&root, id);
    assert_eq!(stored.data.costs[0].amount, "350.00");
    assert_eq!(stored.data.profit.total_cost.as_deref(), Some("60.00"));
    assert_eq!(stored.data.profit.profit.as_deref(), Some("40.00"));
    assert_eq!(stored.data.profit.margin.as_deref(), Some("40.00"));
    let report = report_for(&root, "2026-10-03", "2026-10-03");
    assert_eq!(report.currencies[0].confirmed.profit, "40.00");
    assert_eq!(report.currencies[0].confirmed.order_ids, [id]);
}

#[test]
fn reports_separate_currencies_estimates_missing_rates_zero_revenue_and_cancelled() {
    let root = seeded();
    let q = setup_quote(&root, "unknown");
    let unknown = create_order(root.0.clone(), q, "2026-10-01".into()).unwrap();
    confirm(&root, unknown);
    assert!(order(&root, unknown).data.profit.profit.is_none());
    let q = setup_quote(&root, "loss");
    let loss = create_order(root.0.clone(), q, "2026-10-31".into()).unwrap();
    confirm(&root, loss);
    save_costs(&root, loss, vec![cost("purchase", "200", "USD")], false).unwrap();
    let q = setup_quote(&root, "missing-rate");
    let missing = create_order(root.0.clone(), q, "2026-10-15".into()).unwrap();
    confirm(&root, missing);
    save_costs(&root, missing, vec![cost("purchase", "50", "CNY")], true).unwrap();
    let p = save_product(
        root.0.clone(),
        ProductInput {
            id: None,
            data: product("JPY"),
        },
    )
    .unwrap();
    let mut input = quotation(p, "jpy");
    input.fields.currency = "JPY".into();
    input.fields.lines[0].unit_price = "0".into();
    let q = save_structured_quote(root.0.clone(), input).unwrap();
    let jpy = create_order(root.0.clone(), q, "2026-10-15".into()).unwrap();
    confirm(&root, jpy);
    save_costs(&root, jpy, vec![cost("other", "10", "JPY")], true).unwrap();
    let report = report_for(&root, "2026-10-01", "2026-10-31");
    assert_eq!(report.included_count, 4);
    assert_eq!(report.incomplete_count, 2);
    assert_eq!(report.missing_rate_count, 1);
    assert_eq!(report.currencies.len(), 2);
    let usd = report
        .currencies
        .iter()
        .find(|group| group.currency == "USD")
        .unwrap();
    assert_eq!(usd.revenue, "300.00");
    assert_eq!(usd.estimated.profit, "-100.00");
    assert_eq!(usd.uncomputed_count, 2);
    assert_eq!(usd.confirmed.order_ids.len(), 0);
    let yen = report
        .currencies
        .iter()
        .find(|group| group.currency == "JPY")
        .unwrap();
    assert_eq!(yen.confirmed.profit, "-10");
    assert!(yen.confirmed.margin.is_none());
    save_costs(&root, unknown, vec![], true).unwrap();
    assert!(order(&root, unknown).data.profit.complete);
    assert_eq!(
        order(&root, unknown).data.profit.profit.as_deref(),
        Some("100.00")
    );
    assert_eq!(
        report_for(&root, "2026-11-01", "2026-11-30").included_count,
        0
    );
    assert_eq!(
        report_for(&root, "2026-10-02", "2026-10-30").included_count,
        2
    );
    assert!(order_report(
        root.0.clone(),
        ReportFilter {
            from: "2026-10-31".into(),
            through: "2026-10-01".into(),
            customer_id: None
        }
    )
    .is_err());
    assert_eq!(
        order_report(
            root.0.clone(),
            ReportFilter {
                from: "2026-10-01".into(),
                through: "2026-10-31".into(),
                customer_id: Some(999)
            }
        )
        .unwrap()
        .included_count,
        0
    );
}

#[test]
fn schema_three_migration_is_atomic_and_preserves_schema_two_on_failure() {
    let root = TempData::new();
    fs::create_dir_all(&root.0).unwrap();
    let connection = Connection::open(root.0.join("tradequill.sqlite3")).unwrap();
    connection
        .execute_batch(include_str!("../fixtures/schema_v2.sql"))
        .unwrap();
    connection
        .execute_batch(
            "CREATE TABLE quote_versions(marker TEXT); INSERT INTO quote_versions VALUES ('keep');",
        )
        .unwrap();
    drop(connection);
    assert!(initialize(root.0.clone()).is_err());
    let connection = Connection::open(root.0.join("tradequill.sqlite3")).unwrap();
    let version: i64 = connection
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .unwrap();
    assert_eq!(version, 2);
    let count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE name='products'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
    let quote: String = connection
        .query_row("SELECT content FROM quote_records WHERE id=31", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(quote, "只有文本的旧报价，不推断数量");
    connection
        .execute_batch("DROP TABLE quote_versions")
        .unwrap();
    drop(connection);
    assert_eq!(initialize(root.0.clone()).unwrap().schema_version, 3);
}

#[test]
fn quotation_pdf_uses_saved_amounts_and_handles_multipage_and_export_failures() {
    let root = seeded();
    let id = setup_quote(&root, "PDF-01");
    let mut document = get_quote_document(root.0.clone(), id).unwrap();
    let bytes = crate::quote_pdf::render(&document).unwrap();
    assert!(bytes.starts_with(b"%PDF-"));
    let target = root.0.join("quote.pdf");
    crate::quote_pdf::save(&target, &bytes).unwrap();
    assert_eq!(fs::read(&target).unwrap(), bytes);
    let invalid = root.0.join("keep.sqlite3");
    fs::write(&invalid, b"preserve").unwrap();
    assert!(crate::quote_pdf::save(&invalid, &bytes).is_err());
    assert_eq!(fs::read(&invalid).unwrap(), b"preserve");
    assert!(crate::quote_pdf::save(&root.0.join("missing/quote.pdf"), &bytes).is_err());
    let short = bytes;
    let line = document.fields.lines[0].clone();
    document.fields.lines = vec![line; 15];
    document.line_amounts = vec!["100.00".into(); 15];
    document.subtotal = "1500.00".into();
    document.total = "1500.00".into();
    document.fields.lines[0].product.parameters[0].value =
        "中文长规格 / repeated technical specification. ".repeat(20);
    let long = crate::quote_pdf::render(&document).unwrap();
    assert!(
        String::from_utf8_lossy(&long)
            .matches("/Type /Page\n")
            .count()
            > 1
    );
    if let Ok(directory) = std::env::var("TRADEQUILL_PDF_TEST_OUTPUT") {
        let directory = PathBuf::from(directory);
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("quote.pdf"), short).unwrap();
        fs::write(directory.join("quote-long.pdf"), long).unwrap();
    }
    document.fields.terms.push('\u{10ffff}');
    assert!(crate::quote_pdf::render(&document)
        .unwrap_err()
        .contains("不支持"));
}
