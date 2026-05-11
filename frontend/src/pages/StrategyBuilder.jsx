/**
 * Strategy Builder · AI Strategy Command Center
 * ---------------------------------------------
 *  Phase 0 — Picker        : hero + cinematic glassmorphic cards with sparklines
 *  Phase 1 — Command Center: 5-tab workspace (Overview · Forecast · Performance ·
 *                            Lifecycle · Inventory + Market) with rich charts
 *  Phase 2 — Building      : cinematic strategy generation sequence
 *  Phase 3 — Result        : ranked strategy bundle
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Target, Activity, TrendingUp, TrendingDown, Package, Layers,
  Cpu, Sparkles, ChevronRight, ArrowLeft, Filter, Brain, Zap, ShieldAlert,
  Flame, Gauge, Rocket, BarChart3, LineChart as LineChartIcon,
  CircleDot, Check, AlertTriangle, Crown, Snowflake, Sun, CloudRain,
  Megaphone, Tag, TrendingUp as TU, Sigma, Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ComposedChart,
  RadialBarChart, RadialBar, PolarAngleAxis, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarRadiusAxis, Radar,
} from 'recharts';

import { useBuiltMarketplaces } from '../context/BuiltMarketplacesContext';
import { MARKETPLACES } from '../data/marketplaceData';
import API from '../api/client';
import '../styles/strategy-builder.css';

const EASE = [0.16, 1, 0.3, 1];
const INR = (n) => `\u20B9${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const PCT = (n, d = 1) => `${Number(n || 0).toFixed(d)}%`;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Visual primitives ───────────────────────────────────────────────────────

function GradientMesh() {
  return (
    <div className="sb-mesh" aria-hidden="true">
      <div className="sb-mesh__blob sb-mesh__blob--a" />
      <div className="sb-mesh__blob sb-mesh__blob--b" />
      <div className="sb-mesh__blob sb-mesh__blob--c" />
      <div className="sb-mesh__grid" />
    </div>
  );
}

function FloatingParticles({ count = 24 }) {
  const nodes = useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: (i * 73) % 100, y: (i * 47) % 100,
      size: 3 + (i % 4) * 2,
      delay: (i * 0.35) % 6,
      duration: 9 + (i % 7),
    })),
    [count],
  );
  return (
    <div className="sb-particles" aria-hidden="true">
      {nodes.map((n) => (
        <motion.span
          key={n.id}
          className="sb-particle"
          style={{ left: `${n.x}%`, top: `${n.y}%`, width: n.size, height: n.size }}
          animate={{ y: [0, -30, 0], opacity: [0, 0.55, 0], scale: [0.7, 1, 0.7] }}
          transition={{ duration: n.duration, delay: n.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function AIPulse({ size = 28 }) {
  return (
    <div className="sb-aipulse" style={{ width: size, height: size }} aria-hidden="true">
      <motion.div
        className="sb-aipulse__core"
        animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div className="sb-aipulse__ring sb-aipulse__ring--1"
        animate={{ scale: [1, 1.6], opacity: [0.45, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }} />
      <motion.div className="sb-aipulse__ring sb-aipulse__ring--2"
        animate={{ scale: [1, 1.9], opacity: [0.35, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeOut', delay: 0.6 }} />
    </div>
  );
}

// ── Sparkline (lightweight inline SVG) ──────────────────────────────────────
function Sparkline({ data, color = '#ceed6f', height = 36 }) {
  const points = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const vals = data.map((d) => (typeof d === 'number' ? d : d?.units ?? d?.value ?? 0));
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    const W = 100;
    const H = 100;
    return vals.map((v, i) => {
      const x = (i / Math.max(vals.length - 1, 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }, [data]);

  if (!points) return <div className="sb-spark sb-spark--empty" style={{ height }} />;
  return (
    <div className="sb-spark" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={`0,100 ${points} 100,100`}
          fill={`url(#spark-${color.slice(1)})`}
          stroke="none"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({ totalBuilds }) {
  return (
    <motion.section
      className="sb-hero"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: EASE }}
    >
      <GradientMesh />
      <FloatingParticles count={28} />
      <div className="sb-hero__inner">
        <motion.div className="sb-hero__badge"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}>
          <AIPulse />
          <span>AI Strategy Builder</span>
          <span className="sb-hero__badge-meta">Forecast · Lifecycle · Pricing</span>
        </motion.div>
        <motion.h1 className="sb-hero__title"
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.18, ease: EASE }}>
          Build dynamic pricing strategies
          <span className="sb-hero__title-line">from real marketplace intelligence.</span>
        </motion.h1>
        <motion.p className="sb-hero__lead"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}>
          Every product below has been scanned across live marketplaces. Open one to enter the
          AI Strategy Command Center — a multi-tab intelligence workspace built for decisive action.
        </motion.p>
        <motion.div className="sb-hero__stats"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45, ease: EASE }}>
          <div className="sb-hero__stat">
            <div className="sb-hero__stat-val">{totalBuilds}</div>
            <div className="sb-hero__stat-lbl">Scanned products</div>
          </div>
          <div className="sb-hero__stat">
            <div className="sb-hero__stat-val">6 mo</div>
            <div className="sb-hero__stat-lbl">Forecast horizon</div>
          </div>
          <div className="sb-hero__stat">
            <div className="sb-hero__stat-val">5</div>
            <div className="sb-hero__stat-lbl">Intelligence tabs</div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

// ── Glassmorphism Product Card with rotating metrics + sparkline ────────────

function trendTone(trend) {
  if (trend === 'rising' || trend === 'growth') return 'good';
  if (trend === 'falling' || trend === 'decline') return 'bad';
  return 'neutral';
}
function riskTone(risk) {
  if (risk === 'balanced') return 'good';
  if (risk === 'stockout') return 'warn';
  if (risk === 'overstock') return 'bad';
  return 'neutral';
}
function lifecycleLabel(stage) {
  return {
    introduction: 'Introduction', growth: 'Growth', maturity: 'Maturity',
    saturation: 'Saturation', decline: 'Decline', revival: 'Revival',
  }[stage] || 'Maturity';
}

function HealthDial({ score, size = 56 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const color = pct >= 75 ? '#5be3a8' : pct >= 50 ? '#ffd66d' : '#ff7a7a';
  return (
    <div className="sb-dial" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r}
          stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth="4" fill="none"
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: EASE }}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <div className="sb-dial__val" style={{ color }}>{score}</div>
    </div>
  );
}

function ProductCard({ build, analysis, onOpen, idx }) {
  const product = build.product;
  const mps = (build.marketplaces || []).map((id) => MARKETPLACES.find((m) => m.id === id)).filter(Boolean);
  const a = analysis || {};
  const health = a.health?.overall ?? Math.round(60 + ((idx * 7) % 30));
  const stage = a.lifecycle?.stage ?? 'maturity';
  const confidence = a.lifecycle?.confidence ?? 0.72;
  const inventoryRisk = a.inventory_risk ?? 'balanced';
  const demandTrend = a.demand_trend ?? 'stable';
  const mm = a.market_metrics || {};
  const compCount = mm.competitor_count ?? a.competitor_stats?.count ?? build.competitorCount ?? 0;
  const saturation = a.market_saturation?.level ?? 'medium';
  const margin = a.margin_pct ?? null;
  const forecastUnits = a.forecast?.total_units_180d ?? null;

  // Sparkline data — last 30 daily units from sales history
  const sparkData = useMemo(() => {
    const daily = a.sales_history?.daily;
    if (!Array.isArray(daily) || daily.length === 0) return null;
    return daily.slice(-30).map((d) => d.units);
  }, [a]);

  // Rotating metric strip
  const rotatingMetrics = useMemo(() => [
    { icon: Layers, label: 'Competitors', value: compCount },
    { icon: Flame,  label: 'Saturation',  value: saturation },
    { icon: demandTrend === 'rising' ? TrendingUp : demandTrend === 'falling' ? TrendingDown : Activity,
      label: 'Demand', value: demandTrend },
    { icon: Package, label: 'Inventory',  value: inventoryRisk },
    { icon: Sparkles, label: 'Stage',     value: lifecycleLabel(stage) },
    ...(forecastUnits != null ? [{ icon: Rocket, label: '6-mo units', value: Math.round(forecastUnits).toLocaleString('en-IN') }] : []),
  ], [compCount, saturation, demandTrend, inventoryRisk, stage, forecastUnits]);

  const [rotIdx, setRotIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setRotIdx((i) => (i + 1) % rotatingMetrics.length), 2200);
    return () => clearInterval(t);
  }, [rotatingMetrics.length]);

  const accent = mps[0]?.accent || '#ceed6f';

  return (
    <motion.button
      type="button"
      className="sb-card"
      style={{ '--card-accent': accent }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(idx * 0.04, 0.4), ease: EASE }}
      whileHover={{ y: -8, scale: 1.01 }}
      onClick={() => onOpen(build)}
    >
      {/* glass + neon border */}
      <div className="sb-card__glass" />
      <div className="sb-card__neon" />

      {/* AI confidence pulse — top right */}
      <div className="sb-card__pulse">
        <AIPulse size={20} />
        <span>{Math.round(confidence * 100)}% AI confidence</span>
      </div>

      <div className="sb-card__top">
        <div className="sb-card__media">
          {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : null}
          <div className="sb-card__media-fade" />
          <div className="sb-card__mps">
            {mps.map((mp) => (
              <span key={mp.id} className="sb-card__mp-dot"
                style={{ background: mp.accent }} title={mp.name} />
            ))}
          </div>
        </div>
        <div className="sb-card__health">
          <HealthDial score={health} />
          <div className="sb-card__health-lbl">Health</div>
        </div>
      </div>

      <div className="sb-card__body">
        <div className="sb-card__category">{product.category} · {product.sku}</div>
        <h3 className="sb-card__title">{product.name}</h3>
        <div className="sb-card__price">
          <strong>{INR(product.landing_cost || product.mrp || product.price)}</strong>
          {margin !== null ? <span className="sb-card__margin">{PCT(margin)} margin</span> : null}
        </div>

        {/* Sparkline */}
        {sparkData ? (
          <div className="sb-card__spark">
            <div className="sb-card__spark-lbl">30-day demand</div>
            <Sparkline data={sparkData} color={accent} height={32} />
          </div>
        ) : null}

        {/* Rotating metric highlight */}
        <div className="sb-card__rot">
          <AnimatePresence mode="wait">
            <motion.div
              key={rotIdx}
              className="sb-card__rot-inner"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              {(() => {
                const M = rotatingMetrics[rotIdx];
                if (!M) return null;
                const Icon = M.icon;
                return (
                  <>
                    <Icon size={14} />
                    <span className="sb-card__rot-lbl">{M.label}</span>
                    <strong className="sb-card__rot-val">{M.value}</strong>
                  </>
                );
              })()}
            </motion.div>
          </AnimatePresence>
          <div className="sb-card__rot-dots">
            {rotatingMetrics.map((_, i) => (
              <span key={i} className={i === rotIdx ? 'is-on' : ''} />
            ))}
          </div>
        </div>

        <div className="sb-card__cta">
          <span>Open Command Center</span>
          <ChevronRight size={16} />
        </div>
      </div>
    </motion.button>
  );
}

// ── Product Picker ──────────────────────────────────────────────────────────

function ProductPicker({ builds, analyses, onOpen }) {
  const [query, setQuery] = useState('');
  const [mpFilter, setMpFilter] = useState('all');
  const grouped = useMemo(() => {
    let list = builds;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((b) =>
        (b.product.name || '').toLowerCase().includes(q)
        || (b.product.sku || '').toLowerCase().includes(q)
        || (b.product.category || '').toLowerCase().includes(q)
      );
    }
    if (mpFilter !== 'all') list = list.filter((b) => (b.marketplaces || []).includes(mpFilter));
    const buckets = {};
    list.forEach((b) => {
      const primary = (b.marketplaces || [])[0] || 'other';
      if (!buckets[primary]) buckets[primary] = [];
      buckets[primary].push(b);
    });
    return buckets;
  }, [builds, query, mpFilter]);

  return (
    <section className="sb-picker">
      <div className="sb-picker__controls">
        <div className="sb-picker__search">
          <Search size={16} />
          <input type="text" placeholder="Search scanned products by name, SKU, or category…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="sb-picker__filters">
          <Filter size={14} />
          <button type="button" className={`sb-pill ${mpFilter === 'all' ? 'is-on' : ''}`}
            onClick={() => setMpFilter('all')}>All marketplaces</button>
          {MARKETPLACES.map((mp) => (
            <button key={mp.id} type="button"
              className={`sb-pill ${mpFilter === mp.id ? 'is-on' : ''}`}
              style={{ '--accent': mp.accent }}
              onClick={() => setMpFilter(mp.id)}>{mp.name}</button>
          ))}
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="sb-empty">
          <Brain size={36} />
          <h3>No scanned products match</h3>
          <p>Build a marketplace in <strong>Marketplace Intelligence</strong>, then return here.</p>
        </div>
      ) : Object.entries(grouped).map(([mpId, list]) => {
        const mp = MARKETPLACES.find((m) => m.id === mpId);
        return (
          <div key={mpId} className="sb-group">
            <div className="sb-group__head">
              <span className="sb-group__dot" style={{ background: mp?.accent || '#999' }} />
              <h2>{mp?.name || 'Other'}</h2>
              <span className="sb-group__count">{list.length} product{list.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="sb-grid">
              {list.map((b, i) => (
                <ProductCard key={b.product.id} build={b}
                  analysis={analyses[b.product.id]} idx={i} onOpen={onOpen} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND CENTER
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Market Overview',      icon: Target },
  { id: 'forecast',    label: 'Demand Forecasting',   icon: Rocket },
  { id: 'performance', label: '6-Month Performance',  icon: BarChart3 },
  { id: 'lifecycle',   label: 'Product Lifecycle',    icon: Sparkles },
  { id: 'inventory',   label: 'Inventory + Market',   icon: Package },
];

function ChartCard({ title, subtitle, icon: Icon, children, full = false, className = '' }) {
  return (
    <motion.div
      className={`sb-chart ${full ? 'sb-chart--full' : ''} ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="sb-chart__head">
        <Icon size={14} />
        <div>
          <h4>{title}</h4>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="sb-chart__body">{children}</div>
    </motion.div>
  );
}

function StatTile({ label, value, sub, icon: Icon, tone = 'neutral' }) {
  return (
    <div className={`sb-tile sb-tile--${tone}`}>
      <div className="sb-tile__head"><Icon size={14} /><span>{label}</span></div>
      <div className="sb-tile__val">{value}</div>
      {sub ? <div className="sb-tile__sub">{sub}</div> : null}
    </div>
  );
}

// ── TAB 1 · Market Overview ─────────────────────────────────────────────────

function MarketOverviewTab({ a }) {
  const mm = a.market_metrics || {};
  const cs = a.competitor_stats || {};
  const inv = a.inventory || {};

  // Position bar — your price vs cheapest/avg/premium
  const posData = useMemo(() => {
    const cheapest = mm.cheapest_competitor || cs.min_price || 0;
    const premium  = mm.premium_competitor  || cs.max_price || 0;
    const avg      = mm.avg_competitor || cs.avg_price || 0;
    const your     = a.landing_cost || mm.your_price || a.current_price || 0;
    return [
      { name: 'Cheapest', value: Math.round(cheapest), color: '#3B82F6' },
      { name: 'P25',      value: Math.round(cs.p25 || cheapest * 1.08), color: '#1A5D3A' },
      { name: 'Market avg', value: Math.round(avg), color: '#2D4A3E' },
      { name: 'YOUR PRICE', value: Math.round(your), color: '#1A5D3A' },
      { name: 'Premium',  value: Math.round(premium), color: '#EF4444' },
    ];
  }, [mm, cs, a]);

  return (
    <div className="sb-tab">
      {/* KPI strip */}
      <div className="sb-tiles">
        <StatTile label="Your price" value={INR(a.landing_cost || mm.your_price || a.current_price)}
          sub={a.pricing_position?.narrative} icon={Wallet} tone="good" />
        <StatTile label="Cheapest competitor" value={INR(mm.cheapest_competitor)}
          sub={`${cs.count || 0} competitors tracked`} icon={TrendingDown} tone="warn" />
        <StatTile label="Premium competitor" value={INR(mm.premium_competitor)}
          sub="Ceiling of the price corridor" icon={Crown} />
        <StatTile label="Price elasticity" value={Number(inv.elasticity || -1.5).toFixed(2)}
          sub={`-1 = unit elastic · more negative = sensitive`} icon={Activity}
          tone={Math.abs(inv.elasticity || -1.5) > 2 ? 'warn' : 'good'} />
      </div>

      <div className="sb-tiles">
        <StatTile label="Market share est." value={PCT((mm.market_share_est || 0) * 100, 1)}
          sub="Volume share within scanned competitors" icon={Sigma} />
        <StatTile label="Sales velocity" value={`${mm.sales_velocity || 0} u/day`}
          sub={`Trend: ${a.demand_trend || 'stable'}`} icon={TU}
          tone={trendTone(a.demand_trend)} />
        <StatTile label="Demand volatility" value={PCT((mm.demand_volatility || 0) * 100, 1)}
          sub="CoV over last 60 days" icon={Activity}
          tone={(mm.demand_volatility || 0) > 0.5 ? 'warn' : 'good'} />
        <StatTile label="Stockout probability" value={PCT((mm.stockout_probability || 0) * 100, 0)}
          sub={`${mm.days_of_cover || 0} days of cover`} icon={ShieldAlert}
          tone={(mm.stockout_probability || 0) > 0.4 ? 'bad' : 'good'} />
        <StatTile label="Competitor aggression" value={PCT((mm.competitor_aggression || 0) * 100, 0)}
          sub="Composite of density × price pressure" icon={Flame}
          tone={(mm.competitor_aggression || 0) > 0.6 ? 'bad' : 'good'} />
      </div>

      {/* Position bar chart */}
      <ChartCard title="Market position ladder" subtitle="Where your price sits vs the competitive set"
        icon={Target} full>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={posData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#E6EDE5" />
            <XAxis dataKey="name" stroke="#D4DDD3" tick={{ fontSize: 11, fill: '#0A1F14' }} />
            <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
            <Tooltip formatter={(v) => INR(v)} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {posData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ── TAB 2 · Demand Forecasting ──────────────────────────────────────────────

const DRIVER_ICONS = {
  'Seasonality': Snowflake,
  'Festival cycle': Sparkles,
  'Discount cycles': Tag,
  'Influencer push': Megaphone,
  'Weather impact': CloudRain,
};

function ForecastTab({ a }) {
  // Daily forecast for charts
  const dailyForecast = (a.forecast?.daily || []).map((d) => ({
    date: typeof d.date === 'string' ? d.date.slice(5) : d.date,
    forecast: d.ensemble ?? d.yhat ?? d.prophet ?? d.xgb ?? 0,
    upper: d.upper ?? d.yhat_upper ?? d.p_upper,
    lower: d.lower ?? d.yhat_lower ?? d.p_lower,
  }));

  // Actual vs predicted (last 60 actual + 90 forecast)
  const actualSeries = (a.sales_history?.daily || []).slice(-60).map((d) => ({
    date: d.date.slice(5), actual: d.units,
  }));
  const futureSeries = dailyForecast.slice(0, 90).map((d) => ({
    date: d.date, forecast: d.forecast, upper: d.upper, lower: d.lower,
  }));
  const blendedSeries = [...actualSeries, ...futureSeries];

  const momentum = a.trend_momentum || [];
  const drivers = a.demand_drivers?.drivers || [];
  const insights = a.ai_insights || [];

  // Heatmap data
  const heatmap = a.seasonal_heatmap || [];
  const months = useMemo(() => Array.from(new Set(heatmap.map((c) => c.month))).sort(), [heatmap]);
  const heatmapMax = useMemo(() => Math.max(1, ...heatmap.map((c) => c.value)), [heatmap]);

  const DRIVER_COLORS = ['#ceed6f', '#7dd3fc', '#ff8fb1', '#fbbf24', '#a78bfa'];

  return (
    <div className="sb-tab">
      {/* Forecast curve */}
      <ChartCard title="Actual vs predicted demand" subtitle="60-day actuals · 90-day forecast"
        icon={Rocket} full>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={blendedSeries} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="fcAreaA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ceed6f" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ceed6f" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fcAreaB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ceed6f" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#0f1010" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E6EDE5" />
            <XAxis dataKey="date" stroke="#D4DDD3" tick={{ fontSize: 9, fill: '#0A1F14' }}
              interval={Math.max(0, Math.floor(blendedSeries.length / 10))} />
            <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#fcAreaB)" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#E6EDE5" />
            <Line type="monotone" dataKey="actual" stroke="#3B82F6" strokeWidth={2} dot={false} name="Actual" />
            <Line type="monotone" dataKey="forecast" stroke="#1A5D3A" strokeWidth={2} dot={false} strokeDasharray="5 4" name="Forecast" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* AI insights */}
      {insights.length > 0 ? (
        <div className="sb-insights">
          {insights.map((ins, i) => (
            <motion.div key={i} className="sb-insight"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}>
              <div className="sb-insight__head">
                <Brain size={14} />
                <h5>{ins.title}</h5>
                <span className="sb-insight__conf">{Math.round((ins.confidence || 0) * 100)}%</span>
              </div>
              <p>{ins.body}</p>
            </motion.div>
          ))}
        </div>
      ) : null}

      <div className="sb-charts">
        {/* Confidence band */}
        <ChartCard title="Confidence interval (180-day)"
          subtitle="80% prediction band — wider band = lower certainty" icon={ShieldAlert}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyForecast} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis dataKey="date" stroke="#D4DDD3" tick={{ fontSize: 9, fill: '#0A1F14' }}
                interval={Math.max(0, Math.floor(dailyForecast.length / 8))} />
              <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="upper" stroke="none" fill="url(#confBand)" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="#E6EDE5" />
              <Line type="monotone" dataKey="forecast" stroke="#1A5D3A" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Trend momentum */}
        <ChartCard title="Trend momentum"
          subtitle="Week-over-week % change of 7-day MA" icon={Activity}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={momentum} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis dataKey="date" stroke="#D4DDD3" tick={{ fontSize: 9, fill: '#0A1F14' }}
                interval={Math.max(0, Math.floor(momentum.length / 8))} />
              <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
              <Tooltip formatter={(v, n) => (n === 'momentum' ? PCT(v) : v)} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#D4DDD3" strokeDasharray="3 3" />
              <Bar dataKey="momentum" radius={[3, 3, 0, 0]}>
                {momentum.map((m, i) => (
                  <Cell key={i} fill={m.momentum >= 0 ? '#5be3a8' : '#ff7a7a'} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Seasonal heatmap */}
        <ChartCard title="Seasonal demand heatmap"
          subtitle="Avg units sold by day-of-week × month" icon={Sun} full>
          <div className="sb-heatmap">
            <div className="sb-heatmap__head">
              <div />
              {DOW.map((d) => <div key={d} className="sb-heatmap__cell-h">{d}</div>)}
            </div>
            {months.map((m) => (
              <div key={m} className="sb-heatmap__row">
                <div className="sb-heatmap__row-lbl">{m}</div>
                {DOW.map((_, dow) => {
                  const cell = heatmap.find((c) => c.month === m && c.dow === dow);
                  const v = cell?.value || 0;
                  const opacity = Math.max(0.05, v / heatmapMax);
                  return (
                    <div key={dow} className="sb-heatmap__cell"
                      style={{ background: `rgba(26, 93, 58, ${opacity})` }}
                      title={`${m} · ${DOW[dow]}: ${v} units/day`}>
                      <span>{v ? Math.round(v) : ''}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Demand drivers breakdown */}
        <ChartCard title="Demand drivers breakdown"
          subtitle="Estimated contribution to recent demand" icon={Megaphone}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={drivers} dataKey="contribution" nameKey="name"
                cx="40%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {drivers.map((_, i) => (
                  <Cell key={i} fill={DRIVER_COLORS[i % DRIVER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Driver impact bars */}
        <ChartCard title="Driver impact (% demand lift)"
          subtitle="Modeled lift attributed to each driver" icon={Flame}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={drivers} layout="vertical"
              margin={{ top: 10, right: 12, left: 60, bottom: 0 }}>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis type="number" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
              <YAxis type="category" dataKey="name" stroke="#D4DDD3" tick={{ fontSize: 11, fill: '#0A1F14' }} width={110} />
              <Tooltip formatter={(v) => `+${v}%`} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="delta_pct" radius={[0, 4, 4, 0]}>
                {drivers.map((_, i) => (
                  <Cell key={i} fill={DRIVER_COLORS[i % DRIVER_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ── TAB 3 · 6-Month Performance ─────────────────────────────────────────────

function PerformanceTab({ a }) {
  const daily = a.sales_history?.daily || [];
  const monthly = a.sales_history?.monthly || [];
  const compAvg = a.competitor_stats?.avg_price || a.current_price || 0;
  const compMin = a.competitor_stats?.min_price || compAvg * 0.85;
  const compMax = a.competitor_stats?.max_price || compAvg * 1.2;

  // Multi-line: our price · competitors · units
  const multiLine = daily.slice(-90).map((d) => ({
    date: d.date.slice(5),
    yourPrice: d.price,
    units: d.units,
    compAvg, compMin, compMax,
  }));

  // Candlestick representation (using high-low bars + open/close markers)
  const candles = (a.price_candles || []).map((c) => ({
    week: c.week.slice(5),
    open: c.open, high: c.high, low: c.low, close: c.close,
    rangeLow: c.low, rangeSpan: c.high - c.low,
    bullish: c.close >= c.open,
  }));

  // Inventory burn
  const burn = a.inventory_burn || [];

  // Waterfall
  const waterfall = a.revenue_waterfall || [];

  // Correlation matrix
  const corr = a.correlation_matrix || [];
  const vars = useMemo(() => Array.from(new Set(corr.map((c) => c.x))), [corr]);

  // Radar
  const radar = a.radar_metrics || [];

  return (
    <div className="sb-tab">
      {/* Multi-line: prices + units */}
      <ChartCard title="Price corridor vs your price (90 days)"
        subtitle="Your selling price tracked against market band" icon={LineChartIcon} full>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={multiLine} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="mlBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E6EDE5" />
            <XAxis dataKey="date" stroke="#D4DDD3" tick={{ fontSize: 9, fill: '#0A1F14' }}
              interval={Math.max(0, Math.floor(multiLine.length / 10))} />
            <YAxis yAxisId="L" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
            <YAxis yAxisId="R" orientation="right" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area yAxisId="L" type="monotone" dataKey="compMax" stroke="none" fill="url(#mlBand)" name="Comp band" />
            <Area yAxisId="L" type="monotone" dataKey="compMin" stroke="none" fill="#E6EDE5" />
            <Line yAxisId="L" type="monotone" dataKey="compAvg" stroke="#2D4A3E" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Market avg" />
            <Line yAxisId="L" type="monotone" dataKey="yourPrice" stroke="#1A5D3A" strokeWidth={2.2} dot={false} name="Your price" />
            <Bar yAxisId="R" dataKey="units" fill="rgba(26, 93, 58, 0.45)" radius={[3, 3, 0, 0]} name="Units sold" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="sb-charts">
        {/* Candlestick-style pricing */}
        <ChartCard title="Weekly price OHLC"
          subtitle="Open · High · Low · Close — candlestick view" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={candles} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis dataKey="week" stroke="#D4DDD3" tick={{ fontSize: 9, fill: '#0A1F14' }} />
              <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} domain={['auto', 'auto']} />
              <Tooltip formatter={(v, n) => n === 'rangeSpan' ? null : INR(v)} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="rangeLow" stackId="a" fill="transparent" />
              <Bar dataKey="rangeSpan" stackId="a" radius={[3, 3, 3, 3]}>
                {candles.map((c, i) => (
                  <Cell key={i} fill={c.bullish ? '#1A5D3A' : '#EF4444'} fillOpacity={0.85} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="close" stroke="#1A5D3A" strokeWidth={1.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Inventory burn */}
        <ChartCard title="Inventory burn-down (60-day projection)"
          subtitle="Stock depletion at current velocity" icon={Package}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={burn} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="burn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis dataKey="date" stroke="#D4DDD3" tick={{ fontSize: 9, fill: '#0A1F14' }}
                interval={Math.max(0, Math.floor(burn.length / 8))} />
              <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="stock" stroke="#1A5D3A" strokeWidth={2} fill="url(#burn)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue waterfall */}
        <ChartCard title="Revenue waterfall"
          subtitle="Month-over-month revenue contribution" icon={Wallet}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={waterfall} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis dataKey="label" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
              <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
              <Tooltip formatter={(v) => INR(v)} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfall.map((w, i) => (
                  <Cell key={i} fill={
                    w.type === 'up' ? '#1A5D3A' :
                    w.type === 'down' ? '#EF4444' :
                    w.type === 'total' ? '#1A5D3A' : '#3B82F6'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar */}
        <ChartCard title="Composite radar" subtitle="6-axis product+market+inventory profile" icon={Gauge}>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radar}>
              <PolarGrid stroke="#D4DDD3" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#0A1F14' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#2D4A3E' }} />
              <Radar name="Profile" dataKey="value" stroke="#1A5D3A" fill="#1A5D3A" fillOpacity={0.35} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Correlation matrix */}
      <ChartCard title="Correlation matrix" subtitle="Pairwise correlations between key signals"
        icon={Sigma} full>
        <div className="sb-corr">
          <div className="sb-corr__head">
            <div />
            {vars.map((v) => <div key={v} className="sb-corr__cell-h">{v}</div>)}
          </div>
          {vars.map((y) => (
            <div key={y} className="sb-corr__row">
              <div className="sb-corr__row-lbl">{y}</div>
              {vars.map((x) => {
                const cell = corr.find((c) => c.x === x && c.y === y);
                const val = cell?.value ?? 0;
                const pos = val >= 0;
                const intensity = Math.min(1, Math.abs(val));
                const bg = pos
                  ? `rgba(91, 227, 168, ${intensity * 0.75})`
                  : `rgba(255, 122, 122, ${intensity * 0.75})`;
                return (
                  <div key={x} className="sb-corr__cell" style={{ background: bg }}>
                    {val.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Monthly performance summary */}
      <ChartCard title="Monthly performance summary"
        subtitle="Units sold × revenue × average price" icon={BarChart3} full>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={monthly} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#E6EDE5" />
            <XAxis dataKey="month" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
            <YAxis yAxisId="L" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
            <YAxis yAxisId="R" orientation="right" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="L" dataKey="units" fill="#1A5D3A" radius={[4, 4, 0, 0]} name="Units sold" />
            <Line yAxisId="R" type="monotone" dataKey="revenue" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
            <Line yAxisId="R" type="monotone" dataKey="avg_price" stroke="#3B82F6" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Avg price" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ── TAB 4 · Product Lifecycle ───────────────────────────────────────────────

function LifecycleTab({ a }) {
  const lc = a.lifecycle || {};
  const stage = lc.stage || 'maturity';
  const stages = ['introduction', 'growth', 'maturity', 'saturation', 'decline'];
  const stageIdx = Math.max(0, stages.indexOf(stage));
  const progress = ((stageIdx + 1) / stages.length) * 100;

  // Indicator badges per stage
  const stageIndicators = {
    introduction: ['Recently launched', 'High variance in early sales', 'Limited competitor data'],
    growth:       ['Rising sales velocity', 'Increasing search trend', 'Expanding competitor listings', 'Improving conversion rates'],
    maturity:     ['Stable demand', 'Established competitor set', 'Predictable seasonality'],
    saturation:   ['Demand plateauing', 'Heavy competitive pricing', 'Diminishing returns'],
    decline:      ['Falling sales velocity', 'Markdown pressure rising', 'Inventory turning slowly'],
  };
  const indicators = stageIndicators[stage] || stageIndicators.maturity;

  return (
    <div className="sb-tab">
      <div className="sb-lc-hero">
        <div className="sb-lc-hero__title">
          <span className="sb-lc-hero__kicker">Product Lifecycle Detection</span>
          <h2>
            Currently in{' '}
            <span className="sb-lc-hero__stage">{lifecycleLabel(stage)}</span> stage
          </h2>
          <p>{lc.explanation || 'AI-classified using trend, variance, and momentum signals.'}</p>
          <div className="sb-lc-hero__conf">
            <AIPulse size={16} />
            <span>AI confidence · {Math.round((lc.confidence || 0.7) * 100)}%</span>
          </div>
        </div>

        {/* Animated timeline */}
        <div className="sb-lc-timeline">
          <div className="sb-lc-timeline__track">
            <motion.div
              className="sb-lc-timeline__fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: EASE }}
            />
            <motion.div
              className="sb-lc-timeline__glow"
              initial={{ left: 0 }}
              animate={{ left: `${progress}%` }}
              transition={{ duration: 1.2, ease: EASE }}
            />
          </div>
          <div className="sb-lc-timeline__nodes">
            {stages.map((s, i) => {
              const reached = i <= stageIdx;
              const active  = i === stageIdx;
              return (
                <div key={s} className={`sb-lc-node ${reached ? 'is-reached' : ''} ${active ? 'is-active' : ''}`}>
                  <div className="sb-lc-node__dot" />
                  <div className="sb-lc-node__lbl">{lifecycleLabel(s)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Indicators */}
      <ChartCard title={`Why ${lifecycleLabel(stage)}?`}
        subtitle="Signals that triggered this classification" icon={Brain} full>
        <ul className="sb-indicators">
          {indicators.map((ind, i) => (
            <motion.li key={ind}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}>
              <CircleDot size={14} />
              <span>{ind}</span>
            </motion.li>
          ))}
        </ul>
      </ChartCard>

      {/* Lifecycle stats */}
      <div className="sb-tiles">
        <StatTile label="Trend score" value={Number(lc.trend_score || 0).toFixed(3)}
          sub={lc.trend_score >= 0 ? 'Net positive momentum' : 'Net negative momentum'}
          icon={Activity} tone={lc.trend_score >= 0 ? 'good' : 'bad'} />
        <StatTile label="Recent 30d avg" value={`${lc.recent_30d_avg_units || 0} u/day`}
          sub={`Prior 30d: ${lc.prior_30d_avg_units || 0} u/day`} icon={TU} />
        <StatTile label="Variance (CoV)" value={Number(lc.cv_recent || 0).toFixed(3)}
          sub="Lower = more predictable" icon={Sigma} />
        <StatTile label="Confidence" value={PCT((lc.confidence || 0) * 100, 0)}
          sub="In current classification" icon={Brain} />
      </div>
    </div>
  );
}

// ── TAB 5 · Inventory + Market ──────────────────────────────────────────────

function InventoryMarketTab({ a }) {
  const inv = a.inventory || {};
  const mm = a.market_metrics || {};
  const scenarios = a.pricing_scenarios || [];

  // Inventory risk badges
  const deadStockProb = inv.demand_trend === 'falling' && (inv.days_of_cover || 0) > 90 ? 0.62
                      : inv.demand_trend === 'falling' ? 0.28 : 0.08;
  const overstockRisk = (inv.days_of_cover || 0) > 90 ? 'high' : (inv.days_of_cover || 0) > 60 ? 'medium' : 'low';
  const stockoutRisk = mm.stockout_probability >= 0.4 ? 'high' : mm.stockout_probability >= 0.18 ? 'medium' : 'low';

  return (
    <div className="sb-tab">
      {/* Risk tiles */}
      <div className="sb-tiles">
        <StatTile label="Dead-stock probability" value={PCT(deadStockProb * 100, 0)}
          sub="Will not sell within 90 days" icon={Snowflake}
          tone={deadStockProb > 0.4 ? 'bad' : deadStockProb > 0.2 ? 'warn' : 'good'} />
        <StatTile label="Overstock risk" value={overstockRisk}
          sub={`${Math.round(inv.days_of_cover || 0)} days of cover`} icon={Package}
          tone={overstockRisk === 'high' ? 'bad' : overstockRisk === 'medium' ? 'warn' : 'good'} />
        <StatTile label="Stockout risk" value={stockoutRisk}
          sub={`${PCT((mm.stockout_probability || 0) * 100, 0)} likelihood`} icon={ShieldAlert}
          tone={stockoutRisk === 'high' ? 'bad' : stockoutRisk === 'medium' ? 'warn' : 'good'} />
        <StatTile label="Inventory health" value={`${inv.inventory_health_score || 0}/100`}
          sub={`Demand trend: ${inv.demand_trend || 'stable'}`} icon={Gauge}
          tone={(inv.inventory_health_score || 0) > 70 ? 'good' : (inv.inventory_health_score || 0) > 50 ? 'warn' : 'bad'} />
      </div>

      {/* Pricing scenarios table */}
      <ChartCard title="Dynamic pricing scenarios"
        subtitle="What happens to sales, revenue, and margin at each price tier" icon={Zap} full>
        <div className="sb-scen">
          <div className="sb-scen__head">
            <span>Price Δ</span>
            <span>New price</span>
            <span>Sales lift</span>
            <span>Revenue Δ</span>
            <span>Margin</span>
            <span>Margin Δ</span>
          </div>
          {scenarios.map((s, i) => {
            const baseline = s.delta_pct === 0;
            const good = s.revenue_change_pct > 0 && s.margin_change_pp >= -1;
            return (
              <motion.div key={i}
                className={`sb-scen__row ${baseline ? 'is-baseline' : ''} ${good && !baseline ? 'is-good' : ''}`}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}>
                <strong className={`sb-scen__delta ${s.delta_pct > 0 ? 'is-up' : s.delta_pct < 0 ? 'is-down' : ''}`}>
                  {s.delta_pct > 0 ? `+${s.delta_pct}%` : `${s.delta_pct}%`}
                </strong>
                <span>{INR(s.new_price)}</span>
                <span className={s.sales_lift_pct > 0 ? 'sb-pos' : s.sales_lift_pct < 0 ? 'sb-neg' : ''}>
                  {s.sales_lift_pct > 0 ? '+' : ''}{s.sales_lift_pct}%
                </span>
                <span className={s.revenue_change_pct > 0 ? 'sb-pos' : s.revenue_change_pct < 0 ? 'sb-neg' : ''}>
                  {s.revenue_change_pct > 0 ? '+' : ''}{s.revenue_change_pct}%
                </span>
                <span>{s.margin_pct}%</span>
                <span className={s.margin_change_pp > 0 ? 'sb-pos' : s.margin_change_pp < 0 ? 'sb-neg' : ''}>
                  {s.margin_change_pp > 0 ? '+' : ''}{s.margin_change_pp}pp
                </span>
              </motion.div>
            );
          })}
        </div>
      </ChartCard>

      {/* Scenario impact chart */}
      <div className="sb-charts">
        <ChartCard title="Revenue vs price scenarios"
          subtitle="Projected revenue change at each price level" icon={Wallet}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scenarios} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis dataKey="delta_pct" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} />
              <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v > 0 ? '+' : ''}${v}%`} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#D4DDD3" strokeDasharray="3 3" />
              <Bar dataKey="revenue_change_pct" radius={[4, 4, 0, 0]}>
                {scenarios.map((s, i) => (
                  <Cell key={i}
                    fill={s.delta_pct === 0 ? '#3B82F6' : s.revenue_change_pct >= 0 ? '#1A5D3A' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Margin simulation"
          subtitle="Margin at each price tier" icon={Target}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={scenarios} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#E6EDE5" />
              <XAxis dataKey="delta_pct" stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} />
              <YAxis stroke="#D4DDD3" tick={{ fontSize: 10, fill: '#0A1F14' }}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="margin_pct" stroke="#1A5D3A" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Recommendations */}
      <ChartCard title="Inventory + market recommendations"
        subtitle="AI-generated next actions" icon={Brain} full>
        <div className="sb-recs">
          {inv.restock_recommendation ? (
            <div className="sb-rec">
              <Zap size={14} />
              <div>
                <h5>Restock signal</h5>
                <p>{typeof inv.restock_recommendation === 'string'
                  ? inv.restock_recommendation
                  : inv.restock_recommendation.action || JSON.stringify(inv.restock_recommendation)}</p>
              </div>
            </div>
          ) : null}
          {inv.markdown_recommendation ? (
            <div className="sb-rec sb-rec--warn">
              <AlertTriangle size={14} />
              <div>
                <h5>Markdown signal</h5>
                <p>{typeof inv.markdown_recommendation === 'string'
                  ? inv.markdown_recommendation
                  : inv.markdown_recommendation.action || JSON.stringify(inv.markdown_recommendation)}</p>
              </div>
            </div>
          ) : null}
          {inv.clearance_price ? (
            <div className="sb-rec">
              <Tag size={14} />
              <div>
                <h5>Suggested clearance price</h5>
                <p>{INR(inv.clearance_price)} — moves ~80% of stock in 30 days</p>
              </div>
            </div>
          ) : null}
        </div>
      </ChartCard>
    </div>
  );
}

// ── Command Center shell ────────────────────────────────────────────────────

function CommandCenter({ build, analysis, loading, onBack, onBuildStrategy }) {
  const [tab, setTab] = useState('overview');
  const [objective, setObjective] = useState('maximize_revenue');
  const [horizon, setHorizon] = useState(30);
  const [aggressiveness, setAggressiveness] = useState(0.5);
  const product = build.product;

  return (
    <motion.div className="sb-deep"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: EASE }}>
      <div className="sb-deep__bar">
        <button className="sb-back" onClick={onBack}>
          <ArrowLeft size={14} /> Back to products
        </button>
        <div className="sb-deep__product">
          {product.image ? <img src={product.image} alt={product.name} /> : null}
          <div>
            <div className="sb-deep__cat">AI Strategy Command Center · {product.category} · {product.sku}</div>
            <h1>{product.name}</h1>
          </div>
        </div>
      </div>

      {loading || !analysis ? (
        <div className="sb-deep__loading">
          <AIPulse />
          <p>Running 8 intelligence engines · forecasting 180 days · classifying lifecycle…</p>
        </div>
      ) : (
        <>
          {/* Tab strip */}
          <div className="sb-tabs">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button key={t.id} type="button"
                  className={`sb-tabbtn ${on ? 'is-on' : ''}`}
                  onClick={() => setTab(t.id)}>
                  <Icon size={14} />
                  <span>{t.label}</span>
                  {on ? <motion.span layoutId="tab-underline" className="sb-tabbtn__line" /> : null}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE }}>
              {tab === 'overview'    && <MarketOverviewTab    a={analysis} />}
              {tab === 'forecast'    && <ForecastTab          a={analysis} />}
              {tab === 'performance' && <PerformanceTab       a={analysis} />}
              {tab === 'lifecycle'   && <LifecycleTab         a={analysis} />}
              {tab === 'inventory'   && <InventoryMarketTab   a={analysis} />}
            </motion.div>
          </AnimatePresence>

          {/* Build strategy CTA — sticky */}
          <div className="sb-bsp">
            <div className="sb-bsp__head">
              <Brain size={16} />
              <div>
                <h3>Generate dynamic pricing strategy</h3>
                <p>Choose an objective and let the engine ingest every signal in this command center.</p>
              </div>
            </div>
            <div className="sb-bsp__options">
              <div className="sb-bsp__group">
                <label>Objective</label>
                <div className="sb-bsp__pills">
                  {[
                    ['maximize_revenue', 'Max revenue'],
                    ['maximize_margin',  'Max margin'],
                    ['reduce_inventory', 'Reduce inventory'],
                    ['win_market_share', 'Win share'],
                  ].map(([id, lbl]) => (
                    <button key={id} type="button"
                      className={`sb-pill ${objective === id ? 'is-on' : ''}`}
                      onClick={() => setObjective(id)}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div className="sb-bsp__group">
                <label>Horizon</label>
                <div className="sb-bsp__pills">
                  {[14, 30, 60, 90].map((d) => (
                    <button key={d} type="button"
                      className={`sb-pill ${horizon === d ? 'is-on' : ''}`}
                      onClick={() => setHorizon(d)}>{d} days</button>
                  ))}
                </div>
              </div>
              <div className="sb-bsp__group">
                <label>Aggressiveness — <span>{Math.round(aggressiveness * 100)}%</span></label>
                <input type="range" min="0" max="1" step="0.05" value={aggressiveness}
                  onChange={(e) => setAggressiveness(parseFloat(e.target.value))} className="sb-range" />
              </div>
            </div>
            <button type="button" className="sb-build-cta"
              onClick={() => onBuildStrategy({ objective, horizon, aggressiveness })}>
              <Sparkles size={16} /><span>Build strategy</span><ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ── Build sequence & Result ─────────────────────────────────────────────────

const BUILD_STEPS = [
  { icon: Brain,    label: 'Loading marketplace intelligence' },
  { icon: Activity, label: 'Synthesising 180-day demand forecast' },
  { icon: Layers,   label: 'Reading competitor price landscape' },
  { icon: Package,  label: 'Analysing inventory health' },
  { icon: Gauge,    label: 'Estimating elasticity & lifecycle' },
  { icon: Cpu,      label: 'Generating candidate strategies' },
  { icon: Sparkles, label: 'Ranking by objective score' },
];

function BuildSequence({ onDone, result }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= BUILD_STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 480);
    return () => clearTimeout(t);
  }, [step]);
  useEffect(() => {
    if (result && step >= BUILD_STEPS.length - 1) {
      const t = setTimeout(onDone, 350);
      return () => clearTimeout(t);
    }
  }, [result, step, onDone]);
  return (
    <motion.div className="sb-build"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <GradientMesh />
      <FloatingParticles count={36} />
      <div className="sb-build__inner">
        <AIPulse />
        <h2>Crafting your strategy</h2>
        <p>Real-time fusion of marketplace, demand, inventory, and pricing signals.</p>
        <ul className="sb-build__steps">
          {BUILD_STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <motion.li key={s.label}
                className={`sb-build__step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}>
                {done ? <Check size={14} /> : active ? <CircleDot size={14} /> : <s.icon size={14} />}
                <span>{s.label}</span>
                {active ? (
                  <motion.span className="sb-build__shimmer"
                    initial={{ x: '-100%' }} animate={{ x: '100%' }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }} />
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}

function StrategyResult({ build, strategies, onBack }) {
  const list = strategies?.strategies || strategies?.candidates || strategies || [];
  const topList = Array.isArray(list) ? list.slice(0, 5) : [];
  return (
    <motion.div className="sb-result"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <div className="sb-deep__bar">
        <button className="sb-back" onClick={onBack}>
          <ArrowLeft size={14} /> Back to analysis
        </button>
        <div className="sb-deep__product">
          {build.product.image ? <img src={build.product.image} alt={build.product.name} /> : null}
          <div>
            <div className="sb-deep__cat">Strategy bundle</div>
            <h1>{build.product.name}</h1>
          </div>
        </div>
      </div>
      <div className="sb-result__grid">
        {topList.length === 0 ? (
          <div className="sb-empty"><Brain size={28} /><h3>No candidates returned</h3></div>
        ) : topList.map((s, i) => (
          <motion.div key={s.id || s.name || i} className={`sb-strategy ${i === 0 ? 'is-best' : ''}`}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: i * 0.06 }}>
            {i === 0 ? <div className="sb-strategy__crown">Best match</div> : null}
            <div className="sb-strategy__name">{s.name || s.archetype || `Strategy ${i + 1}`}</div>
            <div className="sb-strategy__price">{INR(s.price || s.recommended_price)}</div>
            <div className="sb-strategy__sub">
              {s.archetype ? <span>{s.archetype}</span> : null}
              {s.objective_score != null ? <span>· score {Number(s.objective_score).toFixed(2)}</span> : null}
            </div>
            <div className="sb-strategy__stats">
              {s.expected_units != null && <div><span>Expected units</span><strong>{Math.round(s.expected_units)}</strong></div>}
              {s.expected_revenue != null && <div><span>Expected revenue</span><strong>{INR(s.expected_revenue)}</strong></div>}
              {s.expected_margin != null && <div><span>Margin</span><strong>{INR(s.expected_margin)}</strong></div>}
              {s.confidence != null && <div><span>Confidence</span><strong>{PCT((s.confidence || 0) * 100, 0)}</strong></div>}
            </div>
            {s.rationale ? <p className="sb-strategy__rationale">{s.rationale}</p> : null}
            {Array.isArray(s.drivers) && s.drivers.length ? (
              <div className="sb-strategy__drivers">
                {s.drivers.slice(0, 4).map((d, k) => (
                  <span key={k} className="sb-strategy__driver">{typeof d === 'string' ? d : d.label}</span>
                ))}
              </div>
            ) : null}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function StrategyBuilder() {
  const { builds } = useBuiltMarketplaces();
  const [phase, setPhase] = useState('picker'); // picker | deep | building | result
  const [active, setActive] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [loadingDeep, setLoadingDeep] = useState(false);
  const [strategyResult, setStrategyResult] = useState(null);

  // Pre-fetch analysis for the cards (for sparkline + health)
  useEffect(() => {
    let cancelled = false;
    const toFetch = builds.slice(0, 12).filter((b) => !analyses[b.product.id]);
    toFetch.forEach((b) => {
      API.get(`/api/strategy/deep-analysis/${b.product.id}`)
        .then((res) => { if (!cancelled) setAnalyses((p) => ({ ...p, [b.product.id]: res.data })); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builds.length]);

  const openProduct = useCallback(async (build) => {
    setActive(build);
    setPhase('deep');
    setActiveAnalysis(analyses[build.product.id] || null);
    if (!analyses[build.product.id]) {
      setLoadingDeep(true);
      try {
        const res = await API.get(`/api/strategy/deep-analysis/${build.product.id}`);
        setActiveAnalysis(res.data);
        setAnalyses((p) => ({ ...p, [build.product.id]: res.data }));
      } catch (err) {
        console.warn('Deep analysis failed', err);
      } finally { setLoadingDeep(false); }
    }
  }, [analyses]);

  const buildStrategy = useCallback(async ({ objective, horizon, aggressiveness }) => {
    if (!active) return;
    setPhase('building');
    setStrategyResult(null);
    try {
      const res = await API.get(`/api/strategy/generate/${active.product.id}`, {
        params: { objective, horizon_days: horizon, aggressiveness, top_k: 5 },
      });
      setStrategyResult(res.data);
    } catch (err) {
      console.warn('Strategy generation failed', err);
      setStrategyResult({ strategies: [] });
    }
  }, [active]);

  return (
    <div className="sb-page">
      <AnimatePresence mode="wait">
        {phase === 'picker' && (
          <motion.div key="picker"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <Hero totalBuilds={builds.length} />
            {builds.length === 0 ? (
              <div className="sb-empty sb-empty--hero">
                <Rocket size={42} />
                <h3>You haven&apos;t built any marketplaces yet</h3>
                <p>Head to <strong>Marketplace Intelligence</strong>, scan a product, and the result lands here.</p>
              </div>
            ) : (
              <ProductPicker builds={builds} analyses={analyses} onOpen={openProduct} />
            )}
          </motion.div>
        )}
        {phase === 'deep' && active && (
          <motion.div key="deep"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <CommandCenter
              build={active}
              analysis={activeAnalysis}
              loading={loadingDeep}
              onBack={() => setPhase('picker')}
              onBuildStrategy={buildStrategy}
            />
          </motion.div>
        )}
        {phase === 'building' && (
          <motion.div key="build"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <BuildSequence result={strategyResult} onDone={() => setPhase('result')} />
          </motion.div>
        )}
        {phase === 'result' && active && (
          <motion.div key="result"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <StrategyResult build={active} strategies={strategyResult}
              onBack={() => setPhase('deep')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
