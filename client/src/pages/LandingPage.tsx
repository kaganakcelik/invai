import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  if (loading) return null;

  return (
    <div className="landing">
      {/* ── Nav ── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">inv<span>ai</span></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login" className="btn btn-secondary btn-sm">Sign in</Link>
            <Link to="/login" className="btn btn-primary btn-sm">Get started</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">

        {/* Float: Price Alert */}
        <div className="float-card" style={{ left: 'clamp(16px, 6%, 80px)', top: '14%', transform: 'rotate(-4deg)', width: 228 }}>
          <div className="float-card-header">
            <span style={{ color: 'var(--red)' }}>▲</span> Price Alert
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Chicken Breast</span>
              <span className="badge badge-flag">+14.3%</span>
            </div>
            <div className="float-card-meta">Was $2.84/lb → now $3.25/lb</div>
            <div className="float-card-meta" style={{ marginTop: 2 }}>Est. overspend: $41/mo</div>
          </div>
        </div>

        {/* Float: Weekly summary */}
        <div className="float-card" style={{ right: 'clamp(16px, 6%, 80px)', top: '11%', transform: 'rotate(3deg)', width: 200 }}>
          <div className="float-card-header">This Week</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              ['New flags', '3', 'var(--red)'],
              ['At risk', '$247', 'var(--red)'],
              ['Vendors monitored', '5', 'var(--text)'],
            ].map(([label, value, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Float: Invoice snippet */}
        <div className="float-card" style={{ left: 'clamp(16px, 3%, 60px)', bottom: '11%', transform: 'rotate(-2deg)', width: 264 }}>
          <div className="float-card-header">Fresh Direct — Jul 3</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
            {[
              { name: 'Chicken Thighs', price: '$1.89/lb', flag: null },
              { name: 'Romaine Lettuce', price: '$2.10/ea', flag: '+8%' },
              { name: 'Olive Oil 1gal', price: '$24.50', flag: null },
            ].map((item, i) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '5px 4px',
                  borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                  background: item.flag ? '#fef9f9' : 'transparent',
                  borderRadius: item.flag ? 4 : 0,
                  marginLeft: item.flag ? -4 : 0,
                  marginRight: item.flag ? -4 : 0,
                  paddingLeft: item.flag ? 8 : 4,
                  paddingRight: item.flag ? 8 : 4,
                }}
              >
                <span style={{ fontSize: 12 }}>{item.name}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{item.price}</span>
                  {item.flag && (
                    <span className="badge badge-flag" style={{ fontSize: 10, padding: '1px 6px' }}>
                      {item.flag}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Float: Stats */}
        <div className="float-card" style={{ right: 'clamp(16px, 4%, 64px)', bottom: '13%', transform: 'rotate(2deg)', width: 192 }}>
          <div className="float-card-header">Your Restaurants</div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              ['Vendors', '5'],
              ['Invoices analyzed', '127'],
              ['Savings identified', '$1,840'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center content */}
        <div className="landing-hero-content">
          <div className="landing-brand-icon">
            inv<span>ai</span>
          </div>
          <h1 className="landing-headline">
            Stop paying more.<br />
            <span className="landing-headline-muted">Know the moment it happens.</span>
          </h1>
          <p className="landing-subtext">
            invai monitors your vendor invoices and flags every price increase automatically — before the cost compounds.
          </p>
          <Link to="/login" className="btn btn-primary landing-cta">
            Get started free →
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features">
        <div className="landing-features-inner">
          {[
            {
              title: 'Automatic detection',
              body: 'Upload any invoice PDF or image. AI reads every line item and compares it against your 30-day pricing baseline.',
            },
            {
              title: 'Zero manual work',
              body: "Once a vendor appears twice, invai has a baseline. Every invoice after that is checked against it automatically.",
            },
            {
              title: 'Per-item granularity',
              body: 'See exactly which item changed, by how much, and the estimated monthly dollar impact — per location.',
            },
          ].map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-title">{f.title}</div>
              <div className="landing-feature-body">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>© 2026 invai</span>
        <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>
          Sign in →
        </Link>
      </footer>
    </div>
  );
}
