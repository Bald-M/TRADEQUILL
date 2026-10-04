use super::*;
use std::{
    fs,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);
struct TempData(PathBuf);
impl TempData {
    fn new() -> Self {
        Self(std::env::temp_dir().join(format!(
                "tradequill-catalog-{}-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                SEQUENCE.fetch_add(1, Ordering::Relaxed)
            )))
    }
}
impl Drop for TempData {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn product(sku: &str) -> ProductInput {
    ProductInput {
        id: None,
        sku: sku.into(),
        name: "Synthetic product".into(),
        unit: "piece".into(),
        parameters: vec![ProductParameter {
            name: "material".into(),
            value: "steel".into(),
        }],
        moq: Some("0010.500".into()),
        lead_time_days: Some(14),
        lead_time_max_days: Some(14),
        lead_time_note: "after order confirmation".into(),
    }
}
fn document(product_id: Option<i64>, text: &str) -> KnowledgeInput {
    KnowledgeInput {
        id: None,
        expected_version: None,
        title: "Synthetic public specification".into(),
        product_id,
        tags: vec!["specification".into()],
        source: "Synthetic test case".into(),
        kind: "text".into(),
        conflict_note: String::new(),
        status: "confirmed".into(),
        visibility: "public".into(),
        text: text.into(),
        preview_token: None,
    }
}
fn search(query: &str, ids: Vec<i64>) -> KnowledgeSearchInput {
    KnowledgeSearchInput {
        query: query.into(),
        all_products: false,
        product_ids: ids,
        document_ids: vec![],
        tags: vec![],
        confirmed_only: true,
        public_only: true,
        include_general: false,
    }
}

#[test]
fn search_snippets_locate_body_matches_when_other_terms_match_metadata() {
    for prefix in ["前", "İ"] {
        let root = TempData::new();
        let text = format!("{}Steel 本地资料{}", prefix.repeat(1000), "后".repeat(1000));
        let mut input = document(None, &text);
        input.tags = vec!["sample-tag".into()];
        let saved = save_knowledge(root.0.clone(), input).unwrap();
        let mut query = search("specification sample-tag STEEL", vec![]);
        query.include_general = true;
        let results = search_knowledge(root.0.clone(), query).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].document_id, saved.id);
        assert!(results[0].text.contains("Steel 本地资料"));
        assert!(results[0].text.starts_with('…'));
        assert!(results[0].text.ends_with('…'));
        assert!(results[0].text.chars().count() <= 602);
    }
}

#[test]
fn products_preserve_authority_and_validate_decimal_units_and_archive() {
    let root = TempData::new();
    let record = save_product(root.0.clone(), product("SKU-A")).unwrap();
    assert_eq!(record.moq.as_deref(), Some("10.5"));
    assert!(save_product(root.0.clone(), product("sku-a"))
        .unwrap_err()
        .contains("已存在"));
    for quantity in ["0", "-1", "1e3", "1.0001", "9999999999", "NaN", ".5"] {
        let mut input = product("invalid");
        input.moq = Some(quantity.into());
        assert!(save_product(root.0.clone(), input).is_err(), "{quantity}");
    }
    let mut input = product("invalid");
    input.lead_time_note.clear();
    assert!(save_product(root.0.clone(), input).is_err());
    let mut unknown = product("SKU-B");
    unknown.moq = None;
    unknown.lead_time_days = None;
    unknown.lead_time_max_days = None;
    unknown.lead_time_note.clear();
    let unknown = save_product(root.0.clone(), unknown).unwrap();
    assert_eq!(unknown.moq, None);
    assert_eq!(unknown.lead_time_days, None);
    set_product_archived(root.0.clone(), record.id, true).unwrap();
    let snapshot = list_catalog(root.0.clone()).unwrap();
    assert_eq!(snapshot.products.len(), 2);
    assert!(
        snapshot
            .products
            .iter()
            .find(|p| p.id == record.id)
            .unwrap()
            .archived
    );
    assert_eq!(
        snapshot
            .products
            .iter()
            .find(|p| p.id == record.id)
            .unwrap()
            .parameters[0]
            .value,
        "steel"
    );
}

#[test]
fn missing_record_updates_never_create_or_partially_write_records() {
    let root = TempData::new();
    for id in [-1, 0, 999] {
        let mut input = product("missing");
        input.id = Some(id);
        assert!(save_product(root.0.clone(), input)
            .unwrap_err()
            .contains("不存在"));
        let mut input = document(None, "missing record");
        input.id = Some(id);
        input.expected_version = Some(1);
        assert!(save_knowledge(root.0.clone(), input)
            .unwrap_err()
            .contains("不存在"));
    }
    let snapshot = list_catalog(root.0.clone()).unwrap();
    assert!(snapshot.products.is_empty());
    assert!(snapshot.documents.is_empty());
}

#[test]
fn knowledge_scope_confirmation_tags_and_versions_are_enforced() {
    let root = TempData::new();
    let a = save_product(root.0.clone(), product("A")).unwrap();
    let b = save_product(root.0.clone(), product("B")).unwrap();
    let first = save_knowledge(
        root.0.clone(),
        document(Some(a.id), "steel capacity is 10 litres"),
    )
    .unwrap();
    save_knowledge(
        root.0.clone(),
        document(Some(b.id), "steel capacity is 99 litres"),
    )
    .unwrap();
    save_knowledge(
        root.0.clone(),
        document(None, "general capacity is 55 litres"),
    )
    .unwrap();
    let mut private = document(Some(a.id), "steel internal cost is 500 USD");
    private.visibility = "internal".into();
    save_knowledge(root.0.clone(), private).unwrap();
    let mut draft = document(Some(a.id), "steel capacity is unconfirmed");
    draft.status = "draft".into();
    save_knowledge(root.0.clone(), draft).unwrap();
    let found = search_knowledge(root.0.clone(), search("steel", vec![a.id])).unwrap();
    assert_eq!(found.len(), 1);
    assert!(found[0].text.contains("10 litres"));
    let mut tag_search = search("steel", vec![a.id]);
    tag_search.tags.push("missing-tag".into());
    assert!(search_knowledge(root.0.clone(), tag_search)
        .unwrap()
        .is_empty());
    let mut update = document(Some(a.id), "steel capacity is 12 litres");
    update.id = Some(first.id);
    update.expected_version = Some(1);
    update.conflict_note = "Old PDF says 10 litres; owner must verify".into();
    let updated = save_knowledge(root.0.clone(), update).unwrap();
    assert_eq!(updated.version, 2);
    let mut stale = document(Some(a.id), "steel capacity is 500 litres");
    stale.id = Some(first.id);
    stale.expected_version = Some(1);
    assert!(save_knowledge(root.0.clone(), stale)
        .unwrap_err()
        .contains("已被更新"));
    assert_eq!(
        check_knowledge_reference(root.0.clone(), first.id, 1).unwrap(),
        "old_version"
    );
    let found = search_knowledge(root.0.clone(), search("steel", vec![a.id])).unwrap();
    assert_eq!(found.len(), 1);
    assert!(found[0].text.contains("12 litres"));
    assert!(found[0].conflict_note.contains("verify"));
    let detail = get_knowledge_document(root.0.clone(), first.id).unwrap();
    assert_eq!(detail.history.len(), 2);
    assert_eq!(detail.pages[0].text, "steel capacity is 12 litres");
    set_product_archived(root.0.clone(), a.id, true).unwrap();
    assert!(
        search_knowledge(root.0.clone(), search("steel", vec![a.id])).unwrap()[0].product_archived
    );
}

#[test]
fn confirmed_import_dedup_replacement_and_deletion_are_atomic() {
    let root = TempData::new();
    let preview = preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "spec.txt".into(),
            bytes: b"Synthetic alpha specification".to_vec(),
        },
    )
    .unwrap();
    assert_eq!(preview.pages[0].page, 1);
    assert!(list_catalog(root.0.clone()).unwrap().documents.is_empty());
    let mut input = document(None, "");
    input.kind = "file".into();
    input.preview_token = Some(preview.token);
    let saved = save_knowledge(root.0.clone(), input).unwrap();
    assert_eq!(saved.format, "txt");
    assert!(preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "renamed.txt".into(),
            bytes: b"Synthetic alpha specification".to_vec(),
        }
    )
    .unwrap_err()
    .contains("相同文件"));
    assert!(preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "bad.txt".into(),
            bytes: vec![255, 254],
        }
    )
    .is_err());
    assert_eq!(
        get_knowledge_document(root.0.clone(), saved.id)
            .unwrap()
            .pages[0]
            .text,
        "Synthetic alpha specification"
    );
    let replacement = preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "spec.md".into(),
            bytes: b"Synthetic beta specification".to_vec(),
        },
    )
    .unwrap();
    let mut input = document(None, "");
    input.kind = "file".into();
    input.id = Some(saved.id);
    input.expected_version = Some(1);
    input.preview_token = Some(replacement.token);
    save_knowledge(root.0.clone(), input).unwrap();
    let mut query = search("alpha", vec![]);
    query.include_general = true;
    assert!(search_knowledge(root.0.clone(), query).unwrap().is_empty());
    let mut metadata = document(None, "");
    metadata.kind = "file".into();
    metadata.id = Some(saved.id);
    metadata.expected_version = Some(2);
    metadata.title = "Revised title".into();
    save_knowledge(root.0.clone(), metadata).unwrap();
    assert!(get_knowledge_document(root.0.clone(), saved.id)
        .unwrap()
        .pages[0]
        .text
        .contains("beta"));
    delete_knowledge(root.0.clone(), saved.id).unwrap();
    assert_eq!(
        check_knowledge_reference(root.0.clone(), saved.id, 3).unwrap(),
        "deleted"
    );
    let detail = get_knowledge_document(root.0.clone(), saved.id).unwrap();
    assert!(detail.document.deleted);
    assert!(detail.pages.is_empty());
    assert!(detail.history.is_empty());
    let connection = crate::storage::open(root.0.clone()).unwrap();
    let count: i64 = connection
        .query_row(
            "SELECT count(*) FROM knowledge_versions WHERE document_id=?1",
            [saved.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
    assert!(list_catalog(root.0.clone()).unwrap().documents.is_empty());
    // Reimporting after deletion is allowed; no active copy or parsed cache survives.
    preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "spec.txt".into(),
            bytes: b"Synthetic alpha specification".to_vec(),
        },
    )
    .unwrap();
}

#[test]
fn import_caps_invalid_links_archive_and_restart_keep_valid_data() {
    let root = TempData::new();
    assert!(preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "../file.txt".into(),
            bytes: vec![65]
        }
    )
    .is_err());
    assert!(preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "file.txt".into(),
            bytes: vec![65; MAX_FILE_BYTES + 1]
        }
    )
    .is_err());
    assert!(preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "file.txt".into(),
            bytes: vec![]
        }
    )
    .is_err());
    assert!(save_knowledge(root.0.clone(), document(Some(999), "invalid link")).is_err());
    let saved = save_knowledge(root.0.clone(), document(None, "known fact")).unwrap();
    set_knowledge_archived(root.0.clone(), saved.id, true).unwrap();
    assert_eq!(
        check_knowledge_reference(root.0.clone(), saved.id, 1).unwrap(),
        "archived"
    );
    let mut query = search("fact", vec![]);
    query.include_general = true;
    assert!(search_knowledge(root.0.clone(), query).unwrap().is_empty());
    crate::storage::initialize(root.0.clone()).unwrap();
    assert_eq!(
        get_knowledge_document(root.0.clone(), saved.id)
            .unwrap()
            .pages[0]
            .text,
        "known fact"
    );
    set_knowledge_archived(root.0.clone(), saved.id, false).unwrap();
    let mut query = search("fact", vec![]);
    query.include_general = true;
    assert_eq!(search_knowledge(root.0.clone(), query).unwrap().len(), 1);
}

#[test]
fn expired_preview_never_replaces_valid_version() {
    let root = TempData::new();
    let saved = save_knowledge(root.0.clone(), document(None, "old valid content")).unwrap();
    let preview = preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "new.txt".into(),
            bytes: b"new content".to_vec(),
        },
    )
    .unwrap();
    crate::storage::open(root.0.clone())
        .unwrap()
        .execute(
            "UPDATE knowledge_import_previews SET expires_at='2000-01-01T00:00:00Z' WHERE token=?1",
            [&preview.token],
        )
        .unwrap();
    let mut update = document(None, "");
    update.id = Some(saved.id);
    update.expected_version = Some(1);
    update.kind = "file".into();
    update.preview_token = Some(preview.token);
    assert!(save_knowledge(root.0.clone(), update)
        .unwrap_err()
        .contains("过期"));
    let detail = get_knowledge_document(root.0.clone(), saved.id).unwrap();
    assert_eq!(detail.document.version, 1);
    assert_eq!(detail.pages[0].text, "old valid content");
}

fn synthetic_pdf(with_text: bool) -> Vec<u8> {
    let content = if with_text {
        "BT /F1 12 Tf 72 720 Td (Synthetic steel specification) Tj ET"
    } else {
        ""
    };
    let objects=[
        "<< /Type /Catalog /Pages 2 0 R >>".to_owned(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_owned(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".to_owned(),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_owned(),
        format!("<< /Length {} >>\nstream\n{content}\nendstream",content.len()),
    ];
    let mut pdf = "%PDF-1.4\n".to_owned();
    let mut offsets = Vec::new();
    for (i, obj) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.push_str(&format!("{} 0 obj\n{obj}\nendobj\n", i + 1));
    }
    let xref = pdf.len();
    pdf.push_str("xref\n0 6\n0000000000 65535 f \n");
    for offset in offsets {
        pdf.push_str(&format!("{offset:010} 00000 n \n"));
    }
    pdf.push_str(&format!(
        "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
    ));
    pdf.into_bytes()
}

#[test]
fn actual_pdf_text_and_page_location_reject_scan_and_malformed_files() {
    let pages = extract_pdf(&synthetic_pdf(true)).unwrap();
    assert_eq!(pages.len(), 1);
    assert_eq!(pages[0].page, 1);
    assert!(pages[0].text.contains("Synthetic steel"));
    assert!(extract_pdf(&synthetic_pdf(false))
        .unwrap_err()
        .contains("OCR"));
    assert!(extract_pdf(b"%PDF-corrupt").is_err());
}

#[test]
fn size_count_and_bad_text_limits_do_not_create_partial_documents() {
    let root = TempData::new();
    assert!(save_knowledge(
        root.0.clone(),
        document(None, &"x".repeat(MAX_TEXT_CHARS + 1))
    )
    .is_err());
    assert!(save_knowledge(root.0.clone(), document(None, "bad\0text")).is_err());
    assert!(validate_pages(vec!["x".into(); MAX_PAGES + 1]).is_err());
    for index in 0..MAX_DOCUMENTS {
        save_knowledge(root.0.clone(), document(None, &format!("document {index}"))).unwrap();
    }
    assert!(save_knowledge(root.0.clone(), document(None, "overflow"))
        .unwrap_err()
        .contains("100"));
    assert_eq!(
        list_catalog(root.0.clone()).unwrap().documents.len(),
        MAX_DOCUMENTS as usize
    );
}

#[test]
fn explicit_general_only_and_empty_scope_do_not_read_product_documents() {
    let root = TempData::new();
    let product = save_product(root.0.clone(), product("A")).unwrap();
    save_knowledge(
        root.0.clone(),
        document(Some(product.id), "shared keyword product secret"),
    )
    .unwrap();
    let generic = save_knowledge(
        root.0.clone(),
        document(None, "shared keyword general fact"),
    )
    .unwrap();
    assert!(search_knowledge(root.0.clone(), search("shared", vec![]))
        .unwrap()
        .is_empty());
    let mut general = search("shared", vec![]);
    general.include_general = true;
    let found = search_knowledge(root.0.clone(), general).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].document_id, generic.id);
    assert!(!found[0].text.contains("secret"));
}

#[test]
fn all_products_search_reads_current_backend_scope_beyond_explicit_id_limit() {
    let root = TempData::new();
    let mut ids = Vec::new();
    for index in 0..103 {
        ids.push(
            save_product(root.0.clone(), product(&format!("SKU-{index}")))
                .unwrap()
                .id,
        );
    }
    let all = || KnowledgeSearchInput {
        all_products: true,
        ..search("shared", vec![])
    };
    assert!(search_knowledge(root.0.clone(), all()).unwrap().is_empty());
    let first = save_knowledge(
        root.0.clone(),
        document(Some(ids[102]), "shared first product fact"),
    )
    .unwrap();
    let found = search_knowledge(root.0.clone(), all()).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].document_id, first.id);
    assert_eq!(found[0].product_id, Some(ids[102]));

    // A newly created product and its first document must be visible without
    // refreshing any client product/document cache or enumerating its IDs.
    let next = save_product(root.0.clone(), product("SKU-new")).unwrap();
    let second = save_knowledge(
        root.0.clone(),
        document(Some(next.id), "shared new linked product fact"),
    )
    .unwrap();
    let generic = save_knowledge(root.0.clone(), document(None, "shared generic fact")).unwrap();
    let found = search_knowledge(root.0.clone(), all()).unwrap();
    assert_eq!(found.len(), 2);
    assert!(found.iter().any(|snippet| snippet.document_id == second.id));
    assert!(found
        .iter()
        .all(|snippet| snippet.document_id != generic.id));

    let mut update = document(Some(ids[102]), "shared revised current fact");
    update.id = Some(first.id);
    update.expected_version = Some(1);
    save_knowledge(root.0.clone(), update).unwrap();
    let found = search_knowledge(root.0.clone(), all()).unwrap();
    let revised = found
        .iter()
        .find(|snippet| snippet.document_id == first.id)
        .unwrap();
    assert_eq!(revised.version, 2);
    assert!(revised.text.contains("revised current"));
    assert!(!revised.text.contains("first product"));
    set_knowledge_archived(root.0.clone(), second.id, true).unwrap();
    assert_eq!(search_knowledge(root.0.clone(), all()).unwrap().len(), 1);
    assert!(search_knowledge(root.0.clone(), search("shared", vec![]))
        .unwrap()
        .is_empty());

    let mut general_and_all = all();
    general_and_all.include_general = true;
    assert_eq!(
        search_knowledge(root.0.clone(), general_and_all)
            .unwrap()
            .len(),
        2
    );
    let mut too_many_explicit = search("shared", ids);
    too_many_explicit.all_products = true;
    assert!(search_knowledge(root.0.clone(), too_many_explicit)
        .unwrap_err()
        .contains("范围超过"));
}

#[test]
fn omitted_all_products_flag_keeps_empty_scope_closed() {
    let input: KnowledgeSearchInput = serde_json::from_value(serde_json::json!({
        "query": "fact", "productIds": [], "confirmedOnly": true,
        "publicOnly": true, "includeGeneral": false,
    }))
    .unwrap();
    assert!(!input.all_products);
    let root = TempData::new();
    let product = save_product(root.0.clone(), product("A")).unwrap();
    save_knowledge(root.0.clone(), document(Some(product.id), "known fact")).unwrap();
    assert!(search_knowledge(root.0.clone(), input).unwrap().is_empty());
}

#[test]
fn aggregate_capacity_includes_versions_text_and_previews_without_partial_writes() {
    let root = TempData::new();
    let first = save_knowledge(root.0.clone(), document(None, "old content")).unwrap();
    let mut update = document(None, "new content");
    update.id = Some(first.id);
    update.expected_version = Some(1);
    assert!(save_knowledge_with_capacity(root.0.clone(), update, 15)
        .unwrap_err()
        .contains("总容量"));
    let detail = get_knowledge_document(root.0.clone(), first.id).unwrap();
    assert_eq!(detail.document.version, 1);
    assert_eq!(detail.history.len(), 1);
    assert_eq!(detail.pages[0].text, "old content");
    assert!(preview_knowledge_import_with_capacity(
        root.0.clone(),
        FileImportInput {
            file_name: "future.txt".into(),
            bytes: b"imported content".to_vec(),
        },
        15
    )
    .unwrap_err()
    .contains("总容量"));
    let connection = open_catalog(root.0.clone()).unwrap();
    assert_eq!(
        connection
            .query_row::<i64, _, _>("SELECT count(*) FROM knowledge_import_previews", [], |r| r
                .get(0))
            .unwrap(),
        0
    );
    drop(connection);
    let preview = preview_knowledge_import(
        root.0.clone(),
        FileImportInput {
            file_name: "future.txt".into(),
            bytes: b"imported content".to_vec(),
        },
    )
    .unwrap();
    let connection = open_catalog(root.0.clone()).unwrap();
    let aggregate = "old content".len() as i64
        + "imported content".len() as i64
        + serde_json::to_string(&preview.pages).unwrap().len() as i64;
    assert!(ensure_managed_capacity(&connection, aggregate).is_ok());
    assert!(ensure_managed_capacity(&connection, aggregate - 1).is_err());
    drop(connection);
    let mut update = document(None, "");
    update.id = Some(first.id);
    update.expected_version = Some(1);
    update.kind = "file".into();
    update.preview_token = Some(preview.token.clone());
    assert!(save_knowledge_with_capacity(root.0.clone(), update, 15)
        .unwrap_err()
        .contains("总容量"));
    let connection = open_catalog(root.0.clone()).unwrap();
    assert_eq!(
        connection
            .query_row::<i64, _, _>(
                "SELECT count(*) FROM knowledge_import_previews WHERE token=?1",
                [preview.token],
                |r| r.get(0)
            )
            .unwrap(),
        1
    );
    assert_eq!(
        get_knowledge_document(root.0.clone(), first.id)
            .unwrap()
            .document
            .version,
        1
    );
    delete_knowledge(root.0.clone(), first.id).unwrap();
    assert!(list_catalog(root.0.clone()).unwrap().documents.is_empty());
}
