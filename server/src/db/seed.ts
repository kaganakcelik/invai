import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { flagNewItems } from '../services/baseline';

const DB_PATH = path.resolve(process.env.DB_PATH ?? './invai.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Run migrations so tables exist even on a fresh DB
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// ── IDs ────────────────────────────────────────────────────────────────────────

const LOC_MAIN   = uuidv4();
const LOC_SOUTH  = uuidv4();
const LOC_NORTH  = uuidv4();

const VEN_SYSCO  = uuidv4();
const VEN_USFOOD = uuidv4();
const VEN_PFGC   = uuidv4();

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function invoiceDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

// ── Locations & Vendors ───────────────────────────────────────────────────────

db.prepare('INSERT OR IGNORE INTO locations (id, name) VALUES (?, ?)').run(LOC_MAIN,  'Main St Location');
db.prepare('INSERT OR IGNORE INTO locations (id, name) VALUES (?, ?)').run(LOC_SOUTH, 'South Side Location');
db.prepare('INSERT OR IGNORE INTO locations (id, name) VALUES (?, ?)').run(LOC_NORTH, 'North End Location');

db.prepare('INSERT OR IGNORE INTO vendors (id, name) VALUES (?, ?)').run(VEN_SYSCO,  'Sysco Corporation');
db.prepare('INSERT OR IGNORE INTO vendors (id, name) VALUES (?, ?)').run(VEN_USFOOD, 'US Foods');
db.prepare('INSERT OR IGNORE INTO vendors (id, name) VALUES (?, ?)').run(VEN_PFGC,   'Performance Food Group');

// ── Invoice builder ───────────────────────────────────────────────────────────

interface LineItemInput {
  raw_description: string;
  normalized_item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

function insertInvoice(opts: {
  locationId: string;
  vendorId: string;
  daysBack: number;
  items: LineItemInput[];
}): string {
  const invId = uuidv4();
  const uploadedAt = daysAgo(opts.daysBack);
  const invDate = invoiceDate(opts.daysBack);

  db.prepare(`
    INSERT INTO invoices (id, location_id, vendor_id, invoice_date, file_path, uploaded_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'parsed')
  `).run(invId, opts.locationId, opts.vendorId, invDate, `seed-${invId}.pdf`, uploadedAt);

  const insertItem = db.prepare(`
    INSERT INTO line_items (id, invoice_id, raw_description, normalized_item_name, unit, quantity, unit_price, line_total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const li of opts.items) {
    const liId = uuidv4();
    insertItem.run(liId, invId, li.raw_description, li.normalized_item_name, li.unit, li.quantity, li.unit_price, li.quantity * li.unit_price, uploadedAt);
  }

  return invId;
}

// ── Historical invoices (build baseline) ─────────────────────────────────────

// Sysco / Main St — 3 invoices over past 25 days
insertInvoice({
  locationId: LOC_MAIN, vendorId: VEN_SYSCO, daysBack: 25,
  items: [
    { raw_description: 'CHICKEN BREAST BNLS SKNLS 40/4OZ', normalized_item_name: 'chicken breast boneless', unit: 'case', quantity: 4,  unit_price: 62.40 },
    { raw_description: 'ROMAINE HEARTS 3CT',                normalized_item_name: 'romaine lettuce',          unit: 'case', quantity: 6,  unit_price: 18.50 },
    { raw_description: 'OLIVE OIL EXTRA VIRGIN 1GAL',       normalized_item_name: 'olive oil extra virgin',   unit: 'gal',  quantity: 4,  unit_price: 24.80 },
    { raw_description: 'SALMON FILLET FRESH 10LB',          normalized_item_name: 'salmon fillet',            unit: 'lb',   quantity: 30, unit_price: 11.20 },
    { raw_description: 'GARLIC WHOLE PEELED 5LB',           normalized_item_name: 'garlic peeled',            unit: 'lb',   quantity: 10, unit_price: 4.10  },
    { raw_description: 'HEAVY CREAM 40% 1/2GAL',            normalized_item_name: 'heavy cream',              unit: 'each', quantity: 8,  unit_price: 5.60  },
    { raw_description: 'BUTTER UNSALTED AA 36CT',           normalized_item_name: 'butter unsalted',          unit: 'case', quantity: 2,  unit_price: 88.00 },
  ],
});

insertInvoice({
  locationId: LOC_MAIN, vendorId: VEN_SYSCO, daysBack: 18,
  items: [
    { raw_description: 'CHICKEN BREAST BNLS SKNLS 40/4OZ', normalized_item_name: 'chicken breast boneless', unit: 'case', quantity: 5,  unit_price: 63.10 },
    { raw_description: 'ROMAINE HEARTS 3CT',                normalized_item_name: 'romaine lettuce',          unit: 'case', quantity: 8,  unit_price: 18.75 },
    { raw_description: 'OLIVE OIL EXTRA VIRGIN 1GAL',       normalized_item_name: 'olive oil extra virgin',   unit: 'gal',  quantity: 4,  unit_price: 25.10 },
    { raw_description: 'SALMON FILLET FRESH 10LB',          normalized_item_name: 'salmon fillet',            unit: 'lb',   quantity: 25, unit_price: 11.40 },
    { raw_description: 'GARLIC WHOLE PEELED 5LB',           normalized_item_name: 'garlic peeled',            unit: 'lb',   quantity: 10, unit_price: 4.15  },
    { raw_description: 'HEAVY CREAM 40% 1/2GAL',            normalized_item_name: 'heavy cream',              unit: 'each', quantity: 6,  unit_price: 5.65  },
    { raw_description: 'BUTTER UNSALTED AA 36CT',           normalized_item_name: 'butter unsalted',          unit: 'case', quantity: 3,  unit_price: 89.50 },
    { raw_description: 'BEEF TENDERLOIN CHOICE 4-5LB',      normalized_item_name: 'beef tenderloin',          unit: 'lb',   quantity: 20, unit_price: 28.40 },
  ],
});

insertInvoice({
  locationId: LOC_MAIN, vendorId: VEN_SYSCO, daysBack: 10,
  items: [
    { raw_description: 'CHICKEN BREAST BNLS SKNLS 40/4OZ', normalized_item_name: 'chicken breast boneless', unit: 'case', quantity: 6,  unit_price: 62.90 },
    { raw_description: 'ROMAINE HEARTS 3CT',                normalized_item_name: 'romaine lettuce',          unit: 'case', quantity: 6,  unit_price: 19.00 },
    { raw_description: 'OLIVE OIL EXTRA VIRGIN 1GAL',       normalized_item_name: 'olive oil extra virgin',   unit: 'gal',  quantity: 4,  unit_price: 24.95 },
    { raw_description: 'SALMON FILLET FRESH 10LB',          normalized_item_name: 'salmon fillet',            unit: 'lb',   quantity: 30, unit_price: 11.60 },
    { raw_description: 'BEEF TENDERLOIN CHOICE 4-5LB',      normalized_item_name: 'beef tenderloin',          unit: 'lb',   quantity: 15, unit_price: 28.80 },
    { raw_description: 'BUTTER UNSALTED AA 36CT',           normalized_item_name: 'butter unsalted',          unit: 'case', quantity: 2,  unit_price: 89.00 },
  ],
});

// US Foods / South Side — 2 historical invoices
insertInvoice({
  locationId: LOC_SOUTH, vendorId: VEN_USFOOD, daysBack: 22,
  items: [
    { raw_description: 'GROUND BEEF 80/20 10LB CHUB',   normalized_item_name: 'ground beef 80/20',       unit: 'lb',   quantity: 40, unit_price: 4.80  },
    { raw_description: 'PORK BELLY SKIN OFF 8-12LB',    normalized_item_name: 'pork belly',              unit: 'lb',   quantity: 20, unit_price: 5.20  },
    { raw_description: 'CHEDDAR CHEESE SHREDDED 4/5LB', normalized_item_name: 'cheddar cheese shredded', unit: 'case', quantity: 3,  unit_price: 52.00 },
    { raw_description: 'CANOLA OIL 35LB',               normalized_item_name: 'canola oil',              unit: 'each', quantity: 4,  unit_price: 38.50 },
    { raw_description: 'SHRIMP 16/20 IQF 5LB',         normalized_item_name: 'shrimp 16/20',            unit: 'lb',   quantity: 15, unit_price: 9.40  },
    { raw_description: 'PASTA PENNE 20LB',              normalized_item_name: 'pasta penne',             unit: 'case', quantity: 2,  unit_price: 22.00 },
    { raw_description: 'TOMATO CRUSHED 6/#10',          normalized_item_name: 'tomato crushed canned',   unit: 'case', quantity: 4,  unit_price: 31.20 },
  ],
});

insertInvoice({
  locationId: LOC_SOUTH, vendorId: VEN_USFOOD, daysBack: 14,
  items: [
    { raw_description: 'GROUND BEEF 80/20 10LB CHUB',   normalized_item_name: 'ground beef 80/20',       unit: 'lb',   quantity: 40, unit_price: 4.90  },
    { raw_description: 'PORK BELLY SKIN OFF 8-12LB',    normalized_item_name: 'pork belly',              unit: 'lb',   quantity: 25, unit_price: 5.35  },
    { raw_description: 'CHEDDAR CHEESE SHREDDED 4/5LB', normalized_item_name: 'cheddar cheese shredded', unit: 'case', quantity: 4,  unit_price: 53.00 },
    { raw_description: 'CANOLA OIL 35LB',               normalized_item_name: 'canola oil',              unit: 'each', quantity: 4,  unit_price: 39.00 },
    { raw_description: 'SHRIMP 16/20 IQF 5LB',         normalized_item_name: 'shrimp 16/20',            unit: 'lb',   quantity: 20, unit_price: 9.60  },
    { raw_description: 'PASTA PENNE 20LB',              normalized_item_name: 'pasta penne',             unit: 'case', quantity: 2,  unit_price: 22.50 },
    { raw_description: 'TOMATO CRUSHED 6/#10',          normalized_item_name: 'tomato crushed canned',   unit: 'case', quantity: 6,  unit_price: 31.80 },
    { raw_description: 'FLOUR ALL PURPOSE 50LB',        normalized_item_name: 'flour all purpose',       unit: 'each', quantity: 4,  unit_price: 19.40 },
  ],
});

// PFG / North End — 2 historical invoices
insertInvoice({
  locationId: LOC_NORTH, vendorId: VEN_PFGC, daysBack: 20,
  items: [
    { raw_description: 'LAMB RACK FRENCHED 8 BONE',          normalized_item_name: 'lamb rack frenched', unit: 'lb',   quantity: 12, unit_price: 32.50 },
    { raw_description: 'DUCK BREAST MAGRET 7OZ',             normalized_item_name: 'duck breast',        unit: 'each', quantity: 24, unit_price: 8.80  },
    { raw_description: 'TRUFFLE OIL WHITE 8.5OZ',            normalized_item_name: 'truffle oil white',  unit: 'each', quantity: 6,  unit_price: 14.20 },
    { raw_description: 'LOBSTER TAIL 6-7OZ IQF',             normalized_item_name: 'lobster tail',       unit: 'each', quantity: 24, unit_price: 22.50 },
    { raw_description: 'MICROGREENS MIX 4OZ',                normalized_item_name: 'microgreens mix',    unit: 'each', quantity: 12, unit_price: 7.60  },
    { raw_description: 'PARMESAN REGGIANO IMPORTED 5LB',     normalized_item_name: 'parmesan reggiano',  unit: 'lb',   quantity: 10, unit_price: 18.40 },
  ],
});

insertInvoice({
  locationId: LOC_NORTH, vendorId: VEN_PFGC, daysBack: 12,
  items: [
    { raw_description: 'LAMB RACK FRENCHED 8 BONE',          normalized_item_name: 'lamb rack frenched', unit: 'lb',   quantity: 10, unit_price: 33.20 },
    { raw_description: 'DUCK BREAST MAGRET 7OZ',             normalized_item_name: 'duck breast',        unit: 'each', quantity: 20, unit_price: 8.90  },
    { raw_description: 'TRUFFLE OIL WHITE 8.5OZ',            normalized_item_name: 'truffle oil white',  unit: 'each', quantity: 6,  unit_price: 14.50 },
    { raw_description: 'LOBSTER TAIL 6-7OZ IQF',             normalized_item_name: 'lobster tail',       unit: 'each', quantity: 24, unit_price: 23.10 },
    { raw_description: 'MICROGREENS MIX 4OZ',                normalized_item_name: 'microgreens mix',    unit: 'each', quantity: 10, unit_price: 7.80  },
    { raw_description: 'PARMESAN REGGIANO IMPORTED 5LB',     normalized_item_name: 'parmesan reggiano',  unit: 'lb',   quantity: 8,  unit_price: 18.80 },
    { raw_description: 'WAGYU BEEF STRIP LOIN A5',           normalized_item_name: 'wagyu strip loin a5', unit: 'lb',  quantity: 5,  unit_price: 145.00 },
  ],
});

// ── Recent invoices with price spikes — let the app flag them ────────────────

const recentInvoices: Array<{ invoiceId: string; vendorId: string; label: string }> = [];

recentInvoices.push({
  label: 'Sysco / Main St',
  vendorId: VEN_SYSCO,
  invoiceId: insertInvoice({
    locationId: LOC_MAIN, vendorId: VEN_SYSCO, daysBack: 2,
    items: [
      { raw_description: 'CHICKEN BREAST BNLS SKNLS 40/4OZ', normalized_item_name: 'chicken breast boneless', unit: 'case', quantity: 6,  unit_price: 71.50 }, // ~+14%
      { raw_description: 'ROMAINE HEARTS 3CT',                normalized_item_name: 'romaine lettuce',          unit: 'case', quantity: 8,  unit_price: 19.20 },
      { raw_description: 'OLIVE OIL EXTRA VIRGIN 1GAL',       normalized_item_name: 'olive oil extra virgin',   unit: 'gal',  quantity: 6,  unit_price: 29.40 }, // ~+18%
      { raw_description: 'SALMON FILLET FRESH 10LB',          normalized_item_name: 'salmon fillet',            unit: 'lb',   quantity: 30, unit_price: 13.20 }, // ~+16%
      { raw_description: 'BEEF TENDERLOIN CHOICE 4-5LB',      normalized_item_name: 'beef tenderloin',          unit: 'lb',   quantity: 20, unit_price: 29.10 },
      { raw_description: 'BUTTER UNSALTED AA 36CT',           normalized_item_name: 'butter unsalted',          unit: 'case', quantity: 3,  unit_price: 90.00 },
    ],
  }),
});

recentInvoices.push({
  label: 'US Foods / South Side',
  vendorId: VEN_USFOOD,
  invoiceId: insertInvoice({
    locationId: LOC_SOUTH, vendorId: VEN_USFOOD, daysBack: 1,
    items: [
      { raw_description: 'GROUND BEEF 80/20 10LB CHUB',   normalized_item_name: 'ground beef 80/20',       unit: 'lb',   quantity: 50, unit_price: 5.55  }, // ~+14%
      { raw_description: 'PORK BELLY SKIN OFF 8-12LB',    normalized_item_name: 'pork belly',              unit: 'lb',   quantity: 20, unit_price: 5.40  },
      { raw_description: 'CHEDDAR CHEESE SHREDDED 4/5LB', normalized_item_name: 'cheddar cheese shredded', unit: 'case', quantity: 4,  unit_price: 61.00 }, // ~+16%
      { raw_description: 'CANOLA OIL 35LB',               normalized_item_name: 'canola oil',              unit: 'each', quantity: 6,  unit_price: 47.50 }, // ~+22%
      { raw_description: 'SHRIMP 16/20 IQF 5LB',         normalized_item_name: 'shrimp 16/20',            unit: 'lb',   quantity: 25, unit_price: 11.20 }, // ~+18%
      { raw_description: 'PASTA PENNE 20LB',              normalized_item_name: 'pasta penne',             unit: 'case', quantity: 3,  unit_price: 23.00 },
      { raw_description: 'TOMATO CRUSHED 6/#10',          normalized_item_name: 'tomato crushed canned',   unit: 'case', quantity: 4,  unit_price: 32.10 },
    ],
  }),
});

recentInvoices.push({
  label: 'PFG / North End',
  vendorId: VEN_PFGC,
  invoiceId: insertInvoice({
    locationId: LOC_NORTH, vendorId: VEN_PFGC, daysBack: 1,
    items: [
      { raw_description: 'LAMB RACK FRENCHED 8 BONE',      normalized_item_name: 'lamb rack frenched', unit: 'lb',   quantity: 15, unit_price: 39.60 }, // ~+21%
      { raw_description: 'DUCK BREAST MAGRET 7OZ',         normalized_item_name: 'duck breast',        unit: 'each', quantity: 24, unit_price: 10.40 }, // ~+18%
      { raw_description: 'TRUFFLE OIL WHITE 8.5OZ',        normalized_item_name: 'truffle oil white',  unit: 'each', quantity: 6,  unit_price: 14.60 },
      { raw_description: 'LOBSTER TAIL 6-7OZ IQF',         normalized_item_name: 'lobster tail',       unit: 'each', quantity: 30, unit_price: 27.50 }, // ~+21%
      { raw_description: 'MICROGREENS MIX 4OZ',            normalized_item_name: 'microgreens mix',    unit: 'each', quantity: 12, unit_price: 7.90  },
      { raw_description: 'PARMESAN REGGIANO IMPORTED 5LB', normalized_item_name: 'parmesan reggiano',  unit: 'lb',   quantity: 10, unit_price: 19.20 },
    ],
  }),
});

// ── Run the real flagging logic on each recent invoice ────────────────────────

let totalFlags = 0;
for (const { invoiceId, vendorId, label } of recentInvoices) {
  const flags = flagNewItems(db, invoiceId, vendorId);
  totalFlags += flags.length;
  console.log(`  ${label}: ${flags.length} flag(s) detected`);
  for (const f of flags) {
    const item = db.prepare('SELECT normalized_item_name FROM line_items WHERE id = ?').get(f.line_item_id) as { normalized_item_name: string };
    console.log(`    ↳ ${item.normalized_item_name}: $${f.baseline_price.toFixed(2)} → $${f.current_price.toFixed(2)} (+${(f.pct_change * 100).toFixed(1)}%)`);
  }
}

console.log('');
console.log('✓ Seed complete');
console.log(`  Locations: 3  |  Vendors: 3  |  Invoices: ${7 + recentInvoices.length}  |  Flags found: ${totalFlags}`);
