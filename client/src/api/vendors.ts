import api from './client';
import { Vendor } from '../types';

export async function getVendors(): Promise<Vendor[]> {
  const res = await api.get<Vendor[]>('/vendors');
  return res.data;
}

export async function createVendor(name: string): Promise<Vendor> {
  const res = await api.post<Vendor>('/vendors', { name });
  return res.data;
}
