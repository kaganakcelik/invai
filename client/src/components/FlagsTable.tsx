import { PriceFlag } from '../types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

interface FlagsTableProps {
  flags: PriceFlag[];
  title?: string;
}

export function FlagsTable({ flags, title = 'Price Flags' }: FlagsTableProps) {
  if (flags.length === 0) {
    return (
      <div className="table-container">
        <div className="table-header">{title}</div>
        <div className="empty-state">No price flags found — not enough history yet, or prices are stable.</div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="table-header">{title} <span className="text-muted" style={{ fontSize: 13, fontWeight: 400 }}>({flags.length})</span></div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Vendor</th>
              <th>Location</th>
              <th className="text-right">Baseline</th>
              <th className="text-right">Current</th>
              <th className="text-right">Change</th>
              <th className="text-right">Est. Overspend</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id} className="flagged-row">
                <td>
                  <div style={{ fontWeight: 500 }}>{f.normalized_item_name ?? '—'}</div>
                  {f.raw_description && (
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{f.raw_description}</div>
                  )}
                </td>
                <td>{f.vendor_name ?? '—'}</td>
                <td>{f.location_name ?? '—'}</td>
                <td className="text-right">{fmt(f.baseline_price)}</td>
                <td className="text-right">{fmt(f.current_price)}</td>
                <td className="text-right">
                  <span className={f.pct_change >= 0 ? 'pct-increase' : 'pct-decrease'}>
                    {pct(f.pct_change)}
                  </span>
                </td>
                <td className="text-right dollar-loss">{fmt(f.estimated_dollar_impact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
