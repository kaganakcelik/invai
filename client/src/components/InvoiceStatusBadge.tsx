import { InvoiceStatus } from '../types';

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}
