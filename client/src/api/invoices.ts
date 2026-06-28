import api from './client';
import { Invoice, InvoiceDetail } from '../types';

export async function getInvoices(params?: {
  location_id?: string;
  vendor_id?: string;
  status?: string;
}): Promise<Invoice[]> {
  const res = await api.get<Invoice[]>('/invoices', { params });
  return res.data;
}

export async function getInvoice(id: string): Promise<InvoiceDetail> {
  const res = await api.get<InvoiceDetail>(`/invoices/${id}`);
  return res.data;
}

export async function uploadInvoice(
  file: File,
  locationId: string,
  vendorId: string
): Promise<{ invoice_id: string; status: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('location_id', locationId);
  form.append('vendor_id', vendorId);
  const res = await api.post<{ invoice_id: string; status: string }>('/upload', form);
  return res.data;
}

export async function retryInvoice(id: string): Promise<{ invoice_id: string; status: string }> {
  const res = await api.post<{ invoice_id: string; status: string }>(`/invoices/${id}/retry`);
  return res.data;
}
