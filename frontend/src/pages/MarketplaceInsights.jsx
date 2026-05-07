import { useState, useEffect, useCallback } from 'react';
import API from '../api/client';
import { useProduct } from '../context/ProductContext';
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, Package, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const MP_ICON = { Amazon: '🛒', Flipkart: '🏪', Myntra: '👕', Ajio: '🏬' };
const MP_COLOR = {
  Amazon:   { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  Flipkart: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  Myntra:   { bg: '#FDF4FF', border: '#E9D5FF', text: '#7E22CE' },
  Ajio:     { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
};

export default function MarketplaceInsights() {
  const { activeProduct } = useProduct();
  const [mpData, setMpData]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');
  const [sortColumn, setSortColumn] = useState('price');
  const [sortDirection, setSortDirection] = useState('asc');

  const productId = activeProduct?.id || 'vs-essential-cotton-tee';

  const load = useCallback((pid) => {
    setLoading(true);
    setError('');
    API.get(`/api/marketplace/${pid}`)
      .then(res => {
        setMpData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load marketplace data. Make sure the backend is running.');
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(productId); }, [productId, load]);

  const refresh = () => {
    setRefreshing(true);
    load(productId);
    setTimeout(() => setRefreshing(false), 1200);
  };

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '48px 0' }}>
        <div className="spinner" style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Loading marketplace intelligence…
      </div>
    </div>
  );

  /* ── Error ───────────────────────────────────────────────────────────── */
  if (error) return (
    <div className="main-content">
      <div className="page-header"><h2>Marketplace Insights</h2><p>Real-time competitor intelligence</p></div>
      <div className="card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--red)' }}>{error}</div>
    </div>
  );

  /* ── No data ─────────────────────────────────────────────────────────── */
  if (!mpData || !mpData.prices?.length) return (
    <div className="main-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Marketplace Insights</h2>
          <p>Real-time competitor intelligence across Amazon, Flipkart, Myntra, Ajio</p>
        </div>
        <button onClick={refresh} className="btn-primary" style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} className={refreshing ? 'spinning' : ''} /> Refresh
        </button>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '60px 0' }}>
        <Package size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>No marketplace data found for this product yet.</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Go to the <strong>Scraper</strong> page and run a competitor scan to populate this view.
        </p>
      </div>
    </div>
  );

  const { our_price, product_name, prices, comparison, total, last_updated } = mpData;

  /* Group by marketplace */
  const grouped = {};
  prices.forEach(p => {
    if (!grouped[p.marketplace]) grouped[p.marketplace] = [];
    grouped[p.marketplace].push(p);
  });

  const cheaperCount = prices.filter(p => p.price < our_price).length;
  const pricierCount = prices.filter(p => p.price > our_price).length;
  const avgCompPrice = prices.length ? Math.round(prices.reduce((s, p) => s + p.price, 0) / prices.length) : 0;
  const minCompPrice = prices.length ? Math.min(...prices.map(p => p.price)) : 0;
  const maxCompPrice = prices.length ? Math.max(...prices.map(p => p.price)) : 0;

  // Price distribution chart data (6 buckets)
  const priceRange = maxCompPrice - minCompPrice || 100;
  const bucketSize = priceRange / 6;
  const distribution = [];
  for (let i = 0; i < 6; i++) {
    const bucketMin = Math.round(minCompPrice + i * bucketSize);
    const bucketMax = Math.round(minCompPrice + (i + 1) * bucketSize);
    const count = prices.filter(p => p.price >= bucketMin && p.price < bucketMax).length;
    distribution.push({
      range: `₹${bucketMin}-${bucketMax}`,
      count,
      bucketMin,
      bucketMax
    });
  }

  // Sorting logic for competitor table
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedPrices = [...prices].sort((a, b) => {
    let valA = a[sortColumn];
    let valB = b[sortColumn];
    
    if (sortColumn === 'vs_ours') {
      valA = a.price - our_price;
      valB = b.price - our_price;
    }
    
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const ttStyle = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    color: '#0F172A',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    fontSize: '0.82rem',
  };
  const axisStyle = { stroke: '#CBD5E1', fontSize: 11 };
  const gridStyle = { strokeDasharray: '3 3', stroke: 'rgba(0,0,0,0.05)' };

  return (
    <div className="main-content">

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Marketplace Insights</h2>
          <p>Real-time competitor intelligence for <strong>{product_name}</strong></p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            padding: '6px 12px',
            borderRadius: 20,
            fontSize: '0.75rem',
            fontWeight: 600,
            background: last_updated ? '#dcfce7' : '#f1f5f9',
            color: last_updated ? '#166534' : '#64748b'
          }}>
            {last_updated ? '● LIVE' : '○ SAMPLE'}
          </span>
          {last_updated && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Updated {new Date(last_updated).toLocaleTimeString()}
            </span>
          )}
          <button onClick={refresh} className="btn-primary" style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Min Competitor Price</div>
          <div className="kpi-value">₹{minCompPrice}</div>
          <div className="kpi-delta" style={{ color: 'var(--text-secondary)' }}>Lowest in market</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Competitor Price</div>
          <div className="kpi-value">₹{avgCompPrice}</div>
          <div className={`kpi-delta ${avgCompPrice > our_price ? 'positive' : 'negative'}`}>
            {avgCompPrice > our_price ? '▲ Higher than us' : '▼ Lower than us'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Max Competitor Price</div>
          <div className="kpi-value">₹{maxCompPrice}</div>
          <div className="kpi-delta" style={{ color: 'var(--text-secondary)' }}>Highest in market</div>
        </div>
      </div>

      {/* Platform Comparison Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
        {comparison.map(c => {
          const mc = MP_COLOR[c.marketplace] || { bg: '#F8FAFC', border: '#E2E8F0', text: '#334155' };
          const diff = c.avg_price - our_price;
          return (
            <div key={c.marketplace} style={{
              background: mc.bg, border: `1px solid ${mc.border}`,
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>{MP_ICON[c.marketplace] || '🏬'}</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: mc.text }}>{c.marketplace}</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginBottom: 2 }}>
                ₹{c.avg_price}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: 8 }}>
                ₹{c.min_price} – ₹{c.max_price} · {c.count} listings
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.75rem', fontWeight: 600,
                color: diff > 0 ? '#10B981' : diff < 0 ? '#F43F5E' : '#6B7280',
              }}>
                {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                {diff > 0 ? `+₹${Math.abs(Math.round(diff))} above us` : diff < 0 ? `₹${Math.abs(Math.round(diff))} below us` : 'Same as us'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Price Distribution Chart */}
      <div className="card chart-card" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
          Price Distribution (Competitor Listings)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={distribution}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="range" {...axisStyle} />
            <YAxis {...axisStyle} label={{ value: 'Number of Listings', angle: -90, position: 'insideLeft' }} />
            <Tooltip contentStyle={ttStyle} />
            <ReferenceLine x={our_price} stroke="#6366f1" strokeDasharray="3 3" label={{ value: 'Our Price', position: 'top' }} />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Competitor Table */}
      <div className="card" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Competitor Listings
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 8 }}>
            (Click headers to sort)
          </span>
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('marketplace')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Platform {sortColumn === 'marketplace' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Product Title {sortColumn === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('price')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Price (₹) {sortColumn === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('vs_ours')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                vs Vouge Studio {sortColumn === 'vs_ours' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {sortedPrices.map((item, idx) => {
              const diff = Math.round(item.price - our_price);
              const diffPct = Math.round((diff / our_price) * 100);
              const isHigher = diff > 0;
              const isLower = diff < 0;
              return (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ marginRight: 6 }}>{MP_ICON[item.marketplace] || '🏬'}</span>
                    {item.marketplace}
                  </td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {item.title || '—'}
                  </td>
                  <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>₹{item.price}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontWeight: 600, fontSize: '0.82rem',
                      color: isHigher ? '#10B981' : isLower ? '#F43F5E' : '#6B7280',
                    }}>
                      {isHigher ? <TrendingUp size={12} /> : isLower ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {isHigher ? `+${diffPct}%` : isLower ? `${diffPct}%` : '0%'}
                    </span>
                  </td>
                  <td>
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: '0.78rem', textDecoration: 'none' }}>
                        View <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Price Tables Per Marketplace */}
      {Object.entries(grouped).map(([marketplace, items]) => {
        const mc = MP_COLOR[marketplace] || { bg: '#F8FAFC', border: '#E2E8F0', text: '#334155' };
        return (
          <div key={marketplace} className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: mc.text }}>
              <span style={{ fontSize: '1.1rem' }}>{MP_ICON[marketplace] || '🏬'}</span>
              {marketplace}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 4 }}>
                ({items.length} listings)
              </span>
            </h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Merchant / Brand</th>
                  <th>Title</th>
                  <th>Price (₹)</th>
                  <th>vs Our Price</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const diff = Math.round(item.price - our_price);
                  const isHigher = diff > 0;
                  const isLower = diff < 0;
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.brand || '—'}
                      </td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {item.title || '—'}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>₹{item.price}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontWeight: 600, fontSize: '0.82rem',
                          color: isHigher ? '#10B981' : isLower ? '#F43F5E' : '#6B7280',
                        }}>
                          {isHigher ? <TrendingUp size={12} /> : isLower ? <TrendingDown size={12} /> : <Minus size={12} />}
                          {isHigher ? `+₹${diff}` : isLower ? `-₹${Math.abs(diff)}` : 'Same'}
                        </span>
                      </td>
                      <td>
                        {item.link ? (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: '0.78rem', textDecoration: 'none' }}>
                            View <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Source Note */}
      <div style={{ padding: '0.75rem 1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: '0.78rem', color: '#64748B' }}>
        <ShoppingCart size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
        Data populated by the <strong>Live Competitor Scraper</strong> (four-tier: SerpApi → Playwright → Selenium → Static).
        Run a fresh scan on the Scraper page to update competitor prices.
      </div>
    </div>
  );
}
