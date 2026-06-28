import db from '../db/client';
import { localAdapter as adapter } from '../storage/localAdapter';
import { extractInvoice, ExtractionError } from './gemini';
import { flagNewItems } from './baseline';
import { v4 as uuidv4 } from 'uuid';
import { Invoice } from '../types';

export async function processInvoice(invoice: Invoice, file: Express.Multer.File): Promise<void> {
  try {
    const filePath = await adapter.save(file);
    db.prepare('UPDATE invoices SET file_path = ? WHERE id = ?').run(filePath, invoice.id);

    const extraction = await extractInvoice(file.buffer, file.mimetype);

    db.prepare('UPDATE invoices SET raw_extraction_json = ?, invoice_date = ? WHERE id = ?').run(
      JSON.stringify(extraction),
      extraction.invoice_date ?? null,
      invoice.id
    );

    const insertItem = db.prepare(
      `INSERT INTO line_items (id, invoice_id, raw_description, normalized_item_name, unit, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    db.exec('BEGIN');
    try {
      for (const item of extraction.line_items) {
        insertItem.run(
          uuidv4(),
          invoice.id,
          item.raw_description ?? null,
          item.normalized_item_name.toLowerCase().trim(),
          item.unit ?? null,
          item.quantity ?? null,
          item.unit_price ?? null,
          item.line_total ?? null
        );
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    flagNewItems(db, invoice.id, invoice.vendor_id);

    db.prepare("UPDATE invoices SET status = 'parsed' WHERE id = ?").run(invoice.id);
    console.log(`Invoice ${invoice.id} parsed: ${extraction.line_items.length} items`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Invoice ${invoice.id} failed: ${message}`);
    db.prepare("UPDATE invoices SET status = 'failed' WHERE id = ?").run(invoice.id);
    throw err instanceof ExtractionError ? err : new Error(message);
  }
}
