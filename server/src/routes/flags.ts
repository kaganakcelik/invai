import { Router, Response } from 'express';
import { supabase } from '../db/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/summary', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, uploaded_at')
    .eq('user_id', userId)
    .eq('status', 'parsed');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const totalInvoices = invoices?.length ?? 0;
  const invoicesLast30 = invoices?.filter((i) => i.uploaded_at >= thirtyDaysAgo).length ?? 0;

  const invoiceIds = invoices?.map((i) => i.id) ?? [];
  if (invoiceIds.length === 0) {
    res.json({ total_flags: 0, total_dollar_impact: 0, total_invoices: totalInvoices, invoices_last_30_days: invoicesLast30 });
    return;
  }

  const { data: lineItems } = await supabase
    .from('line_items').select('id').in('invoice_id', invoiceIds);
  const lineItemIds = lineItems?.map((li) => li.id) ?? [];

  if (lineItemIds.length === 0) {
    res.json({ total_flags: 0, total_dollar_impact: 0, total_invoices: totalInvoices, invoices_last_30_days: invoicesLast30 });
    return;
  }

  const { data: flags } = await supabase
    .from('price_flags').select('estimated_dollar_impact').in('line_item_id', lineItemIds);

  const totalDollarImpact = flags?.reduce((sum, f) => sum + (f.estimated_dollar_impact ?? 0), 0) ?? 0;

  res.json({
    total_flags: flags?.length ?? 0,
    total_dollar_impact: totalDollarImpact,
    total_invoices: totalInvoices,
    invoices_last_30_days: invoicesLast30,
  });
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { vendor_id, location_id, min_pct } = req.query as Record<string, string>;
  const userId = req.user!.id;

  let invoiceQuery = supabase
    .from('invoices')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'parsed');

  if (vendor_id)   invoiceQuery = invoiceQuery.eq('vendor_id', vendor_id);
  if (location_id) invoiceQuery = invoiceQuery.eq('location_id', location_id);

  const { data: invoices } = await invoiceQuery;
  const invoiceIds = invoices?.map((i) => i.id) ?? [];
  if (invoiceIds.length === 0) { res.json([]); return; }

  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, normalized_item_name, raw_description, unit, quantity, invoice_id')
    .in('invoice_id', invoiceIds);
  const lineItemIds = lineItems?.map((li) => li.id) ?? [];
  if (lineItemIds.length === 0) { res.json([]); return; }

  let flagQuery = supabase
    .from('price_flags')
    .select('*')
    .in('line_item_id', lineItemIds)
    .order('estimated_dollar_impact', { ascending: false })
    .limit(500);

  if (min_pct) flagQuery = flagQuery.gte('pct_change', parseFloat(min_pct));

  const { data: flags } = await flagQuery;
  if (!flags || flags.length === 0) { res.json([]); return; }

  // Fetch invoice metadata for enrichment
  const { data: invoiceDetails } = await supabase
    .from('invoices')
    .select('id, invoice_date, uploaded_at, vendor_id, location_id, vendors(id, name), locations(id, name)')
    .in('id', invoiceIds);

  const invoiceMap = new Map((invoiceDetails ?? []).map((i) => [i.id, i]));
  const lineItemMap = new Map((lineItems ?? []).map((li) => [li.id, li]));

  const result = flags.map((f) => {
    const li = lineItemMap.get(f.line_item_id);
    const inv = li ? invoiceMap.get(li.invoice_id) : undefined;
    const vendor = inv ? (inv.vendors as unknown as { id: string; name: string } | null) : null;
    const location = inv ? (inv.locations as unknown as { id: string; name: string } | null) : null;
    return {
      ...f,
      normalized_item_name: li?.normalized_item_name,
      raw_description: li?.raw_description,
      unit: li?.unit,
      quantity: li?.quantity,
      invoice_id: inv?.id,
      invoice_date: inv?.invoice_date,
      uploaded_at: inv?.uploaded_at,
      vendor_id: vendor?.id,
      vendor_name: vendor?.name,
      location_id: location?.id,
      location_name: location?.name,
    };
  });

  res.json(result);
});

export default router;
