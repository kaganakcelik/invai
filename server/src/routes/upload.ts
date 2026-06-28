import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { processInvoice } from '../services/extraction';
import { Invoice } from '../types';

const router = Router();

router.post('/', requireAuth, uploadSingle, (req: AuthRequest, res: Response): void => {
  const { location_id, vendor_id } = req.body as { location_id?: string; vendor_id?: string };

  if (!location_id || !vendor_id) {
    res.status(400).json({ error: 'location_id and vendor_id are required' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const location = db.prepare('SELECT id FROM locations WHERE id = ?').get(location_id);
  const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(vendor_id);

  if (!location) { res.status(400).json({ error: 'Invalid location_id' }); return; }
  if (!vendor)   { res.status(400).json({ error: 'Invalid vendor_id' }); return; }

  const invoiceId = uuidv4();
  db.prepare(
    `INSERT INTO invoices (id, location_id, vendor_id, file_path, status)
     VALUES (?, ?, ?, '', 'pending')`
  ).run(invoiceId, location_id, vendor_id);

  const invoice: Invoice = {
    id: invoiceId,
    location_id,
    vendor_id,
    invoice_date: null,
    file_path: '',
    raw_extraction_json: null,
    uploaded_at: new Date().toISOString(),
    status: 'pending',
  };

  res.status(202).json({ invoice_id: invoiceId, status: 'pending' });

  // Process asynchronously — client polls /api/invoices/:id for status
  processInvoice(invoice, req.file).catch((err) => {
    console.error(`Background processing failed for invoice ${invoiceId}:`, err);
  });
});

export default router;
