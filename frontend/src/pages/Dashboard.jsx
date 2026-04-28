import { useState, useEffect } from 'react';
import API from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [demandDelta, setDemandDelta] = useState(0);
  const [compDelta, setCompDelta] = useState(0);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get('/api/dashboard'),
      API.get('/api/analytics/forecast'),
    ]).then(([dashRes, fcRes]) => {
      setData(dashRes.data);
      setForecast(fcRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (demandDelta === 0 && compDelta === 0) { setScenario(null); return; }
    API.post('/api/dashboard/scenario', {
      demand_change_pct: demandDelta,
      competitor_price_change_pct: compDelta,
    }).then(res => setScenario(res.data));
  }, [demandDelta, compDelta]);

  if (loading) return <div className="main-content"><p style={{color:'var(--text-secondary)'}}>Loading dashboard...</p></div>;
  if (!data) return <div className="main-content"><p style={{color:'var(--red)'}}>Failed to load data.</p></div>;

  const { product, kpis, explanation } = data;
  const badgeClass = `badge badge-${kpis.action.toLowerCase()}`;

  const fcData = forecast ? [
    ...forecast.actual.map(d => ({ date: d.date.slice(5), actual: d.actual })),
    ...forecast.predicted.map(d => ({ date: d.date.slice(5), predicted: d.yhat, lower: d.yhat_lower, upper: d.yhat_upper })),
  ] : [];

  return (
    <div className="main-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Dashboard</h2>
          <p>AI-powered pricing recommendation for {product.name}</p>
        </div>
        <span className={badgeClass}>{kpis.action}</span>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Current Price</div>
          <div className="kpi-value">₹{kpis.current_price}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Recommended</div>
          <div className="kpi-value">₹{kpis.recommended_price}</div>
          <div className={`kpi-delta ${kpis.recommended_price >= kpis.current_price ? 'positive' : 'negative'}`}>
            ₹{kpis.recommended_price - kpis.current_price > 0 ? '+' : ''}{kpis.recommended_price - kpis.current_price}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Revenue Impact</div>
          <div className="kpi-value">{kpis.revenue_impact_pct > 0 ? '+' : ''}{kpis.revenue_impact_pct}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Confidence</div>
          <div className="kpi-value">{kpis.confidence}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Monthly Revenue</div>
          <div className="kpi-value">₹{Math.round(kpis.monthly_revenue).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Daily Demand</div>
          <div className="kpi-value">{Math.round(kpis.avg_daily_demand)} units</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Price Index</div>
          <div className="kpi-value">{kpis.price_index.toFixed(2)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Volatility (σ)</div>
          <div className="kpi-value">₹{kpis.volatility}</div>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="explanation-box">
        <strong>🧠 AI Insight:</strong> {explanation}
      </div>

      {/* Forecast Chart */}
      {fcData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>14-Day Demand Forecast</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={fcData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
              <Area dataKey="upper" fill="rgba(3,152,85,0.08)" stroke="none" />
              <Area dataKey="lower" fill="#F1F5F9" stroke="none" />
              <Line type="monotone" dataKey="actual" stroke="#7F56D9" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="predicted" stroke="#039855" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Scenario Testing */}
      <div className="scenario-panel">
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>🧪 Scenario Testing</h3>
          <div className="slider-group">
            <label><span>Demand Change</span><span>{demandDelta}%</span></label>
            <input type="range" min={-50} max={100} value={demandDelta} onChange={(e) => setDemandDelta(Number(e.target.value))} />
          </div>
          <div className="slider-group">
            <label><span>Competitor Price Change</span><span>{compDelta}%</span></label>
            <input type="range" min={-30} max={30} value={compDelta} onChange={(e) => setCompDelta(Number(e.target.value))} />
          </div>
          {scenario && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
              <div className="kpi-card"><div className="kpi-label">Price</div><div className="kpi-value" style={{fontSize:'1.3rem'}}>₹{scenario.recommended_price}</div></div>
              <div className="kpi-card"><div className="kpi-label">Action</div><div className="kpi-value" style={{fontSize:'1.3rem'}}>{scenario.action}</div></div>
              <div className="kpi-card"><div className="kpi-label">Impact</div><div className="kpi-value" style={{fontSize:'1.3rem'}}>{scenario.revenue_impact_pct}%</div></div>
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>⚙️ Pricing Breakdown</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rule-Based Price</span>
              <span style={{ fontWeight: 600 }}>₹{data.rule_price}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ML (XGBoost) Price</span>
              <span style={{ fontWeight: 600 }}>₹{data.ml_price}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Blended Price</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{kpis.recommended_price}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Trend</span>
              <span style={{ fontWeight: 600 }}>{kpis.price_trend}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
