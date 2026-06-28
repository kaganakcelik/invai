import { Router, Response } from 'express';
import db from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { processInvoice } from '../services/extraction';
import { Invoice } from '../types';

const router = Router();

router.get('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const { location_id, vendor_id, status } = req.query as Record<string, string>;

  let sql = `SELECT i.*, l.name as location_name, v.name as vendor_name
             FROM invoices i
             LEFT JOIN locations l ON i.location_id = l.id
             LEFT JOIN vendors v ON i.vendor_id = v.id
             WHERE 1=1`;
  const params: string[] = [];

  if (location_id) { sql += ' AND i.location_id = ?'; params.push(location_id); }
  if (vendor_id)   { sql += ' AND i.vendor_id = ?';   params.push(vendor_id); }
  if (status)      { sql += ' AND i.status = ?';       params.push(status); }

  sql += ' ORDER BY i.uploaded_at DESC';

  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const invoice = db
    .prepare(
      `SELECT i.*, l.name as location_name, v.name as vendor_name
       FROM invoices i
       LEFT JOIN locations l ON i.location_id = l.id
       LEFT JOIN vendors v ON i.vendor_id = v.id
       WHERE i.id = ?`
    )
    .get(req.params.id);

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const lineItems = db
    .prepare('SELECT * FROM line_items WHERE invoice_id = ? ORDER BY created_at')
    .all(req.params.id);

  const flags = db
    .prepare(
      `SELECT pf.* FROM price_flags pf
       JOIN line_items li ON pf.line_item_id = li.id
       WHERE li.invoice_id = ?`
    )
    .all(req.params.id);

  res.json({ invoice, line_items: lineItems, price_flags: flags });
});

router.post('/:id/retry', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const invoice = db
    .prepare("SELECT * FROM invoices WHERE id = ? AND status = 'failed'")
    .get(req.params.id) as Invoice | undefined;

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found or not in failed state' });
    return;
  }

  if (!invoice.file_path) {
    res.status(400).json({ error: 'Invoice has no stored file to retry' });
    return;
  }

  db.prepare("UPDATE invoices SET status = 'pending' WHERE id = ?").run(invoice.id);

  // Re-process from the stored file
  const fs = await import('fs');
  const path = await import('path');
  const { config } = await import('../config');
  const filePath = path.join(config.UPLOAD_DIR, invoice.file_path);

  if (!fs.existsSync(filePath)) {
    db.prepare("UPDATE invoices SET status = 'failed' WHERE id = ?").run(invoice.id);
    res.status(400).json({ error: 'Stored file not found on disk' });
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(invoice.file_path).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const mimetype = mimeMap[ext] ?? 'application/pdf';

  const mockFile = {
    buffer,
    mimetype,
    originalname: invoice.file_path,
  } as Express.Multer.File;

  // Clear old line items and flags before retrying
  db.exec('BEGIN');
  try {
    const itemIds = (
      db.prepare('SELECT id FROM line_items WHERE invoice_id = ?').all(invoice.id) as { id: string }[]
    ).map((r) => r.id);

    if (itemIds.length > 0) {
      db.prepare(
        `DELETE FROM price_flags WHERE line_item_id IN (${itemIds.map(() => '?').join(',')})`
      ).run(...itemIds);
      db.prepare('DELETE FROM line_items WHERE invoice_id = ?').run(invoice.id);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Failed to clear old data for retry' });
    return;
  }

  res.json({ invoice_id: invoice.id, status: 'pending' });

  processInvoice(invoice, mockFile).catch((err) => {
    console.error(`Retry failed for invoice ${invoice.id}:`, err);
  });
});

export default router;
