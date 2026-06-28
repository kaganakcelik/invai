interface StatCardProps {
  title: string;
  value: string | number;
  variant?: 'default' | 'loss' | 'positive';
  subtitle?: string;
}

export function StatCard({ title, value, variant = 'default', subtitle }: StatCardProps) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className={`stat-value ${variant !== 'default' ? variant : ''}`}>{value}</div>
      {subtitle && <div className="text-muted mt-16" style={{ fontSize: 12 }}>{subtitle}</div>}
    </div>
  );
}
