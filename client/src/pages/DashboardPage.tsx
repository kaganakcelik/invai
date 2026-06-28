import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../components/StatCard';
import { FlagsTable } from '../components/FlagsTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getFlags, getFlagsSummary } from '../api/flags';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function DashboardPage() {
  const summary = useQuery({ queryKey: ['flags-summary'], queryFn: getFlagsSummary });
  const flags = useQuery({ queryKey: ['flags'], queryFn: () => getFlags() });

  if (summary.isLoading || flags.isLoading) return <LoadingSpinner />;

  const s = summary.data;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">Price increases detected across uploaded invoices</div>
      </div>

      <div className="stat-grid">
        <StatCard
          title="Estimated Overspend"
          value={s ? fmt(s.total_dollar_impact) : '—'}
          variant="loss"
          subtitle="sum of flagged price increases"
        />
        <StatCard
          title="Items Flagged"
          value={s?.total_flags ?? '—'}
          subtitle={`>${(0.05 * 100).toFixed(0)}% above 30-day baseline`}
        />
        <StatCard
          title="Invoices Parsed"
          value={s?.invoices_last_30_days ?? '—'}
          subtitle="last 30 days"
        />
        <StatCard
          title="Total Invoices"
          value={s?.total_invoices ?? '—'}
          subtitle="all time"
        />
      </div>

      <FlagsTable flags={flags.data ?? []} title="Top Price Increases" />
    </div>
  );
}
