import { useState, useEffect } from 'react';
import API from '../api/client';
import { RefreshCw } from 'lucide-react';

export default function MarketplaceInsights() {
  const [data, setData] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      API.get('/api/marketplace/prices'),
      API.get('/api/marketplace/comparison'),
    ]).then(([prRes, compRes]) => {
      setData(prRes.data);
      setComparison(compRes.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const refresh = () => {
    setRefreshing(true);
    API.post('/api/marketplace/refresh').then(() => {
      load();
      setRefreshing(false);
    });
  };

  if (loading) return <div className="main-content"><p style={{ color: 'var(--text-secondary)' }}>Loading marketplace data...</p></div>;

  const grouped = {};
  data?.prices.forEach(p => {
    if (!grouped[p.marketplace]) grouped[p.marketplace] = [];
    grouped[p.marketplace].push(p);
  });

  return (
    <div className="main-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Marketplace Insights</h2>
          <p>Real-time competitor intelligence across Amazon, Flipkart, Myntra, Ajio</p>
        </div>
        <button onClick={refresh} className="btn-primary" style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} className={refreshing ? 'spinning' : ''} /> Refresh Prices
        </button>
      </div>

      {/* Our price highlight */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderColor: 'rgba(108,92,231,0.3)' }}>
          <div className="kpi-label">Our Price</div>
          <div className="kpi-value" style={{ color: 'var(--accent-light)' }}>₹{data?.our_price}</div>
        </div>
        {comparison.map(c => (
          <div key={c.marketplace} className="kpi-card">
            <div className="kpi-label">{c.marketplace} Avg</div>
            <div className="kpi-value">₹{Math.round(c.avg_price)}</div>
            <div className={`kpi-delta ${c.avg_price > data?.our_price ? 'positive' : 'negative'}`}>
              {c.avg_price > data?.our_price ? 'Higher' : 'Lower'}
            </div>
          </div>
        ))}
      </div>

      {/* Price tables by marketplace */}
      {Object.entries(grouped).map(([marketplace, items]) => (
        <div key={marketplace} className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>
            {marketplace === 'Amazon' && '🛒'} {marketplace === 'Flipkart' && '🏪'} {marketplace === 'Myntra' && '👕'} {marketplace === 'Ajio' && '🏬'} {marketplace}
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Price (₹)</th>
                <th>Rating</th>
                <th>Discount (%)</th>
                <th>vs Our Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const diff = item.price - data.our_price;
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{item.brand}</td>
                    <td>₹{item.price}</td>
                    <td>⭐ {item.rating}</td>
                    <td>{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                    <td>
                      <span style={{ color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--yellow)', fontWeight: 600 }}>
                        {diff > 0 ? `+₹${diff}` : diff < 0 ? `₹${diff}` : 'Same'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
