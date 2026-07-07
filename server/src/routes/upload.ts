import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { processInvoice } from '../services/extraction';
import { Invoice } from '../types';

const router = Router();

router.post('/', requireAuth, uploadSingle, async (req: AuthRequest, res: Response): Promise<void> => {
  const { location_id, vendor_id } = req.body as { location_id?: string; vendor_id?: string };

  if (!location_id || !vendor_id) {
    res.status(400).json({ error: 'location_id and vendor_id are required' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const userId = req.user!.id;

  const { data: location } = await supabase
    .from('locations').select('id').eq('id', location_id).eq('user_id', userId).single();
  const { data: vendor } = await supabase
    .from('vendors').select('id').eq('id', vendor_id).eq('user_id', userId).single();

  if (!location) { res.status(400).json({ error: 'Invalid location_id' }); return; }
  if (!vendor)   { res.status(400).json({ error: 'Invalid vendor_id' }); return; }

  const invoiceId = uuidv4();
  const { error } = await supabase.from('invoices').insert({
    id: invoiceId,
    user_id: userId,
    location_id,
    vendor_id,
    file_path: '',
    status: 'pending',
  });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const invoice: Invoice = {
    id: invoiceId,
    user_id: userId,
    location_id,
    vendor_id,
    invoice_date: null,
    file_path: '',
    raw_extraction_json: null,
    uploaded_at: new Date().toISOString(),
    status: 'pending',
  };

  res.status(202).json({ invoice_id: invoiceId, status: 'pending' });

  processInvoice(invoice, req.file).catch((err) => {
    console.error(`Background processing failed for invoice ${invoiceId}:`, err);
  });
});

export default router;
