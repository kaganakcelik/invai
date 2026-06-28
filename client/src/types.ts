export type InvoiceStatus = 'pending' | 'parsed' | 'failed';

export interface Location {
  id: string;
  name: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  location_id: string;
  vendor_id: string;
  invoice_date: string | null;
  file_path: string;
  raw_extraction_json: string | null;
  uploaded_at: string;
  status: InvoiceStatus;
  location_name?: string;
  vendor_name?: string;
}

export interface LineItem {
  id: string;
  invoice_id: string;
  raw_description: string | null;
  normalized_item_name: string;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  created_at: string;
}

export interface PriceFlag {
  id: string;
  line_item_id: string;
  baseline_price: number;
  current_price: number;
  pct_change: number;
  estimated_dollar_impact: number;
  created_at: string;
  // Joined fields from flags list endpoint
  normalized_item_name?: string;
  raw_description?: string;
  unit?: string;
  quantity?: number;
  invoice_id?: string;
  invoice_date?: string;
  uploaded_at?: string;
  vendor_id?: string;
  vendor_name?: string;
  location_id?: string;
  location_name?: string;
}

export interface FlagsSummary {
  total_flags: number;
  total_dollar_impact: number;
  total_invoices: number;
  invoices_last_30_days: number;
}

export interface InvoiceDetail {
  invoice: Invoice;
  line_items: LineItem[];
  price_flags: PriceFlag[];
}
