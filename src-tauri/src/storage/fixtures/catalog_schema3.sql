-- Frozen product/knowledge schema from main e5ba26a; apply after schema_v2.sql.
CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            parameters_json TEXT NOT NULL,
            moq TEXT,
            lead_time_days INTEGER,
            lead_time_note TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE TABLE knowledge_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
            tags_json TEXT NOT NULL,
            source TEXT NOT NULL,
            kind TEXT NOT NULL,
            conflict_note TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            visibility TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0,
            deleted INTEGER NOT NULL DEFAULT 0,
            current_version INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE TABLE knowledge_versions (
            document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
            version INTEGER NOT NULL,
            format TEXT NOT NULL,
            file_name TEXT NOT NULL,
            digest TEXT NOT NULL,
            file_bytes BLOB,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            PRIMARY KEY(document_id,version)
        );
        CREATE TABLE knowledge_pages (
            document_id INTEGER NOT NULL,
            version INTEGER NOT NULL,
            page INTEGER NOT NULL,
            text TEXT NOT NULL,
            PRIMARY KEY(document_id,version,page),
            FOREIGN KEY(document_id,version) REFERENCES knowledge_versions(document_id,version)
                ON DELETE CASCADE
        );
        CREATE TABLE knowledge_import_previews (
            token TEXT PRIMARY KEY NOT NULL,
            file_name TEXT NOT NULL,
            format TEXT NOT NULL,
            digest TEXT NOT NULL,
            file_bytes BLOB NOT NULL,
            pages_json TEXT NOT NULL,
            expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now','+15 minutes'))
        );
        CREATE INDEX knowledge_products_idx ON knowledge_documents(product_id,deleted,archived);
        CREATE INDEX knowledge_digest_idx ON knowledge_versions(digest);
PRAGMA user_version = 3;
