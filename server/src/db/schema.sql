CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  invoice_date TEXT,
  file_path TEXT NOT NULL,
  raw_extraction_json TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','parsed','failed'))
);

CREATE TABLE IF NOT EXISTS line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  raw_description TEXT,
  normalized_item_name TEXT NOT NULL,
  unit TEXT,
  quantity REAL,
  unit_price REAL,
  line_total REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_flags (
  id TEXT PRIMARY KEY,
  line_item_id TEXT NOT NULL REFERENCES line_items(id),
  baseline_price REAL NOT NULL,
  current_price REAL NOT NULL,
  pct_change REAL NOT NULL,
  estimated_dollar_impact REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_line_items_norm_name ON line_items(normalized_item_name);
CREATE INDEX IF NOT EXISTS idx_price_flags_line_item ON price_flags(line_item_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_location ON invoices(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_uploaded_at ON invoices(uploaded_at);
