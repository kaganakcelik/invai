import { supabase } from '../db/supabase';
import { localAdapter as adapter } from '../storage/localAdapter';
import { extractInvoice, ExtractionError } from './gemini';
import { flagNewItems } from './baseline';
import { v4 as uuidv4 } from 'uuid';
import { Invoice } from '../types';

export async function processInvoice(invoice: Invoice, file: Express.Multer.File): Promise<void> {
  try {
    const filePath = await adapter.save(file);
    await supabase.from('invoices').update({ file_path: filePath }).eq('id', invoice.id);

    const extraction = await extractInvoice(file.buffer, file.mimetype);

    await supabase.from('invoices').update({
      raw_extraction_json: JSON.stringify(extraction),
      invoice_date: extraction.invoice_date ?? null,
    }).eq('id', invoice.id);

    const lineItems = extraction.line_items.map((item) => ({
      id: uuidv4(),
      invoice_id: invoice.id,
      raw_description: item.raw_description ?? null,
      normalized_item_name: item.normalized_item_name.toLowerCase().trim(),
      unit: item.unit ?? null,
      quantity: item.quantity ?? null,
      unit_price: item.unit_price ?? null,
      line_total: item.line_total ?? null,
    }));

    if (lineItems.length > 0) {
      const { error } = await supabase.from('line_items').insert(lineItems);
      if (error) throw new Error(`Failed to insert line items: ${error.message}`);
    }

    await flagNewItems(supabase, invoice.user_id, invoice.id, invoice.vendor_id);

    await supabase.from('invoices').update({ status: 'parsed' }).eq('id', invoice.id);
    console.log(`Invoice ${invoice.id} parsed: ${extraction.line_items.length} items`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Invoice ${invoice.id} failed: ${message}`);
    await supabase.from('invoices').update({ status: 'failed' }).eq('id', invoice.id);
    throw err instanceof ExtractionError ? err : new Error(message);
  }
}
