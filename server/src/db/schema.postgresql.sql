-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id),
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  invoice_date TEXT,
  file_path TEXT NOT NULL,
  raw_extraction_json TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','parsed','failed'))
);

CREATE TABLE IF NOT EXISTS line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  raw_description TEXT,
  normalized_item_name TEXT NOT NULL,
  unit TEXT,
  quantity DOUBLE PRECISION,
  unit_price DOUBLE PRECISION,
  line_total DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_flags (
  id TEXT PRIMARY KEY,
  line_item_id TEXT NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
  baseline_price DOUBLE PRECISION NOT NULL,
  current_price DOUBLE PRECISION NOT NULL,
  pct_change DOUBLE PRECISION NOT NULL,
  estimated_dollar_impact DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user       ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor     ON invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_location   ON invoices(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_uploaded   ON invoices(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_locations_user      ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user        ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice  ON line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_line_items_name     ON line_items(normalized_item_name);
CREATE INDEX IF NOT EXISTS idx_price_flags_item    ON price_flags(line_item_id);
