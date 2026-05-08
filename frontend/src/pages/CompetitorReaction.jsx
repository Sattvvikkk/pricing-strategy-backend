import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Activity, AlertTriangle, TrendingDown, TrendingUp, Minus, Zap, Target, Calendar,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';

// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_COLORS = {
  Amazon:   '#F59E0B',
  Flipkart: '#3B82F6',
  Myntra:   '#EC4899',
  Ajio:     '#10B981',
};

const RESPONSE_META = {
  UNDERCUT:     { label: 'Undercut',      tone: 'risk',  desc: 'Drop price below competitors to defend share.' },
  MATCH:        { label: 'Match',         tone: 'warn',  desc: 'Match competitor moves to stay competitive.' },
  PREMIUM_HOLD: { label: 'Premium Hold',  tone: 'good',  desc: 'Hold price; market is calm, premium positioning works.' },
  WAIT:         { label: 'Wait & Watch',  tone: 'info',  desc: 'No urgent action — monitor over next few days.' },
  HOLD:         { label: 'Hold',          tone: 'info',  desc: 'Insufficient signal — keep current price.' },
};

const TREND_META = {
  falling: { Icon: TrendingDown, color: '#10B981', label: 'Falling' },
  stable:  { Icon: Minus,        color: '#9CA3AF', label: 'Stable'  },
  rising:  { Icon: TrendingUp,   color: '#EF4444', label: 'Rising'  },
};

function fmt(price) {
  if (price == null || Number.isNaN(price)) return '—';
  return `₹${Number(price).toFixed(0)}`;
}

function pct(p) {
  if (p == null || Number.isNaN(p)) return '—';
  return `${Math.round(p * 100)}%`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProbGauge({ value }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = 46;
  const circ = 2 * Math.PI * r;
  const dash = circ * v;
  const color = v >= 0.7 ? '#EF4444' : v >= 0.5 ? '#F59E0B' : v >= 0.3 ? '#8B5CF6' : '#10B981';

  return (
    <div className="cr-gauge">
      <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
        <circle
          cx={60} cy={60} r={r} fill="none"
          stroke={color} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="cr-gauge__center">
        <div className="cr-gauge__value" style={{ color }}>{pct(v)}</div>
        <div className="cr-gauge__label">drop prob.</div>
      </div>
    </div>
  );
}

function AggressionBar({ score }) {
  const v = Math.max(0, Math.min(100, score || 0));
  const color = v >= 70 ? '#EF4444' : v >= 40 ? '#F59E0B' : '#10B981';
  return (
    <div className="cr-aggr">
      <div className="cr-aggr__head">
        <span className="cr-aggr__label">Market aggression</span>
        <span className="cr-aggr__val" style={{ color }}>{v.toFixed(0)}/100</span>
      </div>
      <div className="cr-aggr__track">
        <div
          className="cr-aggr__fill"
          style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 8px ${color}66` }}
        />
      </div>
    </div>
  );
}

function ForecastChart({ history, predicted, color }) {
  const data = useMemo(() => {
    const past = (history || []).slice(-14).map((p) => ({
      date: p.date, actual: p.price, predicted: null,
    }));
    const fut = (predicted || []).map((p, i) => ({
      date: p.date, actual: i === 0 && past.length ? past[past.length - 1].actual : null, predicted: p.price,
    }));
    return [...past, ...fut];
  }, [history, predicted]);

  if (data.length === 0) return <div className="cr-chart cr-chart--empty">No data</div>;

  return (
    <div className="cr-chart">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickFormatter={(d) => d?.slice(5) || ''} />
          <YAxis stroke="#6B7280" fontSize={10} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#0F0F12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <Line type="monotone" dataKey="actual"    stroke={color} strokeWidth={2} dot={false} name="Actual" />
          <Line type="monotone" dataKey="predicted" stroke={color} strokeWidth={2} strokeDasharray="5 4" dot={false} name="Predicted" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PromotionList({ periods }) {
  if (!periods || periods.length === 0) {
    return <div className="cr-promos cr-promos--empty">No recurring sale pattern detected</div>;
  }
  return (
    <ul className="cr-promos">
      {periods.map((p, i) => (
        <li key={i} className="cr-promo">
          <Calendar size={14} className="cr-promo__icon" />
          <div className="cr-promo__body">
            <div className="cr-promo__dates">{p.start} → {p.end}</div>
            <div className="cr-promo__meta">
              {p.duration_days}d &middot; <span style={{ color: '#10B981' }}>−{p.predicted_discount_pct}%</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PlatformCard({ data, ourPrice }) {
  const color = PLATFORM_COLORS[data.platform] || '#8B5CF6';
  const trend = TREND_META[data.trend] || TREND_META.stable;
  const TrendIcon = trend.Icon;

  const delta = data.current_price - ourPrice;
  const deltaPct = ourPrice ? (delta / ourPrice) * 100 : 0;

  return (
    <div className="cr-card">
      <div className="cr-card__head">
        <div className="cr-card__title">
          <span className="cr-card__dot" style={{ background: color }} />
          {data.platform}
        </div>
        <div className="cr-card__trend" style={{ color: trend.color }}>
          <TrendIcon size={14} /> {trend.label}
        </div>
      </div>

      <div className="cr-card__price-row">
        <div>
          <div className="cr-card__price">{fmt(data.current_price)}</div>
          <div className="cr-card__delta" style={{ color: delta < 0 ? '#10B981' : delta > 0 ? '#EF4444' : '#9CA3AF' }}>
            {delta >= 0 ? '+' : ''}{fmt(delta)} ({deltaPct.toFixed(1)}%) vs us
          </div>
        </div>
        <ProbGauge value={data.price_drop_probability} />
      </div>

      <AggressionBar score={data.market_aggression_score} />

      <div className="cr-card__section">
        <div className="cr-card__section-label">7-day forecast</div>
        <ForecastChart history={data.history || []} predicted={data.predicted_prices} color={color} />
      </div>

      <div className="cr-card__section">
        <div className="cr-card__section-label">Predicted sale periods</div>
        <PromotionList periods={data.promotion_periods} />
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CompetitorReaction() {
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
      const res = await API.get(`/api/competitor-reaction/${productId}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const response = data ? (RESPONSE_META[data.recommended_response] || RESPONSE_META.HOLD) : null;
  const ourPrice = data?.market_summary?.our_price || 0;

  return (
    <div className="cr-page">
      {/* Header */}
      <div className="cr-header">
        <div>
          <div className="cr-header__eyebrow">
            <Activity size={14} /> Competitor Reaction Model
          </div>
          <h1 className="cr-header__title">What competitors may do next</h1>
          <p className="cr-header__sub">
            Probability of price drops, predicted sale periods, and market aggression
            across Amazon, Flipkart, Myntra, and Ajio.
          </p>
        </div>
        <button className="cr-refresh" onClick={load} disabled={loading}>
          <Zap size={14} /> {loading ? 'Analyzing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="cr-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && !data && <div className="cr-loading">Running competitor reaction model…</div>}

      {data && (
        <>
          {/* Recommended response banner */}
          <div className={`cr-banner cr-banner--${response.tone}`}>
            <div className="cr-banner__left">
              <Target size={18} />
              <div>
                <div className="cr-banner__label">Recommended response</div>
                <div className="cr-banner__action">{response.label}</div>
              </div>
            </div>
            <div className="cr-banner__desc">{response.desc}</div>
          </div>

          {/* Market summary */}
          <div className="cr-summary">
            <div className="cr-summary__item">
              <div className="cr-summary__label">Our price</div>
              <div className="cr-summary__value">{fmt(data.market_summary.our_price)}</div>
            </div>
            <div className="cr-summary__item">
              <div className="cr-summary__label">Avg competitor</div>
              <div className="cr-summary__value">{fmt(data.market_summary.avg_competitor_price)}</div>
            </div>
            <div className="cr-summary__item">
              <div className="cr-summary__label">Min</div>
              <div className="cr-summary__value">{fmt(data.market_summary.min_competitor_price)}</div>
            </div>
            <div className="cr-summary__item">
              <div className="cr-summary__label">Max</div>
              <div className="cr-summary__value">{fmt(data.market_summary.max_competitor_price)}</div>
            </div>
            <div className="cr-summary__item">
              <div className="cr-summary__label">Position</div>
              <div className="cr-summary__value cr-summary__value--tag">
                {data.market_summary.price_position?.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Platform grid */}
          <div className="cr-grid">
            {data.platforms.map((p) => (
              <PlatformCard key={p.platform} data={p} ourPrice={ourPrice} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
