import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { PriceFlag } from '../types';

interface BaselineResult {
  baseline: number;
  count: number;
}

async function computeBaseline(
  supabase: SupabaseClient,
  userId: string,
  normalizedItemName: string,
  vendorId: string,
  excludeInvoiceId: string,
  asOfDate: string
): Promise<BaselineResult | null> {
  const thirtyDaysAgo = new Date(new Date(asOfDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .eq('status', 'parsed')
    .neq('id', excludeInvoiceId)
    .gte('uploaded_at', thirtyDaysAgo);

  if (!invoices || invoices.length === 0) return null;

  const invoiceIds = invoices.map((i) => i.id);

  const { data: items } = await supabase
    .from('line_items')
    .select('unit_price')
    .in('invoice_id', invoiceIds)
    .eq('normalized_item_name', normalizedItemName)
    .gt('unit_price', 0);

  if (!items || items.length < 2) return null;

  const avg = items.reduce((sum, i) => sum + (i.unit_price as number), 0) / items.length;
  return { baseline: avg, count: items.length };
}

export async function flagNewItems(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  vendorId: string
): Promise<PriceFlag[]> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('uploaded_at')
    .eq('id', invoiceId)
    .single();

  if (!invoice) return [];

  const { data: items } = await supabase
    .from('line_items')
    .select('id, normalized_item_name, unit_price, quantity')
    .eq('invoice_id', invoiceId);

  if (!items) return [];

  const flagsToInsert: PriceFlag[] = [];

  for (const item of items) {
    if (!item.unit_price || item.unit_price <= 0) continue;

    const result = await computeBaseline(
      supabase,
      userId,
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

    flagsToInsert.push({
      id: uuidv4(),
      line_item_id: item.id,
      baseline_price: result.baseline,
      current_price: item.unit_price,
      pct_change: pctChange,
      estimated_dollar_impact: dollarImpact,
      created_at: new Date().toISOString(),
    });
  }

  if (flagsToInsert.length > 0) {
    await supabase.from('price_flags').insert(flagsToInsert);
  }

  return flagsToInsert;
}
