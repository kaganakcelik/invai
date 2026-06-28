import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoice, retryInvoice } from '../api/invoices';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { LineItem, PriceFlag } from '../types';

function fmt(n: number | null) {
  if (n === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id!),
    refetchInterval: (q) => {
      const status = q.state.data?.invoice?.status;
      return status === 'pending' ? 2000 : false;
    },
  });

  const retry = useMutation({
    mutationFn: () => retryInvoice(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', id] }),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <div className="alert alert-error">Invoice not found.</div>;

  const { invoice, line_items, price_flags } = data;

  const flagByLineItem = new Map<string, PriceFlag>();
  for (const f of price_flags) flagByLineItem.set(f.line_item_id, f);

  const isImage = invoice.file_path?.match(/\.(jpg|jpeg|png|webp)$/i);
  const isPdf = invoice.file_path?.match(/\.pdf$/i);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-12">
          <Link to="/invoices" className="text-muted" style={{ textDecoration: 'none', fontSize: 13 }}>
            ← All Invoices
          </Link>
        </div>
        <div className="flex items-center justify-between mt-16">
          <div>
            <div className="page-title">{invoice.vendor_name} — {invoice.location_name}</div>
            <div className="page-subtitle">
              Uploaded {formatDate(invoice.uploaded_at)}
              {invoice.invoice_date && ` · Invoice date: ${invoice.invoice_date}`}
              {' · '}<InvoiceStatusBadge status={invoice.status} />
            </div>
          </div>
          {invoice.status === 'failed' && (
            <button
              className="btn btn-danger"
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              {retry.isPending ? 'Retrying…' : 'Retry Extraction'}
            </button>
          )}
        </div>
      </div>

      {invoice.status === 'pending' && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <span className="spinner-dot" style={{ display: 'inline-block', marginRight: 8 }} />
          Extraction in progress…
        </div>
      )}

      {price_flags.length > 0 && (
        <div className="alert alert-error mb-24" style={{ marginBottom: 20 }}>
          <strong>{price_flags.length} price flag{price_flags.length !== 1 ? 's' : ''}</strong> detected —
          estimated overspend:{' '}
          <strong>
            {fmt(price_flags.reduce((s, f) => s + f.estimated_dollar_impact, 0))}
          </strong>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: invoice.file_path ? '1fr 340px' : '1fr', gap: 20 }}>
        <div>
          {line_items.length === 0 && invoice.status !== 'pending' ? (
            <div className="table-container">
              <div className="empty-state">No line items extracted.</div>
            </div>
          ) : (
            <div className="table-container">
              <div className="table-header">
                Line Items
                <span className="text-muted" style={{ fontSize: 13, fontWeight: 400 }}>
                  ({line_items.length})
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Normalized Name</th>
                      <th className="text-right">Qty</th>
                      <th>Unit</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {line_items.map((li: LineItem) => {
                      const flag = flagByLineItem.get(li.id);
                      const isExpanded = expandedFlag === li.id;
                      return (
                        <>
                          <tr
                            key={li.id}
                            className={flag ? 'flagged-row' : ''}
                            style={{ cursor: flag ? 'pointer' : 'default' }}
                            onClick={() => flag && setExpandedFlag(isExpanded ? null : li.id)}
                          >
                            <td>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 220 }}>
                                {li.raw_description ?? '—'}
                              </div>
                            </td>
                            <td style={{ fontWeight: 500 }}>{li.normalized_item_name}</td>
                            <td className="text-right">{li.quantity ?? '—'}</td>
                            <td>{li.unit ?? '—'}</td>
                            <td className="text-right">{fmt(li.unit_price)}</td>
                            <td className="text-right">{fmt(li.line_total)}</td>
                            <td>
                              {flag && (
                                <span className="badge badge-flag">
                                  {pct(flag.pct_change)}
                                </span>
                              )}
                            </td>
                          </tr>
                          {flag && isExpanded && (
                            <tr key={`${li.id}-detail`}>
                              <td colSpan={7} style={{ padding: '4px 16px 12px' }}>
                                <div className="flag-detail-panel">
                                  <div className="flag-detail-grid">
                                    <div className="flag-detail-item">
                                      <label>Baseline (30-day avg)</label>
                                      <div className="value">{fmt(flag.baseline_price)}</div>
                                    </div>
                                    <div className="flag-detail-item">
                                      <label>Current Price</label>
                                      <div className="value dollar-loss">{fmt(flag.current_price)}</div>
                                    </div>
                                    <div className="flag-detail-item">
                                      <label>Price Change</label>
                                      <div className="value pct-increase">{pct(flag.pct_change)}</div>
                                    </div>
                                    <div className="flag-detail-item">
                                      <label>Estimated Overspend</label>
                                      <div className="value dollar-loss">{fmt(flag.estimated_dollar_impact)}</div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {invoice.file_path && (
          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-header" style={{ borderBottom: '1px solid var(--border)' }}>
                Original Invoice
              </div>
              {isPdf && (
                <iframe
                  src={`/api/files/${invoice.file_path}`}
                  title="Invoice PDF"
                  style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
                />
              )}
              {isImage && (
                <img
                  src={`/api/files/${invoice.file_path}`}
                  alt="Invoice"
                  style={{ width: '100%', display: 'block' }}
                />
              )}
              {!isPdf && !isImage && (
                <div style={{ padding: 16 }}>
                  <a
                    href={`/api/files/${invoice.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
