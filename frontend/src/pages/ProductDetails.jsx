import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Tag, ArrowLeft, ShieldCheck, ShieldAlert, AlertTriangle,
  TrendingUp, TrendingDown, Sparkles, Layers, Activity, BarChart3,
  Globe, BrainCircuit, Target, Gauge, Loader2, ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';
import AnimatedCounter from '../components/AnimatedCounter';
import { fadeUp, EASE } from '../motion/tokens';

const TOOLTIP_STYLE = {
  background: '#0d1f18',
  border: '1px solid rgba(206,237,111,0.2)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

const RISK_META = {
  Low:    { Icon: ShieldCheck,   color: '#16803c', bg: 'rgba(22,128,60,0.12)' },
  Medium: { Icon: ShieldAlert,   color: '#b45309', bg: 'rgba(180,83,9,0.14)' },
  High:   { Icon: AlertTriangle, color: '#b91c1c', bg: 'rgba(185,28,28,0.12)' },
};

const COST_COLORS = ['#1a3a2e', '#2d5a47', '#4a7d62', '#6db83c', '#a3d540', '#ceed6f'];

// ── Section wrapper ─────────────────────────────────────────────────────────
function Section({ id, Icon, title, subtitle, action, children, dense }) {
  return (
    <motion.section
      id={id}
      className={`pw-section ${dense ? 'pw-section--dense' : ''}`}
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.05 }}
    >
      <header className="pw-section__head">
        <div className="pw-section__head-left">
          <span className="pw-section__icon"><Icon size={14} strokeWidth={2} /></span>
          <div>
            <h2 className="pw-section__title">{title}</h2>
            {subtitle && <p className="pw-section__sub">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="pw-section__body">{children}</div>
    </motion.section>
  );
}

// ── Snapshot header ─────────────────────────────────────────────────────────
function SnapshotHeader({ p, onBack }) {
  const Risk = RISK_META[p.risk_flag] || RISK_META.Low;
  const trendUp = ['Rising', 'Surging'].includes(p.demand_trend);
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;
  return (
    <div className="pw-snapshot">
      <button type="button" className="pw-back" onClick={onBack}>
        <ArrowLeft size={14} /> Overview
      </button>
      <div className="pw-snapshot__main">
        <div className="pw-snapshot__thumb" aria-hidden="true">
          {(p.name || 'P').charAt(0).toUpperCase()}
        </div>
        <div className="pw-snapshot__title-block">
          <div className="pw-snapshot__cat">{p.brand} · {p.category} · {p.sku}</div>
          <h1 className="pw-snapshot__title">{p.name}</h1>
          <div className="pw-snapshot__chips">
            <span
              className="pw-chip"
              style={{ background: Risk.bg, color: Risk.color }}
            >
              <Risk.Icon size={12} strokeWidth={2.25} /> {p.risk_flag} risk
            </span>
            <span className={`pw-chip ${trendUp ? 'pw-chip--up' : 'pw-chip--down'}`}>
              <TrendIcon size={12} strokeWidth={2.25} /> {p.demand_trend}
            </span>
            <span className="pw-chip pw-chip--rec">
              <Sparkles size={12} strokeWidth={2.25} /> {p.recommendation}
            </span>
          </div>
        </div>
        <div className="pw-snapshot__price">
          <div className="pw-snapshot__price-value">
            ₹{Number(p.current_price).toLocaleString('en-IN')}
          </div>
          <div className="pw-snapshot__price-sub">
            cost ₹{Number(p.cost_price).toLocaleString('en-IN')} ·
            margin {p.gross_margin_pct?.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="pw-stats">
        <div className="pw-stat">
          <span className="pw-stat__label">Stock</span>
          <span className="pw-stat__value">
            <AnimatedCounter value={p.stock_on_hand || 0} />
          </span>
        </div>
        <div className="pw-stat">
          <span className="pw-stat__label">Available</span>
          <span className="pw-stat__value">
            <AnimatedCounter value={p.available_stock || 0} />
          </span>
        </div>
        <div className="pw-stat">
          <span className="pw-stat__label">Sales 30d</span>
          <span className="pw-stat__value">
            <AnimatedCounter value={p.sales_30d || 0} />
          </span>
        </div>
        <div className="pw-stat">
          <span className="pw-stat__label">Revenue 30d</span>
          <span className="pw-stat__value">
            <AnimatedCounter value={Math.round((p.revenue_30d || 0) / 1000)} prefix="₹" suffix="k" />
          </span>
        </div>
        <div className="pw-stat">
          <span className="pw-stat__label">Conv. rate</span>
          <span className="pw-stat__value">
            <AnimatedCounter value={(p.conversion_rate || 0) * 100} suffix="%" decimals={1} />
          </span>
        </div>
        <div className="pw-stat">
          <span className="pw-stat__label">Days of cover</span>
          <span className="pw-stat__value">
            <AnimatedCounter value={p.days_of_cover || 0} decimals={0} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Cost breakdown ──────────────────────────────────────────────────────────
function CostBreakdown({ p }) {
  const data = useMemo(() => {
    if (!p?.cost_breakup) return [];
    return Object.entries(p.cost_breakup).map(([key, value], i) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: Math.round(value),
      color: COST_COLORS[i % COST_COLORS.length],
    }));
  }, [p]);

  const totalCost = data.reduce((s, d) => s + d.value, 0);
  const profit = Math.max(0, (p.current_price || 0) - totalCost);

  return (
    <div className="pw-cost">
      <div className="pw-cost__chart">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `₹${v}`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pw-cost__center">
          <div className="pw-cost__center-label">Landing cost</div>
          <div className="pw-cost__center-value">₹{Math.round(p.landing_cost || totalCost)}</div>
        </div>
      </div>
      <div className="pw-cost__list">
        {data.map((d) => (
          <div key={d.name} className="pw-cost__row">
            <span className="pw-cost__dot" style={{ background: d.color }} />
            <span className="pw-cost__name">{d.name}</span>
            <span className="pw-cost__val">₹{d.value}</span>
          </div>
        ))}
        <div className="pw-cost__divider" />
        <div className="pw-cost__row pw-cost__row--total">
          <span className="pw-cost__name">Selling price</span>
          <span className="pw-cost__val">₹{p.current_price}</span>
        </div>
        <div className="pw-cost__row pw-cost__row--profit">
          <span className="pw-cost__name">Profit per unit</span>
          <span className="pw-cost__val">₹{profit}</span>
        </div>
      </div>
    </div>
  );
}

// ── Sales history chart ─────────────────────────────────────────────────────
function SalesHistory({ productId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API.get(`/api/products/${productId}/sales-history`)
      .then((res) => !cancelled && setData(res.data?.data || []))
      .catch(() => !cancelled && setData([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) return <div className="pe-skel" style={{ height: 280, borderRadius: 8 }} />;
  if (!data.length) return <div className="pw-empty">No sales history available.</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525B' }} interval={Math.floor(data.length / 8)} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="right" dataKey="revenue" name="Revenue (₹)" fill="#a3d540" radius={[3, 3, 0, 0]} opacity={0.6} />
        <Line yAxisId="left" type="monotone" dataKey="units_sold" name="Units sold" stroke="#1a3a2e" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Inventory panel ─────────────────────────────────────────────────────────
function InventoryPanel({ p }) {
  const stockoutPct = p.reorder_point > 0
    ? Math.min(100, Math.max(0, ((p.stock_on_hand - p.reorder_point) / p.reorder_point) * 100))
    : 100;
  return (
    <div className="pw-inv">
      <div className="pw-inv__grid">
        <div className="pw-inv__cell">
          <span className="pw-inv__label">On hand</span>
          <span className="pw-inv__value">{p.stock_on_hand?.toLocaleString()}</span>
        </div>
        <div className="pw-inv__cell">
          <span className="pw-inv__label">Reserved</span>
          <span className="pw-inv__value">{p.reserved_stock?.toLocaleString()}</span>
        </div>
        <div className="pw-inv__cell">
          <span className="pw-inv__label">Available</span>
          <span className="pw-inv__value">{p.available_stock?.toLocaleString()}</span>
        </div>
        <div className="pw-inv__cell">
          <span className="pw-inv__label">Reorder pt</span>
          <span className="pw-inv__value">{p.reorder_point?.toLocaleString()}</span>
        </div>
        <div className="pw-inv__cell">
          <span className="pw-inv__label">Safety stock</span>
          <span className="pw-inv__value">{p.safety_stock?.toLocaleString()}</span>
        </div>
        <div className="pw-inv__cell">
          <span className="pw-inv__label">Lead time</span>
          <span className="pw-inv__value">{p.lead_time_days}d</span>
        </div>
        <div className="pw-inv__cell">
          <span className="pw-inv__label">Supplier</span>
          <span className="pw-inv__value pw-inv__value--text">{p.supplier}</span>
        </div>
        <div className="pw-inv__cell">
          <span className="pw-inv__label">Days of cover</span>
          <span className="pw-inv__value">{p.days_of_cover?.toFixed?.(0) || 0}d</span>
        </div>
      </div>
      <div className="pw-inv__bar">
        <div className="pw-inv__bar-track">
          <span className="pw-inv__bar-fill" style={{ width: `${stockoutPct}%` }} />
        </div>
        <div className="pw-inv__bar-meta">
          <span>Reorder point</span>
          <span>Healthy</span>
        </div>
      </div>
    </div>
  );
}

// ── Marketplace panel ───────────────────────────────────────────────────────
function MarketplacePanel({ productId, currentPrice }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const load = () => {
    setLoading(true);
    API.get(`/api/marketplace/${productId}`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      // Re-fetch — backend serves freshest competitor data
      await new Promise((r) => setTimeout(r, 1200));
      load();
    } finally {
      setScraping(false);
    }
  };

  if (loading) return <div className="pe-skel" style={{ height: 200, borderRadius: 8 }} />;
  if (!data) return <div className="pw-empty">No marketplace data yet. Run a scrape to gather competitor intel.</div>;

  const comparison = data.comparison || [];
  const prices = data.prices || [];
  const platforms = comparison.map((c) => ({
    name: c.marketplace,
    avg: Math.round(c.avg_price),
    min: Math.round(c.min_price),
    max: Math.round(c.max_price),
  }));

  return (
    <div className="pw-mkt">
      <div className="pw-mkt__head">
        <div className="pw-mkt__summary">
          <div className="pw-mkt__sum-cell">
            <span>Our price</span>
            <strong>₹{Number(currentPrice).toLocaleString('en-IN')}</strong>
          </div>
          <div className="pw-mkt__sum-cell">
            <span>Competitors</span>
            <strong>{prices.length}</strong>
          </div>
          <div className="pw-mkt__sum-cell">
            <span>Marketplaces</span>
            <strong>{comparison.length}</strong>
          </div>
          <div className="pw-mkt__sum-cell">
            <span>Last refreshed</span>
            <strong>{data.last_updated ? new Date(data.last_updated).toLocaleString() : 'just now'}</strong>
          </div>
        </div>
        <button
          type="button"
          className="pw-btn pw-btn--primary"
          onClick={handleScrape}
          disabled={scraping}
        >
          {scraping ? <><Loader2 size={14} className="pw-spin" /> Scraping…</> : <>Refresh competitors</>}
        </button>
      </div>

      <div className="pw-mkt__chart">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={platforms} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `₹${v}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="min" name="Min" fill="#a3d540" radius={[3, 3, 0, 0]} />
            <Bar dataKey="avg" name="Avg" fill="#6db83c" radius={[3, 3, 0, 0]} />
            <Bar dataKey="max" name="Max" fill="#1a3a2e" radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="pw-mkt__table">
        <div className="pw-mkt__tr pw-mkt__tr--head">
          <span>Marketplace</span>
          <span>Merchant / Title</span>
          <span>Price</span>
          <span>Δ vs ours</span>
          <span></span>
        </div>
        {prices.slice(0, 12).map((row, i) => {
          const delta = ((row.price - currentPrice) / currentPrice) * 100;
          return (
            <div key={i} className="pw-mkt__tr">
              <span className="pw-mkt__platform">{row.platform || row.marketplace}</span>
              <span className="pw-mkt__merchant">{row.merchant || row.title}</span>
              <span className="pw-mkt__price">₹{Number(row.price).toLocaleString('en-IN')}</span>
              <span className={`pw-mkt__delta ${delta >= 0 ? 'is-up' : 'is-down'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              </span>
              <span>
                {row.link && (
                  <a href={row.link} target="_blank" rel="noreferrer" className="pw-mkt__link">
                    <ExternalLink size={12} />
                  </a>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ML insights (multi-agent orchestrator) ──────────────────────────────────
function MLPanel({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API.get('/api/ml/run-analysis', { params: { product_id: productId } })
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) return <div className="pe-skel" style={{ height: 280, borderRadius: 8 }} />;
  if (!data || data.error) return <div className="pw-empty">ML analysis unavailable.</div>;

  const f = data.forecast || {};
  const inv = data.inventory_risk || {};
  const comp = data.competitor_response || {};
  const band = data.recommended_price_band || {};
  const rec = data.recommended_action || {};
  const segments = data.customer_segmentation?.segments || [];
  const dq = data.data_quality || {};

  const cards = [
    { Icon: BarChart3,     label: '7-day demand',       value: f['7d'] || 0, suffix: ' units' },
    { Icon: BarChart3,     label: '30-day demand',      value: f['30d'] || 0, suffix: ' units' },
    { Icon: Activity,      label: 'Elasticity',         value: data.elasticity_score, raw: true },
    { Icon: AlertTriangle, label: 'Stockout risk',      value: Math.round((inv.stockout_probability || 0) * 100), suffix: '%' },
    { Icon: Globe,         label: 'Competitor reaction',value: Math.round((comp.reaction_probability || 0) * 100), suffix: '%' },
    { Icon: Package,       label: 'Days of cover',      value: Math.round(inv.days_of_cover || 0), suffix: 'd' },
  ];

  return (
    <div className="pw-ml">
      {/* Agent status strip */}
      <div className="pw-ml__agents">
        {Object.entries(data.agents_run || {}).map(([name, status]) => (
          <span
            key={name}
            className={`pw-ml__agent ${status === 'ok' ? 'is-ok' : 'is-bad'}`}
            title={status}
          >
            <span className="pw-ml__agent-dot" />
            {name.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {/* Metric cards */}
      <div className="pw-ml__cards">
        {cards.map((c) => (
          <div key={c.label} className="pw-ml__card">
            <div className="pw-ml__card-head">
              <c.Icon size={13} strokeWidth={2} />
              <span>{c.label}</span>
            </div>
            <div className="pw-ml__card-value">
              {c.raw ? Number(c.value).toFixed(2) : (
                <AnimatedCounter value={Number(c.value)} suffix={c.suffix} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recommended action */}
      {rec.action && (
        <div className="pw-ml__rec">
          <div className="pw-ml__rec-head">
            <Sparkles size={13} strokeWidth={2.25} />
            <span className="pw-ml__rec-label">Recommended action</span>
          </div>
          <div className="pw-ml__rec-body">
            <div className="pw-ml__rec-action">{rec.action}</div>
            {rec.recommended_price > 0 && (
              <div className="pw-ml__rec-price">
                target ₹{Number(rec.recommended_price).toLocaleString('en-IN')}
              </div>
            )}
            <div className="pw-ml__rec-rationale">{rec.rationale}</div>
            <div className="pw-ml__rec-impact">
              <span>Revenue impact <strong className={rec.expected_revenue_change_pct >= 0 ? 'is-up' : 'is-down'}>{rec.expected_revenue_change_pct >= 0 ? '+' : ''}{rec.expected_revenue_change_pct?.toFixed(1)}%</strong></span>
              <span>Margin impact <strong className={rec.expected_margin_change_pct >= 0 ? 'is-up' : 'is-down'}>{rec.expected_margin_change_pct >= 0 ? '+' : ''}{rec.expected_margin_change_pct?.toFixed(1)}%</strong></span>
              <span>Price band <strong>₹{band.min?.toFixed(0)}–₹{band.max?.toFixed(0)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      {data.insights?.length > 0 && (
        <ul className="pw-ml__insights">
          {data.insights.map((line, i) => (
            <li key={i}>
              <Sparkles size={11} strokeWidth={2.25} />
              {line}
            </li>
          ))}
        </ul>
      )}

      {/* Segments */}
      {segments.length > 0 && (
        <div className="pw-ml__segments">
          {segments.map((s) => (
            <div key={s.name} className="pw-ml__segment">
              <div className="pw-ml__segment-head">
                <span>{s.name}</span>
                <span>{Math.round(s.share * 100)}%</span>
              </div>
              <div className="pw-confbar">
                <span
                  className="pw-confbar__fill"
                  style={{ width: `${s.share * 100}%` }}
                />
              </div>
              <div className="pw-ml__segment-basket">avg basket ₹{Number(s.avg_basket).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Confidence + data quality */}
      <div className="pw-ml__confidence">
        <div className="pw-ml__confidence-label">
          <span>Confidence · data quality {Math.round((dq.score || 0) * 100)}%{dq.history_days ? ` · ${dq.history_days}d history` : ''}</span>
          <span>{Math.round((data.confidence_score || 0) * 100)}%</span>
        </div>
        <div className="pw-confbar">
          <motion.span
            className="pw-confbar__fill"
            initial={{ width: 0 }}
            whileInView={{ width: `${(data.confidence_score || 0) * 100}%` }}
            transition={{ duration: 1, ease: EASE.outExpo }}
            viewport={{ once: true }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Strategy panel ──────────────────────────────────────────────────────────
function StrategyPanel({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API.get(`/api/strategy/${productId}`)
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) return <div className="pe-skel" style={{ height: 160, borderRadius: 8 }} />;
  if (!data) return <div className="pw-empty">Strategy unavailable.</div>;

  const archetype = data.archetype || data.strategy_archetype || 'BALANCED';
  const reasoning = data.rationale || data.reasoning || data.explanation || '';

  return (
    <div className="pw-strat">
      <div className="pw-strat__archetype">
        <span className="pw-strat__archetype-label">Strategy archetype</span>
        <span className="pw-strat__archetype-name">{archetype}</span>
      </div>
      {reasoning && (
        <p className="pw-strat__reasoning">{reasoning}</p>
      )}
    </div>
  );
}

// ── Dynamic Pricing recommendation ──────────────────────────────────────────
function PricingPanel({ p }) {
  const [adjust, setAdjust] = useState(0);
  const elasticity = -1.5;

  const newPrice = useMemo(() => {
    return Math.round(p.current_price * (1 + adjust / 100));
  }, [p, adjust]);

  const margin = p.current_price > 0
    ? ((newPrice - p.cost_price) / newPrice) * 100
    : 0;

  // Demand response via elasticity
  const demandMult = 1 + (elasticity * adjust) / 100;
  const newDemand = Math.max(0, Math.round((p.sales_30d || 0) * demandMult));
  const newRevenue = newPrice * newDemand;
  const baseRevenue = p.current_price * p.sales_30d;
  const revDelta = baseRevenue > 0 ? ((newRevenue - baseRevenue) / baseRevenue) * 100 : 0;

  const belowMin = newPrice < p.min_price;
  const aboveMax = newPrice > p.max_price;

  return (
    <div className="pw-pricing">
      <div className="pw-pricing__cards">
        <div className="pw-pricing__card">
          <span className="pw-pricing__card-label">Current</span>
          <span className="pw-pricing__card-value">₹{p.current_price}</span>
        </div>
        <div className="pw-pricing__card pw-pricing__card--rec">
          <span className="pw-pricing__card-label">Recommended</span>
          <span className="pw-pricing__card-value">₹{newPrice}</span>
          <span className="pw-pricing__card-delta">
            {adjust >= 0 ? '+' : ''}{adjust}%
          </span>
        </div>
        <div className="pw-pricing__card">
          <span className="pw-pricing__card-label">Projected margin</span>
          <span className="pw-pricing__card-value">{margin.toFixed(1)}%</span>
        </div>
        <div className="pw-pricing__card">
          <span className="pw-pricing__card-label">Revenue impact</span>
          <span className={`pw-pricing__card-value ${revDelta >= 0 ? 'is-up' : 'is-down'}`}>
            {revDelta >= 0 ? '+' : ''}{revDelta.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="pw-pricing__slider">
        <label className="pw-pricing__slider-label">Adjust price</label>
        <input
          type="range"
          min={-20}
          max={20}
          step={1}
          value={adjust}
          onChange={(e) => setAdjust(Number(e.target.value))}
          className="pe-scenario__range"
        />
        <div className="pw-pricing__slider-ticks">
          <span>−20%</span>
          <span>0%</span>
          <span>+20%</span>
        </div>
      </div>

      <div className="pw-pricing__guards">
        <div className={`pw-pricing__guard ${belowMin ? 'is-bad' : 'is-ok'}`}>
          {belowMin ? '✗' : '✓'} Above min price (₹{p.min_price})
        </div>
        <div className={`pw-pricing__guard ${aboveMax ? 'is-bad' : 'is-ok'}`}>
          {aboveMax ? '✗' : '✓'} Below max price (₹{p.max_price})
        </div>
        <div className={`pw-pricing__guard ${margin >= 25 ? 'is-ok' : 'is-bad'}`}>
          {margin >= 25 ? '✓' : '✗'} Margin ≥ 25%
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setActiveProduct } = useProduct();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    API.get(`/api/products/${id}`)
      .then((res) => {
        if (cancelled) return;
        const p = res.data?.product;
        setProduct(p);
        if (p) setActiveProduct(p);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Could not load product');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="pw-loading">
        <Loader2 size={28} className="pw-spin" />
        <p>Loading product workspace…</p>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="pw-empty">
        <Package size={32} strokeWidth={1.25} />
        <h3>{error || 'Product not found'}</h3>
        <button type="button" className="pw-btn pw-btn--primary" onClick={() => navigate('/app')}>
          Back to Overview
        </button>
      </div>
    );
  }

  return (
    <div className="pw">
      <SnapshotHeader p={product} onBack={() => navigate('/app')} />

      <Section id="cost" Icon={Layers} title="Cost Breakdown" subtitle="Where every rupee goes">
        <CostBreakdown p={product} />
      </Section>

      <Section id="sales" Icon={BarChart3} title="Sales History" subtitle="Last 90 days · daily revenue and units">
        <SalesHistory productId={product.id} />
      </Section>

      <Section id="inventory" Icon={Package} title="Inventory" subtitle={`${product.supplier} · MOQ ${product.supplier_moq}`}>
        <InventoryPanel p={product} />
      </Section>

      <Section
        id="marketplace"
        Icon={Globe}
        title="Marketplace Intelligence"
        subtitle="Competitor pricing across platforms"
      >
        <MarketplacePanel productId={product.id} currentPrice={product.current_price} />
      </Section>

      <Section id="ml" Icon={BrainCircuit} title="ML Multi-Agent Engine" subtitle="7 agents · forecast · elasticity · risk · segments · insights">
        <MLPanel productId={product.id} />
      </Section>

      <Section id="strategy" Icon={Target} title="Strategy" subtitle="AI-recommended pricing archetype">
        <StrategyPanel productId={product.id} />
      </Section>

      <Section id="pricing-engine" Icon={Gauge} title="Dynamic Pricing Engine" subtitle="Simulate, validate, and recommend">
        <PricingPanel p={product} />
      </Section>
    </div>
  );
}
