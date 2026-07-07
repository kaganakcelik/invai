import { Router, Response } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { processInvoice } from '../services/extraction';
import { Invoice } from '../types';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { location_id, vendor_id, status } = req.query as Record<string, string>;

  let query = supabase
    .from('invoices')
    .select('*, locations(name), vendors(name)')
    .eq('user_id', req.user!.id)
    .order('uploaded_at', { ascending: false });

  if (location_id) query = query.eq('location_id', location_id);
  if (vendor_id)   query = query.eq('vendor_id', vendor_id);
  if (status)      query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const result = (data ?? []).map((i) => ({
    ...i,
    location_name: (i.locations as { name: string } | null)?.name,
    vendor_name: (i.vendors as { name: string } | null)?.name,
    locations: undefined,
    vendors: undefined,
  }));

  res.json(result);
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, locations(name), vendors(name)')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (error || !invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

  const [{ data: lineItems }, { data: flags }] = await Promise.all([
    supabase.from('line_items').select('*').eq('invoice_id', req.params.id).order('created_at'),
    supabase
      .from('price_flags')
      .select('*, line_items!inner(invoice_id)')
      .eq('line_items.invoice_id', req.params.id),
  ]);

  res.json({
    invoice: {
      ...invoice,
      location_name: (invoice.locations as { name: string } | null)?.name,
      vendor_name: (invoice.vendors as { name: string } | null)?.name,
      locations: undefined,
      vendors: undefined,
    },
    line_items: lineItems ?? [],
    price_flags: (flags ?? []).map((f) => ({ ...f, line_items: undefined })),
  });
});

router.post('/:id/retry', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .eq('status', 'failed')
    .single();

  if (error || !invoice) {
    res.status(404).json({ error: 'Invoice not found or not in failed state' });
    return;
  }

  if (!invoice.file_path) {
    res.status(400).json({ error: 'Invoice has no stored file to retry' });
    return;
  }

  const filePath = path.join(config.UPLOAD_DIR, invoice.file_path);
  if (!fs.existsSync(filePath)) {
    await supabase.from('invoices').update({ status: 'failed' }).eq('id', invoice.id);
    res.status(400).json({ error: 'Stored file not found on disk' });
    return;
  }

  // Clear old line items (price_flags cascade-delete via FK)
  const { data: itemIds } = await supabase
    .from('line_items')
    .select('id')
    .eq('invoice_id', invoice.id);

  if (itemIds && itemIds.length > 0) {
    await supabase.from('price_flags').delete().in('line_item_id', itemIds.map((i) => i.id));
    await supabase.from('line_items').delete().eq('invoice_id', invoice.id);
  }

  await supabase.from('invoices').update({ status: 'pending' }).eq('id', invoice.id);

  res.json({ invoice_id: invoice.id, status: 'pending' });

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(invoice.file_path).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
  };

  processInvoice(invoice as Invoice, {
    buffer,
    mimetype: mimeMap[ext] ?? 'application/pdf',
    originalname: invoice.file_path,
  } as Express.Multer.File).catch((err) => {
    console.error(`Retry failed for invoice ${invoice.id}:`, err);
  });
});

export default router;
