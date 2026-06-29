import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { GeminiExtractionResult, GeminiLineItem } from '../types';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const EXTRACTION_PROMPT = `You are an expert invoice data extractor for restaurant distributors.
Extract all line items from this invoice and return ONLY a JSON object with this exact schema — no markdown fences, no explanation:

{
  "vendor_name": "string or null",
  "invoice_date": "YYYY-MM-DD string or null",
  "line_items": [
    {
      "raw_description": "exact product description text from invoice",
      "normalized_item_name": "lowercase product name, standardized (e.g. 'chicken breast boneless', 'romaine lettuce', 'olive oil extra virgin')",
      "unit": "unit of measure e.g. lb, case, each, oz, gal",
      "quantity": 1.0,
      "unit_price": 0.00,
      "line_total": 0.00
    }
  ]
}

Rules:
- normalized_item_name must be lowercase, no brand names, no size codes, consistent across invoices
- quantity and unit_price must be numbers (not strings); use 0 if unknown
- Include every product line item with a price; skip subtotals, fees, taxes, and header rows
- Return an empty line_items array if no line items can be found`;

function normalizeResult(obj: Record<string, unknown>): GeminiExtractionResult {
  const items = Array.isArray(obj.line_items) ? obj.line_items : [];
  return {
    vendor_name: typeof obj.vendor_name === 'string' ? obj.vendor_name : 'Unknown Vendor',
    invoice_date: typeof obj.invoice_date === 'string' ? obj.invoice_date : null,
    line_items: items
      .filter((li): li is Record<string, unknown> => typeof li === 'object' && li !== null)
      .map((li) => ({
        raw_description: typeof li.raw_description === 'string' ? li.raw_description : '',
        normalized_item_name: typeof li.normalized_item_name === 'string'
          ? li.normalized_item_name.toLowerCase().trim()
          : '',
        unit: typeof li.unit === 'string' ? li.unit : '',
        quantity: typeof li.quantity === 'number' ? li.quantity : 0,
        unit_price: typeof li.unit_price === 'number' ? li.unit_price : 0,
        line_total: typeof li.line_total === 'number' ? li.line_total : 0,
      }))
      .filter((li) => li.normalized_item_name && li.unit_price > 0),
  };
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

async function callGemini(buffer: Buffer, mimeType: string): Promise<GeminiExtractionResult> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
    { inlineData: { mimeType, data: buffer.toString('base64') } },
  ]);

  const text = result.response.text().trim();
  console.log('[gemini] raw response:', text.slice(0, 300));

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ExtractionError(`Invalid JSON from Gemini: ${text.slice(0, 200)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ExtractionError(`Unexpected response shape: ${text.slice(0, 200)}`);
  }

  return normalizeResult(parsed as Record<string, unknown>);
}

export async function extractInvoice(
  buffer: Buffer,
  mimeType: string
): Promise<GeminiExtractionResult> {
  try {
    return await callGemini(buffer, mimeType);
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    // Wait before retrying transient errors (503 overload, 429 rate limit)
    await new Promise((r) => setTimeout(r, 5000));
    try {
      return await callGemini(buffer, mimeType);
    } catch (retryErr) {
      throw new ExtractionError(
        `Gemini extraction failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`
      );
    }
  }
}
