import api from './client';
import { PriceFlag, FlagsSummary } from '../types';

export async function getFlags(params?: {
  vendor_id?: string;
  location_id?: string;
  min_pct?: number;
}): Promise<PriceFlag[]> {
  const res = await api.get<PriceFlag[]>('/flags', { params });
  return res.data;
}

export async function getFlagsSummary(): Promise<FlagsSummary> {
  const res = await api.get<FlagsSummary>('/flags/summary');
  return res.data;
}
