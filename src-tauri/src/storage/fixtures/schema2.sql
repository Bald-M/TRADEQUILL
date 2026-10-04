CREATE TABLE app_metadata (
                    key TEXT PRIMARY KEY NOT NULL,
                    value TEXT NOT NULL
                 );
                 INSERT INTO app_metadata (key, value) VALUES ('product', 'TradeQuill');
                 PRAGMA user_version = 1;

CREATE TABLE customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    company TEXT NOT NULL DEFAULT '',
                    email TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    country TEXT NOT NULL DEFAULT '',
                    source TEXT NOT NULL DEFAULT '',
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE inquiries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    received_on TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT NOT NULL,
                    country TEXT NOT NULL,
                    products_json TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE quote_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE RESTRICT,
                    quoted_on TEXT NOT NULL,
                    content TEXT NOT NULL,
                    amount_minor INTEGER NOT NULL,
                    currency TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE samples (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE RESTRICT,
                    product TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    requested_on TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    carrier TEXT NOT NULL DEFAULT '',
                    tracking_number TEXT NOT NULL DEFAULT '',
                    current_stage TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE sample_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE RESTRICT,
                    stage TEXT NOT NULL,
                    occurred_on TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE follow_up_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
                    inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE RESTRICT,
                    due_at TEXT NOT NULL,
                    content TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    completed_at TEXT,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE TABLE reminder_deliveries (
                    local_date TEXT PRIMARY KEY NOT NULL,
                    sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 );
                 CREATE INDEX inquiries_customer_idx ON inquiries(customer_id, received_on DESC);
                 CREATE INDEX quotes_customer_idx ON quote_records(customer_id, quoted_on DESC);
                 CREATE INDEX samples_customer_idx ON samples(customer_id, requested_on DESC);
                 CREATE INDEX sample_progress_sample_idx ON sample_progress(sample_id, occurred_on, id);
                 CREATE INDEX tasks_due_idx ON follow_up_tasks(completed, due_at);
                 PRAGMA user_version = 2;
