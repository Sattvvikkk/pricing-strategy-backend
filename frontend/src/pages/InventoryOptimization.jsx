import { useEffect, useState, useCallback } from 'react';
import {
  Package, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, DollarSign, Target,
  ShoppingCart, BarChart3, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';

// ─────────────────────────────────────────────────────────────────────────────

const URGENCY_META = {
  critical: { color: '#EF4444', label: 'Critical', bg: 'rgba(239,68,68,0.1)' },
  warning:  { color: '#F59E0B', label: 'Warning',  bg: 'rgba(245,158,11,0.1)' },
  low:      { color: '#10B981', label: 'Low',      bg: 'rgba(16,185,129,0.1)' },
  info:     { color: '#3B82F6', label: 'Info',     bg: 'rgba(59,130,246,0.1)' },
};

const TREND_ICONS = {
  rising:  { Icon: TrendingUp,   color: '#10B981' },
  falling: { Icon: TrendingDown, color: '#EF4444' },
  stable:  { Icon: Minus,        color: '#9CA3AF' },
};

function fmt(price) {
  if (price == null || Number.isNaN(price)) return '—';
  return `₹${Number(price).toFixed(0)}`;
}

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HealthRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const progress = ((score || 0) / 100) * circ;
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="io-health-ring">
      <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} />
        <circle
          cx={60} cy={60} r={r} fill="none"
          stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${progress} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="io-health-ring__center">
        <div className="io-health-ring__score" style={{ color }}>{score || 0}</div>
        <div className="io-health-ring__label">Health</div>
      </div>
    </div>
  );
}

function DaysOfCoverCard({ days, trend }) {
  const trendMeta = TREND_ICONS[trend] || TREND_ICONS.stable;
  const TrendIcon = trendMeta.Icon;

  let status = 'info';
  if (days <= 7) status = 'critical';
  else if (days <= 30) status = 'warning';
  else if (days <= 90) status = 'low';

  const meta = URGENCY_META[status];

  return (
    <div className="io-card io-card--cover">
      <div className="io-card__head">
        <Clock size={16} className="io-card__icon" />
        <span className="io-card__title">Days of Cover</span>
        <div className={`io-card__trend io-card__trend--${trend}`} style={{ color: trendMeta.color }}>
          <TrendIcon size={14} /> {trend}
        </div>
      </div>
      <div className="io-card__value" style={{ color: meta.color }}>{fmtNum(days)}</div>
      <div className="io-card__sub">{meta.label}</div>
    </div>
  );
}

function RestockCard({ rec }) {
  const meta = URGENCY_META[rec.urgency] || URGENCY_META.info;

  return (
    <div className="io-card io-card--restock">
      <div className="io-card__head">
        <Package size={16} className="io-card__icon" />
        <span className="io-card__title">Restock Recommendation</span>
      </div>
      <div className="io-card__action" style={{ color: meta.color }}>{rec.action.replace('_', ' ')}</div>
      <div className="io-card__msg">{rec.message}</div>
      {rec.suggested_restock_qty > 0 && (
        <div className="io-card__qty">
          Suggested quantity: <strong>{rec.suggested_restock_qty.toLocaleString()}</strong> units
        </div>
      )}
    </div>
  );
}

function MarkdownCard({ rec }) {
  let status = 'info';
  if (rec.action === 'MARKDOWN_NOW') status = 'critical';
  else if (rec.action === 'MARKDOWN_SOON') status = 'warning';

  const meta = URGENCY_META[status] || URGENCY_META.info;

  return (
    <div className="io-card io-card--markdown">
      <div className="io-card__head">
        <DollarSign size={16} className="io-card__icon" />
        <span className="io-card__title">Markdown Strategy</span>
      </div>
      <div className="io-card__action" style={{ color: meta.color }}>{rec.action.replace('_', ' ')}</div>
      <div className="io-card__msg">{rec.message}</div>
      {rec.suggested_discount_pct > 0 && (
        <div className="io-card__discount">
          Discount: <strong>{rec.suggested_discount_pct}%</strong> → {fmt(rec.markdown_price)}
        </div>
      )}
      {rec.target_clearance_days && (
        <div className="io-card__clearance">Target clearance: {rec.target_clearance_days} days</div>
      )}
    </div>
  );
}

function ClearanceCard({ rec }) {
  const achievable = rec.achievable;

  return (
    <div className="io-card io-card--clearance">
      <div className="io-card__head">
        <Target size={16} className="io-card__icon" />
        <span className="io-card__title">Clearance Pricing</span>
      </div>
      <div className="io-card__price" style={{ color: achievable ? '#10B981' : '#EF4444' }}>
        {fmt(rec.price)}
      </div>
      <div className="io-card__msg">
        {achievable
          ? 'Achievable within 30 days with demand boost'
          : 'Not achievable without additional demand drivers'}
      </div>
    </div>
  );
}

function DemandChart({ demand, trend }) {
  const trendMeta = TREND_ICONS[trend] || TREND_ICONS.stable;
  const TrendIcon = trendMeta.Icon;

  const data = [
    { name: 'Current', value: demand },
    { name: 'Target', value: demand * 1.5 },
  ];

  return (
    <div className="io-chart-card">
      <div className="io-chart-card__head">
        <BarChart3 size={16} className="io-chart-card__icon" />
        <span className="io-chart-card__title">Avg Daily Demand</span>
        <div className="io-chart-card__trend" style={{ color: trendMeta.color }}>
          <TrendIcon size={14} /> {trend}
        </div>
      </div>
      <div className="io-chart-card__value">{fmtNum(demand)} units/day</div>
      <div className="io-chart-card__chart">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#6B7280" fontSize={11} />
            <YAxis stroke="#6B7280" fontSize={10} />
            <Tooltip
              contentStyle={{ background: '#0F0F12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              <Cell fill="#8B5CF6" />
              <Cell fill="rgba(139, 92, 246, 0.3)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function InventoryOptimization() {
  const { activeProduct } = useProduct();
  const productId = activeProduct?.id || activeProduct?.product_id;

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(`/api/inventory-optimization/${productId}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="io-page">
      {/* Header */}
      <div className="io-header">
        <div>
          <div className="io-header__eyebrow">
            <Package size={14} /> Inventory Optimization Model
          </div>
          <h1 className="io-header__title">AI suggests restock timing, markdown timing, clearance pricing</h1>
          <p className="io-header__sub">
            Days-of-cover analysis, restock urgency, markdown strategy, and clearance pricing based on demand trends and elasticity.
          </p>
        </div>
        <button className="io-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Analyzing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="io-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && !data && <div className="io-loading">Running inventory optimization…</div>}

      {data && (
        <>
          {/* KPI row */}
          <div className="io-kpi-row">
            <DaysOfCoverCard days={data.days_of_cover} trend={data.demand_trend} />
            <div className="io-health-card">
              <HealthRing score={data.inventory_health_score} />
              <div className="io-health-card__label">Inventory Health</div>
            </div>
            <DemandChart demand={data.avg_daily_demand} trend={data.demand_trend} />
          </div>

          {/* Recommendations grid */}
          <div className="io-grid">
            <RestockCard rec={data.restock_recommendation} />
            <MarkdownCard rec={data.markdown_recommendation} />
            <ClearanceCard rec={data.clearance_price} />
          </div>
        </>
      )}
    </div>
  );
}
