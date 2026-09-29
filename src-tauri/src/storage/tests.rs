use super::*;
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct TempData(PathBuf);

impl TempData {
    fn new() -> Self {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        Self(std::env::temp_dir().join(format!(
            "tradequill-{}-{unique}-{sequence}",
            std::process::id()
        )))
    }
}

impl Drop for TempData {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn customer(name: &str) -> CustomerInput {
    CustomerInput {
        id: None,
        name: name.into(),
        company: "Example Ltd".into(),
        email: "buyer@example.com".into(),
        phone: "+1 555 0100".into(),
        country: "美国".into(),
        source: "展会".into(),
        notes: String::new(),
    }
}

fn first_customer_id(root: &TempData) -> i64 {
    business_snapshot(root.0.clone())
        .expect("snapshot")
        .customers[0]
        .id
}

#[test]
fn migrates_and_persists_complete_customer_workflow() {
    let root = TempData::new();
    assert_eq!(
        initialize(root.0.clone())
            .expect("initialize")
            .schema_version,
        2
    );
    save_customer(root.0.clone(), customer("Alice")).expect("customer");
    let customer_id = first_customer_id(&root);
    save_inquiry(
        root.0.clone(),
        InquiryInput {
            id: None,
            customer_id,
            received_on: "2026-09-20".into(),
            content: "Need two product options".into(),
            source: "展会".into(),
            country: "美国".into(),
            products: vec!["Widget A".into(), "Widget B".into()],
            stage: "new".into(),
        },
    )
    .expect("inquiry");
    let inquiry_id = business_snapshot(root.0.clone())
        .expect("snapshot")
        .inquiries[0]
        .id;
    save_quote(
        root.0.clone(),
        QuoteInput {
            id: None,
            customer_id,
            inquiry_id: Some(inquiry_id),
            quoted_on: "2026-09-21".into(),
            content: "Widget A, 100 units".into(),
            amount: "1200.50".into(),
            currency: "USD".into(),
            notes: String::new(),
        },
    )
    .expect("quote");
    save_sample(
        root.0.clone(),
        SampleInput {
            id: None,
            customer_id,
            inquiry_id: Some(inquiry_id),
            product: "Widget A".into(),
            quantity: 2,
            requested_on: "2026-09-22".into(),
            notes: String::new(),
        },
    )
    .expect("sample");
    let sample_id = business_snapshot(root.0.clone()).expect("snapshot").samples[0].id;
    append_sample_progress(
        root.0.clone(),
        SampleProgressInput {
            sample_id,
            stage: "preparing".into(),
            occurred_on: "2026-09-23".into(),
            notes: "包装中".into(),
        },
    )
    .expect("progress");
    append_sample_progress(
        root.0.clone(),
        SampleProgressInput {
            sample_id,
            stage: "sent".into(),
            occurred_on: "2026-09-24".into(),
            notes: String::new(),
        },
    )
    .expect("sent progress");
    update_sample_shipment(
        root.0.clone(),
        SampleShipmentInput {
            sample_id,
            carrier: "DHL".into(),
            tracking_number: "TEST123".into(),
        },
    )
    .expect("shipment");
    save_follow_up_task(
        root.0.clone(),
        FollowUpTaskInput {
            id: None,
            customer_id,
            inquiry_id: Some(inquiry_id),
            due_at: "2026-09-27T10:30".into(),
            content: "确认样品签收".into(),
        },
    )
    .expect("task");

    let snapshot = business_snapshot(root.0.clone()).expect("snapshot");
    assert_eq!(snapshot.customers.len(), 1);
    assert_eq!(snapshot.inquiries[0].products.len(), 2);
    assert_eq!(snapshot.quotes[0].amount, "1200.50");
    assert_eq!(snapshot.samples[0].current_stage, "sent");
    assert_eq!(snapshot.samples[0].progress.len(), 3);
    assert_eq!(snapshot.samples[0].tracking_number, "TEST123");
    assert_eq!(snapshot.tasks.len(), 1);
    assert_eq!(
        initialize(root.0.clone())
            .expect("reinitialize")
            .schema_version,
        2
    );
    assert_eq!(
        business_snapshot(root.0.clone())
            .expect("reopen")
            .customers
            .len(),
        1
    );
}

#[test]
fn rejects_cross_customer_relations_without_partial_writes() {
    let root = TempData::new();
    save_customer(root.0.clone(), customer("Alice")).expect("Alice");
    save_customer(root.0.clone(), customer("Bob")).expect("Bob");
    let snapshot = business_snapshot(root.0.clone()).expect("snapshot");
    let alice = snapshot
        .customers
        .iter()
        .find(|item| item.name == "Alice")
        .expect("Alice id")
        .id;
    let bob = snapshot
        .customers
        .iter()
        .find(|item| item.name == "Bob")
        .expect("Bob id")
        .id;
    save_inquiry(
        root.0.clone(),
        InquiryInput {
            id: None,
            customer_id: alice,
            received_on: "2026-09-20".into(),
            content: "Inquiry".into(),
            source: "网站".into(),
            country: "美国".into(),
            products: vec!["Widget".into()],
            stage: "new".into(),
        },
    )
    .expect("inquiry");
    let inquiry_id = business_snapshot(root.0.clone())
        .expect("snapshot")
        .inquiries[0]
        .id;
    let error = save_quote(
        root.0.clone(),
        QuoteInput {
            id: None,
            customer_id: bob,
            inquiry_id: Some(inquiry_id),
            quoted_on: "2026-09-21".into(),
            content: "Invalid relation".into(),
            amount: "1.00".into(),
            currency: "USD".into(),
            notes: String::new(),
        },
    )
    .expect_err("cross-customer relation must fail");
    assert!(error.contains("只能关联"));
    assert!(business_snapshot(root.0.clone())
        .expect("snapshot")
        .quotes
        .is_empty());
}

#[test]
fn rejects_invalid_sample_transition_without_losing_history() {
    let root = TempData::new();
    save_customer(root.0.clone(), customer("Alice")).expect("customer");
    let customer_id = first_customer_id(&root);
    save_sample(
        root.0.clone(),
        SampleInput {
            id: None,
            customer_id,
            inquiry_id: None,
            product: "Widget".into(),
            quantity: 1,
            requested_on: "2026-09-20".into(),
            notes: String::new(),
        },
    )
    .expect("sample");
    let sample_id = business_snapshot(root.0.clone()).expect("snapshot").samples[0].id;
    let error = append_sample_progress(
        root.0.clone(),
        SampleProgressInput {
            sample_id,
            stage: "completed".into(),
            occurred_on: "2026-09-21".into(),
            notes: String::new(),
        },
    )
    .expect_err("invalid transition must fail");
    assert!(error.contains("不能从"));
    let snapshot = business_snapshot(root.0.clone()).expect("snapshot");
    assert_eq!(snapshot.samples[0].current_stage, "requested");
    assert_eq!(snapshot.samples[0].progress.len(), 1);
}

#[test]
fn keeps_sample_progress_dates_chronological() {
    let root = TempData::new();
    save_customer(root.0.clone(), customer("Alice")).expect("customer");
    let customer_id = first_customer_id(&root);
    save_sample(
        root.0.clone(),
        SampleInput {
            id: None,
            customer_id,
            inquiry_id: None,
            product: "Widget".into(),
            quantity: 1,
            requested_on: "2026-09-20".into(),
            notes: String::new(),
        },
    )
    .expect("sample");
    let sample_id = business_snapshot(root.0.clone()).expect("snapshot").samples[0].id;
    append_sample_progress(
        root.0.clone(),
        SampleProgressInput {
            sample_id,
            stage: "preparing".into(),
            occurred_on: "2026-09-22".into(),
            notes: String::new(),
        },
    )
    .expect("progress");

    let error = append_sample_progress(
        root.0.clone(),
        SampleProgressInput {
            sample_id,
            stage: "sent".into(),
            occurred_on: "2026-09-21".into(),
            notes: String::new(),
        },
    )
    .expect_err("progress cannot move backward in time");
    assert!(error.contains("不能早于"));

    let error = save_sample(
        root.0.clone(),
        SampleInput {
            id: Some(sample_id),
            customer_id,
            inquiry_id: None,
            product: "Widget".into(),
            quantity: 1,
            requested_on: "2026-09-23".into(),
            notes: String::new(),
        },
    )
    .expect_err("request date is immutable after progress begins");
    assert!(error.contains("不能更改申请日期"));

    let snapshot = business_snapshot(root.0.clone()).expect("snapshot");
    assert_eq!(snapshot.samples[0].requested_on, "2026-09-20");
    assert_eq!(snapshot.samples[0].current_stage, "preparing");
    assert_eq!(snapshot.samples[0].progress.len(), 2);
}

#[test]
fn daily_reminder_is_deduplicated() {
    let root = TempData::new();
    save_customer(root.0.clone(), customer("Alice")).expect("customer");
    let customer_id = first_customer_id(&root);
    save_follow_up_task(
        root.0.clone(),
        FollowUpTaskInput {
            id: None,
            customer_id,
            inquiry_id: None,
            due_at: "2026-09-27T08:00".into(),
            content: "Follow up".into(),
        },
    )
    .expect("task");
    assert!(due_reminder(
        root.0.clone(),
        "2026-09-27".into(),
        "2026-09-27T08:59".into()
    )
    .expect("before reminder")
    .is_none());
    let reminder = due_reminder(
        root.0.clone(),
        "2026-09-27".into(),
        "2026-09-27T09:00".into(),
    )
    .expect("reminder")
    .expect("summary");
    assert_eq!(reminder.due_today, 1);
    mark_reminder_sent(root.0.clone(), "2026-09-27".into()).expect("mark sent");
    assert!(due_reminder(
        root.0.clone(),
        "2026-09-27".into(),
        "2026-09-27T10:00".into()
    )
    .expect("deduplicated")
    .is_none());
}

#[test]
fn refuses_to_open_newer_schema() {
    let root = TempData::new();
    fs::create_dir_all(&root.0).expect("temp data dir");
    let connection = Connection::open(root.0.join("tradequill.sqlite3")).expect("database");
    connection
        .pragma_update(None, "user_version", 999)
        .expect("set version");
    drop(connection);
    let error = initialize(root.0.clone())
        .err()
        .expect("newer schema must fail");
    assert!(error.contains("更新版本"));
}
