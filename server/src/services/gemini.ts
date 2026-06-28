import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { GeminiExtractionResult, GeminiLineItem } from '../types';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const EXTRACTION_PROMPT = `You are an expert invoice data extractor for restaurant distributors.
Extract all line items from this invoice and return ONLY a JSON object with this exact schema — no markdown fences, no explanation:

{
  "vendor_name": "string (distributor name, e.g. Sysco, US Foods)",
  "invoice_date": "string in YYYY-MM-DD format, or null if not found",
  "line_items": [
    {
      "raw_description": "exact product description text from invoice",
      "normalized_item_name": "lowercase singular noun, standardized (e.g. 'chicken breast boneless', 'romaine lettuce', 'olive oil extra virgin')",
      "unit": "unit of measure e.g. lb, case, each, oz, gal",
      "quantity": 1.0,
      "unit_price": 0.00,
      "line_total": 0.00
    }
  ]
}

Rules:
- normalized_item_name must be consistent across invoices for the same product (lowercase, no brand names, no size codes)
- quantity and unit_price must be numbers (not strings)
- Include every line item with a unit price; skip subtotals, fees, taxes, and header rows
- If a value is missing or unclear, use null for strings or 0 for numbers`;

function isValidExtractionResult(obj: unknown): obj is GeminiExtractionResult {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.vendor_name !== 'string') return false;
  if (!Array.isArray(o.line_items)) return false;
  for (const item of o.line_items) {
    if (typeof item !== 'object' || item === null) return false;
    const li = item as Record<string, unknown>;
    if (typeof li.normalized_item_name !== 'string') return false;
  }
  return true;
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

async function callGemini(buffer: Buffer, mimeType: string): Promise<GeminiExtractionResult> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
    { inlineData: { mimeType, data: buffer.toString('base64') } },
  ]);

  const text = result.response.text().trim();
  const parsed: unknown = JSON.parse(text);

  if (!isValidExtractionResult(parsed)) {
    throw new ExtractionError('Gemini response does not match expected schema');
  }

  parsed.line_items = (parsed.line_items as GeminiLineItem[]).filter(
    (li) => li.normalized_item_name && (li.unit_price ?? 0) > 0
  );

  return parsed;
}

export async function extractInvoice(
  buffer: Buffer,
  mimeType: string
): Promise<GeminiExtractionResult> {
  try {
    return await callGemini(buffer, mimeType);
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    // Retry once on any other error (network glitch, transient Gemini issue)
    try {
      return await callGemini(buffer, mimeType);
    } catch (retryErr) {
      throw new ExtractionError(
        `Gemini extraction failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`
      );
    }
  }
}
