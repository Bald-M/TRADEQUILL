ALTER TABLE products ADD COLUMN lead_time_max_days INTEGER;
ALTER TABLE products ADD COLUMN internal_notes TEXT NOT NULL DEFAULT '';
UPDATE products SET lead_time_max_days=lead_time_days;
CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_key TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL
);
CREATE TABLE supplier_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    data TEXT NOT NULL,
    UNIQUE(product_id, supplier_id)
);
CREATE TABLE quote_series (id INTEGER PRIMARY KEY AUTOINCREMENT);
CREATE TABLE quote_versions (
    quote_id INTEGER PRIMARY KEY REFERENCES quote_records(id),
    series_id INTEGER NOT NULL REFERENCES quote_series(id),
    revision INTEGER NOT NULL,
    previous_quote_id INTEGER REFERENCES quote_records(id),
    request_key TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,
    UNIQUE(series_id, revision)
);
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_quote_id INTEGER NOT NULL UNIQUE REFERENCES quote_versions(quote_id),
    series_id INTEGER NOT NULL REFERENCES quote_series(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    ordered_on TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('draft', 'confirmed', 'cancelled')),
    version INTEGER NOT NULL,
    data TEXT NOT NULL
);
CREATE UNIQUE INDEX active_order_series_idx ON orders(series_id) WHERE status != 'cancelled';
CREATE INDEX orders_date_customer_idx ON orders(ordered_on, customer_id, status);
CREATE TABLE order_quote_sources (
    quote_id INTEGER PRIMARY KEY REFERENCES quote_versions(quote_id),
    order_id INTEGER NOT NULL REFERENCES orders(id)
);
CREATE TABLE order_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    action TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE commerce_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
PRAGMA user_version = 4;
