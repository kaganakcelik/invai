import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { PriceFlag } from '../types';

interface BaselineResult {
  baseline: number;
  count: number;
}

interface LineItemRow {
  id: string;
  normalized_item_name: string;
  unit_price: number | null;
  quantity: number | null;
}

export function computeBaseline(
  db: DatabaseSync,
  normalizedItemName: string,
  vendorId: string,
  excludeInvoiceId: string,
  asOfDate: string
): BaselineResult | null {
  const row = db
    .prepare(
      `SELECT AVG(li.unit_price) as avg_price, COUNT(*) as cnt
       FROM line_items li
       JOIN invoices i ON li.invoice_id = i.id
       WHERE li.normalized_item_name = ?
         AND i.vendor_id = ?
         AND i.id != ?
         AND i.uploaded_at >= datetime(?, '-30 days')
         AND i.status = 'parsed'
         AND li.unit_price IS NOT NULL
         AND li.unit_price > 0`
    )
    .get(normalizedItemName, vendorId, excludeInvoiceId, asOfDate) as {
    avg_price: number | null;
    cnt: number;
  } | undefined;

  if (!row || row.cnt < 2 || row.avg_price === null) return null;
  return { baseline: row.avg_price, count: row.cnt };
}

export function flagNewItems(
  db: DatabaseSync,
  invoiceId: string,
  vendorId: string
): PriceFlag[] {
  const invoice = db
    .prepare('SELECT uploaded_at FROM invoices WHERE id = ?')
    .get(invoiceId) as { uploaded_at: string } | undefined;

  if (!invoice) return [];

  const items = db
    .prepare(
      'SELECT id, normalized_item_name, unit_price, quantity FROM line_items WHERE invoice_id = ?'
    )
    .all(invoiceId) as unknown as LineItemRow[];

  const insertFlag = db.prepare(
    `INSERT INTO price_flags (id, line_item_id, baseline_price, current_price, pct_change, estimated_dollar_impact)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const created: PriceFlag[] = [];

  db.exec('BEGIN');
  try {
    for (const item of items) {
      if (item.unit_price === null || item.unit_price <= 0) continue;

      const result = computeBaseline(
        db,
        item.normalized_item_name,
        vendorId,
        invoiceId,
        invoice.uploaded_at
      );

      if (!result) continue;

      const pctChange = (item.unit_price - result.baseline) / result.baseline;

      if (pctChange <= config.FLAG_THRESHOLD) continue;

      const dollarImpact = (item.unit_price - result.baseline) * (item.quantity ?? 0);
      if (dollarImpact <= 0) continue;

      const flag: PriceFlag = {
        id: uuidv4(),
        line_item_id: item.id,
        baseline_price: result.baseline,
        current_price: item.unit_price,
        pct_change: pctChange,
        estimated_dollar_impact: dollarImpact,
        created_at: new Date().toISOString(),
      };

      insertFlag.run(
        flag.id,
        flag.line_item_id,
        flag.baseline_price,
        flag.current_price,
        flag.pct_change,
        flag.estimated_dollar_impact
      );

      created.push(flag);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return created;
}
