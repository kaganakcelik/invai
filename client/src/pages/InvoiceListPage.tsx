import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getInvoices, retryInvoice } from '../api/invoices';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function InvoiceListPage() {
  const qc = useQueryClient();
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: () => getInvoices() });

  const retry = useMutation({
    mutationFn: (id: string) => retryInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  if (invoices.isLoading) return <LoadingSpinner />;

  const list = invoices.data ?? [];

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">All Invoices</div>
            <div className="page-subtitle">{list.length} invoice{list.length !== 1 ? 's' : ''} total</div>
          </div>
          <Link to="/upload" className="btn btn-primary">Upload Invoice</Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            No invoices yet.{' '}
            <Link to="/upload" style={{ color: 'var(--accent-blue)' }}>Upload your first invoice</Link>.
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Uploaded</th>
                <th>Vendor</th>
                <th>Location</th>
                <th>Invoice Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => (
                <tr key={inv.id}>
                  <td className="text-muted">{formatDate(inv.uploaded_at)}</td>
                  <td>{inv.vendor_name ?? '—'}</td>
                  <td>{inv.location_name ?? '—'}</td>
                  <td className="text-muted">{inv.invoice_date ?? '—'}</td>
                  <td><InvoiceStatusBadge status={inv.status} /></td>
                  <td>
                    <div className="flex gap-8">
                      <Link to={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm">
                        View
                      </Link>
                      {inv.status === 'failed' && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(inv.id)}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
