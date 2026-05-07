import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Brain, TrendingDown, TrendingUp, Package, Users, Zap, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import API from '../api/client';
import { useProduct } from '../context/ProductContext';

const TOOLTIP_STYLE = { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12 };
const ACCENT = '#8B5CF6';
const COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#EF4444'];

function Panel({ title, icon: Icon, color = ACCENT, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
        <span style={{ background: `${color}22`, borderRadius: 10, padding: 8, display: 'flex' }}><Icon size={18} color={color} /></span>
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1, textAlign: 'left' }}>{title}</span>
        {open ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </button>
      {open && <div style={{ padding: '0 24px 24px' }}>{children}</div>}
    </div>
  );
}

function Pill({ label, color = '#8B5CF6', bg }) {
  return <span style={{ background: bg || `${color}22`, color, borderRadius: 20, padding: '3px 12px', fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>;
}

function StatCard({ label, value, sub, color = '#fff' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 120 }}>
      <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: 6 }}>{label}</div>
      <div style={{ color, fontSize: '1.4rem', fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── A. Demand Forecast Panel ──────────────────────────────────────────────────
function ForecastPanel({ data }) {
  const { forecast, seasonal, models_used, lstm_available } = data;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {models_used.map(m => <Pill key={m} label={m} color="#8B5CF6" />)}
        {!lstm_available && <Pill label="LSTM: Unavailable (no TF)" color="#64748b" />}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={forecast} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#52525B', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
          <YAxis tick={{ fill: '#52525B', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
          <Line type="monotone" dataKey="xgb" name="XGBoost" stroke="#8B5CF6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="prophet" name="Prophet" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="5 4" />
          <Line type="monotone" dataKey="ensemble" name="Ensemble" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        <StatCard label="Best Day" value={seasonal.best_day_of_week} color="#10B981" />
        <StatCard label="Avg Demand" value={`${seasonal.avg_daily_demand} units`} color="#F59E0B" />
        <StatCard label="Std Dev" value={`±${seasonal.demand_std}`} color="#64748b" />
      </div>
      {seasonal.seasonal_spikes?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 8, fontWeight: 600 }}>🚀 Demand Spikes Detected</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {seasonal.seasonal_spikes.map((s, i) => (
              <div key={i} style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '8px 14px', fontSize: '0.78rem', color: '#a78bfa' }}>
                {s.date} · <strong>{s.units} units</strong> (+{s.pct_above_avg}%)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── B. Elasticity Panel ───────────────────────────────────────────────────────
function ElasticityPanel({ data }) {
  const { elasticity_coefficient, elasticity_curve, price_sensitivity_score, sensitivity_label, optimal_price_band, optimal_price, interpretation, tiers_used } = data;
  const scoreColor = price_sensitivity_score >= 70 ? '#EF4444' : price_sensitivity_score >= 40 ? '#F59E0B' : '#10B981';
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatCard label="Elasticity" value={elasticity_coefficient?.toFixed(3)} color={scoreColor} sub="Price elasticity of demand" />
        <StatCard label="Sensitivity" value={`${price_sensitivity_score}/100`} color={scoreColor} sub={sensitivity_label} />
        <StatCard label="Optimal Price" value={`₹${optimal_price}`} color="#8B5CF6" sub={`Band: ₹${optimal_price_band?.min}–₹${optimal_price_band?.max}`} />
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#94a3b8', fontSize: '0.83rem', borderLeft: `3px solid ${scoreColor}` }}>
        {interpretation}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={elasticity_curve} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="price" tick={{ fill: '#52525B', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
          <YAxis yAxisId="demand" tick={{ fill: '#52525B', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="revenue" orientation="right" tick={{ fill: '#52525B', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [n === 'revenue' ? `₹${v}` : v, n]} />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
          <Line yAxisId="demand" type="monotone" dataKey="demand" name="Demand" stroke="#8B5CF6" strokeWidth={2} dot={false} />
          <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue ₹" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="5 4" />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {tiers_used?.map(t => <Pill key={t} label={t} color="#6366f1" />)}
      </div>
    </div>
  );
}

// ── C. Competitor Reaction Panel ──────────────────────────────────────────────
const RESPONSE_META = {
  UNDERCUT:      { color: '#EF4444', label: '⚔️ Undercut', desc: 'Go below market price aggressively.' },
  MATCH:         { color: '#F59E0B', label: '🤝 Match',    desc: 'Match the market to stay competitive.' },
  PREMIUM_HOLD:  { color: '#10B981', label: '👑 Premium Hold', desc: 'Competitors weak — hold premium price.' },
  WAIT:          { color: '#6366f1', label: '⏳ Wait',     desc: 'Market stable. Monitor and re-evaluate.' },
};

function CompetitorPanel({ data }) {
  const { platforms, recommended_response, market_summary } = data;
  const meta = RESPONSE_META[recommended_response] || RESPONSE_META.WAIT;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}44`, borderRadius: 12, padding: '12px 20px', flex: 1 }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 4 }}>Recommended Response</div>
          <div style={{ color: meta.color, fontWeight: 800, fontSize: '1.1rem' }}>{meta.label}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 4 }}>{meta.desc}</div>
        </div>
        <StatCard label="Market Avg" value={`₹${market_summary?.avg_competitor_price}`} color="#94a3b8" sub={market_summary?.price_position?.replace('_', ' ')} />
        <StatCard label="Our Price" value={`₹${market_summary?.our_price}`} color="#8B5CF6" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Platform', 'Current', 'Predicted (7d)', 'Drop Prob', 'Aggression', 'Trend'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#52525b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms?.map(p => {
              const pred7 = p.predicted_prices?.[6]?.price;
              const drop  = p.price_drop_probability;
              const agg   = p.market_aggression_score;
              return (
                <tr key={p.platform} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 600 }}>{p.platform}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>₹{p.current_price}</td>
                  <td style={{ padding: '10px 12px', color: pred7 < p.current_price ? '#EF4444' : '#10B981' }}>₹{pred7}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: drop > 0.6 ? '#EF4444' : drop > 0.4 ? '#F59E0B' : '#10B981' }}>{(drop * 100).toFixed(0)}%</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6, width: 80 }}>
                      <div style={{ background: agg > 60 ? '#EF4444' : agg > 30 ? '#F59E0B' : '#10B981', width: `${agg}%`, height: '100%', borderRadius: 4 }} />
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}><Pill label={p.trend} color={p.trend === 'falling' ? '#EF4444' : p.trend === 'rising' ? '#10B981' : '#64748b'} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── D. Inventory Optimization Panel ──────────────────────────────────────────
const ACTION_COLORS = { RESTOCK_URGENT: '#EF4444', RESTOCK_SOON: '#F59E0B', MONITOR: '#10B981', OVERSTOCKED: '#6366f1', HOLD_PRICE: '#10B981', MARKDOWN_NOW: '#EF4444', MARKDOWN_SOON: '#F59E0B' };

function InventoryPanel({ data }) {
  const { days_of_cover, avg_daily_demand, stock, demand_trend, inventory_health_score, restock_recommendation, markdown_recommendation, clearance_price } = data;
  const healthColor = inventory_health_score >= 75 ? '#10B981' : inventory_health_score >= 40 ? '#F59E0B' : '#EF4444';
  const rColor = ACTION_COLORS[restock_recommendation?.action] || '#64748b';
  const mColor = ACTION_COLORS[markdown_recommendation?.action] || '#64748b';

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Days of Cover" value={days_of_cover} color={days_of_cover < 15 ? '#EF4444' : days_of_cover < 30 ? '#F59E0B' : '#10B981'} sub="at current demand velocity" />
        <StatCard label="Avg Daily Demand" value={`${avg_daily_demand} units`} color="#94a3b8" sub={`Trend: ${demand_trend}`} />
        <StatCard label="Current Stock" value={stock} color="#8B5CF6" />
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 120 }}>
          <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: 8 }}>Inventory Health</div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 10 }}>
            <div style={{ width: `${inventory_health_score}%`, height: '100%', background: healthColor, borderRadius: 8, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ color: healthColor, fontSize: '0.85rem', fontWeight: 700, marginTop: 6 }}>{inventory_health_score}/100</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: `${rColor}12`, border: `1px solid ${rColor}33`, borderRadius: 12, padding: '16px 18px' }}>
          <Pill label={restock_recommendation?.action} color={rColor} />
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 10 }}>{restock_recommendation?.message}</div>
          {restock_recommendation?.suggested_restock_qty > 0 && (
            <div style={{ color: rColor, fontSize: '0.9rem', fontWeight: 700, marginTop: 8 }}>Reorder: {restock_recommendation.suggested_restock_qty} units</div>
          )}
        </div>
        <div style={{ background: `${mColor}12`, border: `1px solid ${mColor}33`, borderRadius: 12, padding: '16px 18px' }}>
          <Pill label={markdown_recommendation?.action} color={mColor} />
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 10 }}>{markdown_recommendation?.message}</div>
          {markdown_recommendation?.suggested_discount_pct > 0 && (
            <div style={{ color: mColor, fontSize: '0.9rem', fontWeight: 700, marginTop: 8 }}>Suggested Discount: {markdown_recommendation.suggested_discount_pct}%</div>
          )}
        </div>
      </div>
      {clearance_price && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#6366f1', fontWeight: 700, fontSize: '0.85rem' }}>Clearance Price (sell 80% in 30d):</span>
          <span style={{ color: '#a78bfa', fontSize: '1.1rem', fontWeight: 800 }}>₹{clearance_price.price}</span>
          <Pill label={clearance_price.achievable ? '✓ Achievable' : '⚠ Below cost floor'} color={clearance_price.achievable ? '#10B981' : '#EF4444'} />
        </div>
      )}
    </div>
  );
}

// ── E. Customer Segmentation Panel ────────────────────────────────────────────
function SegmentationPanel({ data }) {
  const { segments, dominant_segment, impulse_days_pct, personalization_insights } = data;

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Pie data={segments} dataKey="size_pct" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
              {segments.map((s, i) => <Cell key={s.name} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v}%`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {segments.map((s, i) => (
            <div key={s.name} style={{ background: `${COLORS[i]}12`, border: `1px solid ${COLORS[i]}33`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.3rem' }}>{s.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>{s.name.replace('_', ' ')}</span>
                  <Pill label={`${s.size_pct}%`} color={COLORS[i]} />
                  {s.name === dominant_segment && <Pill label="Dominant" color="#F59E0B" />}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{s.description}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: COLORS[i], fontWeight: 700, fontSize: '0.85rem' }}>₹{s.avg_willingness_to_pay?.toFixed(0)}</div>
                <div style={{ color: '#52525b', fontSize: '0.72rem' }}>avg WTP</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 12, padding: '14px 18px', marginTop: 16, color: '#a78bfa', fontSize: '0.83rem', lineHeight: 1.6 }}>
        🧠 <strong>AI Insight:</strong> {personalization_insights}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <StatCard label="Impulse Days" value={`${impulse_days_pct}%`} color="#EF4444" sub="DBSCAN outlier detection" />
        <StatCard label="Segments" value="4" color="#8B5CF6" sub="K-Means clustering" />
        <StatCard label="Dominant" value={dominant_segment?.replace('_', ' ')} color="#F59E0B" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MLPredictions() {
  const { activeProduct } = useProduct();
  const productId = activeProduct?.id || 'vs-essential-cotton-tee';

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = (forceRefresh = false) => {
    setLoading(!data);
    setRefreshing(!!data);
    setError(null);
    API.get('/api/ml/predictions', { params: { product_id: productId, refresh: forceRefresh } })
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load ML predictions. Ensure the backend is running.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { fetchData(); }, [productId]);

  if (loading) return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
      <div style={{ width: 48, height: 48, border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Running 5 ML models…</div>
      <div style={{ color: '#475569', fontSize: '0.78rem' }}>XGBoost · Prophet · K-Means · DBSCAN</div>
    </div>
  );

  if (error) return (
    <div className="main-content">
      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 24, color: '#fca5a5', textAlign: 'center' }}>{error}</div>
    </div>
  );

  return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9' }}>ML Prediction Engine</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            {data?.product_name} · 5 models · computed {data?.computed_at ? new Date(data.computed_at).toLocaleTimeString() : ''}
            {data?.cached && <span style={{ color: '#475569', marginLeft: 8 }}>(cached)</span>}
          </p>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: '8px 16px', color: '#a78bfa', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600 }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh Models'}
        </button>
      </div>

      {data?.demand_forecast && (
        <Panel title="A. Demand Forecasting Ensemble" icon={TrendingUp} color="#8B5CF6">
          <ForecastPanel data={data.demand_forecast} />
        </Panel>
      )}
      {data?.elasticity && (
        <Panel title="B. Price Elasticity Intelligence" icon={Zap} color="#F59E0B" defaultOpen={false}>
          <ElasticityPanel data={data.elasticity} />
        </Panel>
      )}
      {data?.competitor && (
        <Panel title="C. Competitor Reaction Model" icon={TrendingDown} color="#EF4444" defaultOpen={false}>
          <CompetitorPanel data={data.competitor} />
        </Panel>
      )}
      {data?.inventory && (
        <Panel title="D. Inventory Optimization" icon={Package} color="#10B981" defaultOpen={false}>
          <InventoryPanel data={data.inventory} />
        </Panel>
      )}
      {data?.segmentation && (
        <Panel title="E. Customer Segmentation (K-Means + DBSCAN)" icon={Users} color="#6366F1" defaultOpen={false}>
          <SegmentationPanel data={data.segmentation} />
        </Panel>
      )}
    </div>
  );
}
