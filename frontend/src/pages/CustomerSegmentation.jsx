import { useEffect, useState, useCallback } from 'react';
import {
  Users, Crown, Tag, Heart, Zap, Target, TrendingUp, BarChart3, RefreshCw, PieChart,
} from 'lucide-react';
import {
  PieChart as RechartsPieChart, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';

// ─────────────────────────────────────────────────────────────────────────────

const SEGMENT_META = {
  PREMIUM_BUYERS:   { icon: Crown,  color: '#8B5CF6', label: 'Premium Buyers' },
  DISCOUNT_SEEKERS: { icon: Tag,    color: '#F59E0B', label: 'Discount Seekers' },
  LOYAL_CUSTOMERS:  { icon: Heart,  color: '#10B981', label: 'Loyal Customers' },
  IMPULSE_SHOPPERS: { icon: Zap,    color: '#EF4444', label: 'Impulse Shoppers' },
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

function SegmentCard({ segment, isDominant }) {
  const meta = SEGMENT_META[segment.name] || {};
  const Icon = meta.icon || Users;
  const color = meta.color || '#6366F1';

  return (
    <div className={`cs-card ${isDominant ? 'cs-card--dominant' : ''}`}>
      <div className="cs-card__head">
        <div className="cs-card__icon" style={{ background: `${color}20`, color }}>
          <Icon size={20} />
        </div>
        <div className="cs-card__title">{meta.label}</div>
        {isDominant && <div className="cs-card__badge">Dominant</div>}
      </div>

      <div className="cs-card__metrics">
        <div className="cs-metric">
          <div className="cs-metric__value">{segment.size_pct}%</div>
          <div className="cs-metric__label">of days</div>
        </div>
        <div className="cs-metric">
          <div className="cs-metric__value">{fmt(segment.avg_willingness_to_pay)}</div>
          <div className="cs-metric__label">avg price</div>
        </div>
        <div className="cs-metric">
          <div className="cs-metric__value">{fmtNum(segment.avg_daily_demand)}</div>
          <div className="cs-metric__label">daily demand</div>
        </div>
      </div>

      <div className="cs-card__desc">{segment.description}</div>

      <div className="cs-card__strategy">
        <Target size={14} className="cs-card__strategy-icon" />
        <div>
          <div className="cs-card__strategy-title">Recommended Strategy</div>
          <div className="cs-card__strategy-text">{segment.recommended_strategy}</div>
        </div>
      </div>
    </div>
  );
}

function SegmentsPieChart({ segments }) {
  const data = segments.map(s => ({
    name: SEGMENT_META[s.name]?.label || s.name,
    value: s.size_pct,
    color: SEGMENT_META[s.name]?.color || '#6366F1',
  }));

  return (
    <div className="cs-pie-card">
      <div className="cs-pie-card__head">
        <PieChart size={16} className="cs-pie-card__icon" />
        <span className="cs-pie-card__title">Segment Distribution</span>
      </div>
      <div className="cs-pie-card__chart">
        <ResponsiveContainer width="100%" height={240}>
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0F0F12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => `${v}%`}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WillingnessToPayChart({ segments }) {
  const data = segments.map(s => ({
    name: SEGMENT_META[s.name]?.label || s.name,
    willingness: s.avg_willingness_to_pay,
    demand: s.avg_daily_demand,
    color: SEGMENT_META[s.name]?.color || '#6366F1',
  }));

  return (
    <div className="cs-bar-card">
      <div className="cs-bar-card__head">
        <BarChart3 size={16} className="cs-bar-card__icon" />
        <span className="cs-bar-card__title">Willingness to Pay vs Demand</span>
      </div>
      <div className="cs-bar-card__chart">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" stroke="#6B7280" fontSize={10} angle={-20} textAnchor="end" height={60} />
            <YAxis stroke="#6B7280" fontSize={10} />
            <Tooltip
              contentStyle={{ background: '#0F0F12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
            />
            <Bar dataKey="willingness" radius={[6, 6, 0, 0]} name="Avg Price">
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ModelInfoCard({ modelInfo, impulsePct }) {
  return (
    <div className="cs-model-card">
      <div className="cs-model-card__head">
        <TrendingUp size={16} className="cs-model-card__icon" />
        <span className="cs-model-card__title">Model Details</span>
      </div>
      <div className="cs-model-card__grid">
        <div className="cs-model-item">
          <div className="cs-model-item__label">Algorithm</div>
          <div className="cs-model-item__value">K-Means (k={modelInfo.kmeans_k})</div>
        </div>
        <div className="cs-model-item">
          <div className="cs-model-item__label">Outlier Detection</div>
          <div className="cs-model-item__value">DBSCAN</div>
        </div>
        <div className="cs-model-item">
          <div className="cs-model-item__label">Impulse Days</div>
          <div className="cs-model-item__value">{impulsePct}%</div>
        </div>
        <div className="cs-model-item">
          <div className="cs-model-item__label">Features Used</div>
          <div className="cs-model-item__value">{modelInfo.features_used?.length || 0}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CustomerSegmentation() {
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
      const res = await API.get(`/api/customer-segmentation/${productId}`);
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
    <div className="cs-page">
      {/* Header */}
      <div className="cs-header">
        <div>
          <div className="cs-header__eyebrow">
            <Users size={14} /> Customer Segmentation Model
          </div>
          <h1 className="cs-header__title">Cluster users into premium buyers, discount seekers, loyal customers, impulse shoppers</h1>
          <p className="cs-header__sub">
            Using K-Means and DBSCAN on daily sales patterns to derive buyer cohorts and per-segment pricing strategies.
          </p>
        </div>
        <button className="cs-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Analyzing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="cs-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && !data && <div className="cs-loading">Running customer segmentation…</div>}

      {data && (
        <>
          {/* Personalization insights */}
          <div className="cs-insights">
            <div className="cs-insights__icon">
              <Target size={20} />
            </div>
            <div className="cs-insights__content">
              <div className="cs-insights__title">Personalization Insights</div>
              <div className="cs-insights__text">{data.personalization_insights}</div>
            </div>
          </div>

          {/* Charts row */}
          <div className="cs-charts-row">
            <SegmentsPieChart segments={data.segments} />
            <WillingnessToPayChart segments={data.segments} />
          </div>

          {/* Segments grid */}
          <div className="cs-grid">
            {data.segments.map((segment, i) => (
              <SegmentCard
                key={segment.name}
                segment={segment}
                isDominant={segment.name === data.dominant_segment}
              />
            ))}
          </div>

          {/* Model info */}
          <ModelInfoCard modelInfo={data.model_info} impulsePct={data.impulse_days_pct} />
        </>
      )}
    </div>
  );
}
