-- Frozen schema 2 database, independent of future migration code.
-- All records below are synthetic compatibility fixtures.
CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
INSERT INTO app_metadata VALUES ('product', 'TradeQuill'), ('fixture', 'schema-2');
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
INSERT INTO customers(id, name, company, email, phone, country, source, notes)
VALUES (11, 'Legacy Buyer', 'Example Ltd', 'buyer@example.com', '555-0100', '美国', '展会', '旧客户备注');
INSERT INTO inquiries(id, customer_id, received_on, content, source, country, products_json, stage)
VALUES (21, 11, '2026-09-01', '旧询盘原文', '展会', '美国', '["自由文本产品 A","未知规格 B"]', 'quoted');
INSERT INTO quote_records(id, customer_id, inquiry_id, quoted_on, content, amount_minor, currency, notes)
VALUES (31, 11, 21, '2026-09-02', '只有文本的旧报价，不推断数量', 123456, 'USD', '旧报价备注');
INSERT INTO samples(id, customer_id, inquiry_id, product, quantity, requested_on, notes, carrier, tracking_number, current_stage)
VALUES (41, 11, 21, '旧样品自由文本', 2, '2026-09-03', '旧样品备注', 'Example Carrier', 'SAMPLE-001', 'sent');
INSERT INTO sample_progress(id, sample_id, stage, occurred_on, notes)
VALUES (51, 41, 'requested', '2026-09-03', '申请'), (52, 41, 'preparing', '2026-09-04', '准备'), (53, 41, 'sent', '2026-09-05', '寄出');
INSERT INTO follow_up_tasks(id, customer_id, inquiry_id, due_at, content, completed, completed_at)
VALUES (61, 11, 21, '2026-09-06T09:30', '旧跟进已完成', 1, '2026-09-06T09:35:00Z');
INSERT INTO reminder_deliveries(local_date) VALUES ('2026-09-06');
