import { Router, Response } from 'express';
import db from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const { vendor_id, location_id, min_pct } = req.query as Record<string, string>;

  let sql = `
    SELECT pf.*,
           li.normalized_item_name, li.raw_description, li.unit, li.quantity,
           i.id as invoice_id, i.invoice_date, i.uploaded_at,
           v.id as vendor_id, v.name as vendor_name,
           l.id as location_id, l.name as location_name
    FROM price_flags pf
    JOIN line_items li ON pf.line_item_id = li.id
    JOIN invoices i ON li.invoice_id = i.id
    JOIN vendors v ON i.vendor_id = v.id
    JOIN locations l ON i.location_id = l.id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (vendor_id)   { sql += ' AND v.id = ?';              params.push(vendor_id); }
  if (location_id) { sql += ' AND l.id = ?';              params.push(location_id); }
  if (min_pct)     { sql += ' AND pf.pct_change >= ?';    params.push(parseFloat(min_pct)); }

  sql += ' ORDER BY pf.estimated_dollar_impact DESC LIMIT 500';

  const flags = db.prepare(sql).all(...params);
  res.json(flags);
});

router.get('/summary', requireAuth, (_req: AuthRequest, res: Response): void => {
  const stats = db
    .prepare(
      `SELECT
         COUNT(DISTINCT pf.id) as total_flags,
         COALESCE(SUM(pf.estimated_dollar_impact), 0) as total_dollar_impact,
         COUNT(DISTINCT i.id) as total_invoices,
         COUNT(DISTINCT CASE WHEN i.uploaded_at >= datetime('now', '-30 days') THEN i.id END) as invoices_last_30_days
       FROM invoices i
       LEFT JOIN line_items li ON li.invoice_id = i.id
       LEFT JOIN price_flags pf ON pf.line_item_id = li.id
       WHERE i.status = 'parsed'`
    )
    .get();

  res.json(stats);
});

export default router;
