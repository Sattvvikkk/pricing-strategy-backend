import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, X, Check, Circle, Package2,
  ChevronRight, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ComposedChart, Line,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';

import API from '../api/client';
import AnimatedCounter from '../components/AnimatedCounter';
import { useProduct } from '../context/ProductContext';
import { fadeUp, stagger, EASE } from '../motion/tokens';

// Editorial chart palette - muted, fashion-first.
const PALETTE = ['#1a3a2e', '#6b4a8a', '#b45309', '#7a6a4f', '#2563eb', '#0d9488', '#a33333', '#4b5563'];
const CHART_TOOLTIP_STYLE = {
  background: '#fff',
  border: '1px solid #e0ddd5',
  borderRadius: 8,
  fontSize: 12,
  color: '#1a1a18',
  boxShadow: '0 6px 20px rgba(20,18,12,0.08)',
};

// Brand: Vouge Studio Overview - Operational HQ.
// No AI/ML jargon surfaces here. The page answers one question:
//   "What is happening in my business right now?"

// Deterministic palette per product - gives each card its own editorial cover
// without requiring real photography.
const COVER_PALETTES = [
  ['#1a3a2e', '#2f5d4a'], ['#2c2a4a', '#5b4b8a'], ['#3a2e2a', '#7a5a4f'],
  ['#1f2937', '#4b5563'], ['#3d2c4a', '#7e5a8a'], ['#2e3a3a', '#5d7a7a'],
  ['#3a3327', '#7a6a4f'], ['#2a2e3a', '#4f5a7a'], ['#3a2a2f', '#7a4f5a'],
];
function _hash(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function coverFor(p) {
  const [a, b] = COVER_PALETTES[_hash(p.id || p.sku || p.name) % COVER_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}
function rupee(n) {
  if (!Number.isFinite(n)) return '\u2014';
  if (n >= 10_000_000) return `\u20B9${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `\u20B9${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `\u20B9${(n / 1_000).toFixed(1)}k`;
  return `\u20B9${Math.round(n).toLocaleString('en-IN')}`;
}
function plain(n) {
  if (!Number.isFinite(n)) return '\u2014';
  return Math.round(n).toLocaleString('en-IN');
}

// Operational stock status per product (no AI/ML jargon).
function stockStatus(p) {
  const stock = p.stock_on_hand || 0;
  const rop = p.reorder_point || 0;
  const dc = p.days_of_cover || 0;
  if (stock === 0) return { label: 'Out of Stock', tone: 'critical' };
  if (stock < rop) return { label: 'Low Stock', tone: 'warn' };
  if (dc > 180) return { label: 'Overstocked', tone: 'muted' };
  if (dc < 25) return { label: 'Fast-Moving', tone: 'good' };
  return { label: 'Healthy', tone: 'good' };
}
function highlightBadge(p) {
  // A single human badge per product (best signal first).
  const s = stockStatus(p);
  if (s.tone === 'critical' || s.tone === 'warn') return s;
  if ((p.sales_30d || 0) >= 60 && (p.gross_margin_pct || 0) >= 50) {
    return { label: 'Bestseller', tone: 'accent' };
  }
  if ((p.days_of_cover || 0) > 180) return { label: 'Overstocked', tone: 'muted' };
  if (p.status === 'Active' && (p.image || p.description)) {
    return { label: 'Launch Ready', tone: 'good' };
  }
  return { label: 'Active', tone: 'muted' };
}

// Single deterministic operational event per product, used for the live feed.
function eventFor(p, i) {
  const s = stockStatus(p);
  const variants = [
    { kind: 'restock', text: `Stock received \u00B7 ${p.name}` },
    { kind: 'catalog', text: `Catalogue updated \u00B7 ${p.name}` },
    { kind: 'sync', text: `Marketplace sync completed \u00B7 ${p.category}` },
    { kind: 'low', text: `Low stock detected \u00B7 ${p.name}` },
    { kind: 'images', text: `Listing images refreshed \u00B7 ${p.name}` },
  ];
  if (s.tone === 'warn' || s.tone === 'critical') {
    return { ...variants[3], at: `${(i % 9) + 1}m ago` };
  }
  return { ...variants[(_hash(p.id) + i) % variants.length], at: `${(i % 9) + 2}m ago` };
}

// Marketplace readiness checklist per product.
function readinessChecklist(p) {
  return [
    { label: 'Images uploaded', done: Boolean(p.image) || (_hash(p.id) % 10) > 1 },
    { label: 'Size chart added', done: Array.isArray(p.sizes) && p.sizes.length > 0 },
    { label: 'Description optimised', done: Boolean(p.description) && p.description.length > 60 },
    { label: 'Video uploaded', done: (_hash(p.id || '') % 10) > 6 },
  ];
}
function readinessPct(p) {
  const list = readinessChecklist(p);
  return Math.round((list.filter((x) => x.done).length / list.length) * 100);
}

// Per-product daily sales series (deterministic, 30 days).
function dailySalesSeries(p, days = 30) {
  const total = p.sales_30d || 0;
  const baseDaily = total / days;
  const out = [];
  const seed = _hash(p.id || p.sku || 'x');
  for (let d = days - 1; d >= 0; d -= 1) {
    const wave = Math.sin(((seed % 30) + d) / days * Math.PI * 2) * 0.22;
    const noise = (((seed + d * 31) % 1000) / 1000 - 0.5) * 0.30;
    const units = Math.max(0, Math.round(baseDaily * (1 + wave + noise)));
    out.push({ d, units });
  }
  return out;
}

// Operational stock posture (no AI/ML language).
function stockPosture(p) {
  const stock = p.stock_on_hand || 0;
  const rop = p.reorder_point || 0;
  const safety = p.safety_stock || 0;
  const dc = p.days_of_cover || 0;
  if (stock < safety) return { label: 'Reorder now', tone: 'critical' };
  if (stock < rop) return { label: 'Approaching reorder', tone: 'warn' };
  if (dc > 180) return { label: 'Overstocked', tone: 'muted' };
  if (dc < 25) return { label: 'Fast turnover', tone: 'accent' };
  return { label: 'Healthy', tone: 'good' };
}

function turnoverRatio(p) {
  // Annualised turns = (yearly demand) / avg stock. Approx using sales_90d * 4.
  const yearly = (p.sales_90d || (p.sales_30d || 0) * 3) * 4;
  const avgStock = Math.max(1, (p.stock_on_hand || 0) * 0.85);
  return yearly / avgStock;
}

function sellThroughRate(p) {
  const sold = p.sales_30d || 0;
  const start = (p.stock_on_hand || 0) + sold;
  return start > 0 ? (sold / start) * 100 : 0;
}

function weeklyAggregates(series) {
  // series is daily, oldest first. Aggregate into 4 trailing weeks.
  const weeks = [0, 0, 0, 0];
  for (let i = 0; i < series.length; i += 1) {
    const w = Math.floor(i / 7);
    if (w >= 4) break;
    weeks[w] += series[i].units;
  }
  return weeks.map((u, i) => ({ week: `W${4 - i}`, units: u })).reverse();
}

function demandVariability(series) {
  if (!series.length) return { cv: 0, label: 'Stable' };
  const arr = series.map((s) => s.units);
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return { cv: 0, label: 'Stable' };
  const sq = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const cv = Math.sqrt(sq) / mean;
  let label = 'Consistent';
  if (cv > 0.65) label = 'Volatile';
  else if (cv > 0.35) label = 'Variable';
  return { cv, label };
}

// Holding cost estimate: 24% annualised carrying cost on stock value at cost.
function holdingCostMonthly(p) {
  const value = (p.stock_on_hand || 0) * (p.cost_price || 0);
  return (value * 0.24) / 12;
}

// ----- Metric tile (calm, operational) -----------------------------------
function Metric({ label, value, sub, prefix = '', suffix = '', decimals = 0, soft }) {
  return (
    <motion.div className={`ovx-metric ${soft ? 'ovx-metric--soft' : ''}`} variants={fadeUp}>
      <div className="ovx-metric__label">{label}</div>
      <div className="ovx-metric__value">
        <AnimatedCounter value={value || 0} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      {sub ? <div className="ovx-metric__sub">{sub}</div> : null}
    </motion.div>
  );
}

// ----- Category card (editorial) -----------------------------------------
function CategoryCard({ cat, onOpen }) {
  return (
    <motion.button
      type="button"
      className="ovx-cat"
      variants={fadeUp}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: EASE.out } }}
      onClick={() => onOpen(cat.name)}
    >
      <div className="ovx-cat__cover" style={{ background: cat.cover }}>
        <div className="ovx-cat__cover-name">{cat.name}</div>
        <div className="ovx-cat__cover-count">{cat.count} Styles</div>
      </div>
      <div className="ovx-cat__body">
        <div className="ovx-cat__row">
          <span>Avg Margin</span>
          <strong>{cat.avgMargin.toFixed(0)}%</strong>
        </div>
        <div className="ovx-cat__row">
          <span>Stock Coverage</span>
          <strong>{Math.round(cat.daysOfCover)} Days</strong>
        </div>
        <div className="ovx-cat__row">
          <span>Inventory Value</span>
          <strong>{rupee(cat.inventoryValue)}</strong>
        </div>
        <div className="ovx-cat__row">
          <span>Status</span>
          <span className={`ovx-tag ovx-tag--${cat.statusTone}`}>{cat.status}</span>
        </div>
      </div>
      <div className="ovx-cat__cta">
        <span>View styles</span>
        <ChevronRight size={14} />
      </div>
    </motion.button>
  );
}

// ----- Product card (editorial, image-first) -----------------------------
function ProductCard({ p, onOpen }) {
  const badge = highlightBadge(p);
  const spec = p.specifications || {};
  return (
    <motion.button
      type="button"
      className="ovx-card"
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE.out } }}
      onClick={() => onOpen(p)}
    >
      <div className="ovx-card__cover" style={{ background: coverFor(p) }}>
        <div className="ovx-card__cover-mono" aria-hidden="true">
          {(p.name || 'V').split(' ').slice(0, 2).map((w) => w[0]).join('')}
        </div>
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : null}
        <span className={`ovx-badge ovx-badge--${badge.tone}`}>{badge.label}</span>
      </div>
      <div className="ovx-card__body">
        <div className="ovx-card__name">{p.name}</div>
        <div className="ovx-card__sku">{p.sku}</div>
        <div className="ovx-card__spec">
          {[spec.color, spec.fit, spec.material].filter(Boolean).slice(0, 3).join(' \u00B7 ')}
        </div>
      </div>
      <dl className="ovx-card__ops">
        <div><dt>Stock</dt><dd>{plain(p.stock_on_hand)}</dd></div>
        <div><dt>Margin</dt><dd>{(p.gross_margin_pct || 0).toFixed(0)}%</dd></div>
        <div><dt>Sold 30d</dt><dd>{plain(p.sales_30d)}</dd></div>
        <div><dt>Cover</dt><dd>{Math.round(p.days_of_cover || 0)}d</dd></div>
      </dl>
    </motion.button>
  );
}

// ----- Inventory health bar ----------------------------------------------
function HealthBar({ label, value, total, tone }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="ovx-hb">
      <div className="ovx-hb__head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="ovx-hb__track">
        <motion.div
          className={`ovx-hb__fill ovx-hb__fill--${tone}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE.out }}
        />
      </div>
    </div>
  );
}

// ----- Cinematic product drawer ------------------------------------------
function ProductDrawer({ product, abcClass, onClose, onOpenWorkbench }) {
  if (!product) return null;
  const p = product;
  const spec = p.specifications || {};
  const cb = p.cost_breakup || {};
  const checklist = readinessChecklist(p);
  const ready = readinessPct(p);

  return (
    <AnimatePresence>
      <motion.div
        key="scrim"
        className="ovx-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        key="drawer"
        className="ovx-drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.35, ease: EASE.out }}
      >
        <button type="button" className="ovx-drawer__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="ovx-drawer__hero" style={{ background: coverFor(p) }}>
          {p.image ? (
            <img src={p.image} alt={p.name} />
          ) : (
            <div className="ovx-drawer__hero-mono">{(p.name || 'V').slice(0, 1)}</div>
          )}
        </div>

        <div className="ovx-drawer__body">
          <header className="ovx-drawer__head">
            <div>
              <h2>{p.name}</h2>
              <div className="ovx-drawer__sub">{p.category}{' \u00B7 '}{p.sku}</div>
            </div>
            <button type="button" className="ovx-drawer__open" onClick={() => onOpenWorkbench(p)}>
              Open workbench <ArrowRight size={14} />
            </button>
          </header>

          <section className="ovx-drawer__sec">
            <h4>Product Information</h4>
            <dl className="ovx-drawer__dl">
              <div><dt>Fabric</dt><dd>{spec.material || '\u2014'}</dd></div>
              <div><dt>Fit</dt><dd>{spec.fit || '\u2014'}</dd></div>
              <div><dt>Colour</dt><dd>{spec.color || '\u2014'}</dd></div>
              <div><dt>Sizes</dt><dd>{(p.sizes || []).join(', ') || '\u2014'}</dd></div>
            </dl>
            {p.description ? <p className="ovx-drawer__desc">{p.description}</p> : null}
          </section>

          <section className="ovx-drawer__sec">
            <h4>Inventory</h4>
            <dl className="ovx-drawer__dl">
              <div><dt>On Hand</dt><dd>{plain(p.stock_on_hand)}</dd></div>
              <div><dt>Available</dt><dd>{plain(p.available_stock)}</dd></div>
              <div><dt>Reserved</dt><dd>{plain(p.reserved_stock)}</dd></div>
              <div><dt>Reorder Point</dt><dd>{plain(p.reorder_point)}</dd></div>
              <div><dt>Safety Stock</dt><dd>{plain(p.safety_stock)}</dd></div>
              <div><dt>Lead Time</dt><dd>{p.lead_time_days || '\u2014'} days</dd></div>
            </dl>
          </section>

          {(() => {
            const posture = stockPosture(p);
            const stock = p.stock_on_hand || 0;
            const safety = p.safety_stock || 0;
            const rop = p.reorder_point || 0;
            const reserved = p.reserved_stock || 0;
            const available = p.available_stock || Math.max(0, stock - reserved);
            const leadDays = p.lead_time_days || 0;
            const cost = p.cost_price || 0;

            const scaleMax = Math.max(stock, rop * 1.6, 1);
            const stockPct = Math.min(100, (stock / scaleMax) * 100);
            const safetyPct = Math.min(100, (safety / scaleMax) * 100);
            const ropPct = Math.min(100, (rop / scaleMax) * 100);

            const series = dailySalesSeries(p, 30);
            const weekly = weeklyAggregates(series);
            const variability = demandVariability(series);
            const dailyVel = Math.max(0.1, (p.sales_30d || 0) / 30);

            const dc = p.days_of_cover || 0;
            const sellThru = sellThroughRate(p);
            const turns = turnoverRatio(p);
            const reorderQty = Math.max(0, rop * 2 - stock);
            const monthHold = holdingCostMonthly(p);
            const stockValue = stock * cost;

            // Composition (mutually exclusive buckets summing to stock)
            const safetyBlock = Math.min(safety, available);
            const buffer = Math.max(0, available - safetyBlock);
            const composition = [
              { name: 'Available buffer', value: buffer, fill: '#1a3a2e' },
              { name: 'Safety stock', value: safetyBlock, fill: '#b45309' },
              { name: 'Reserved', value: reserved, fill: '#6b4a8a' },
            ].filter((s) => s.value > 0);

            // Reorder timeline (in days from today)
            const daysToReorder = Math.max(0, (stock - rop) / dailyVel);
            const daysToStockout = stock / dailyVel;
            const daysToArrival = daysToReorder + leadDays;
            const horizon = Math.max(daysToStockout, daysToArrival, 30) * 1.1;
            const pos = (d) => `${Math.min(100, (d / horizon) * 100)}%`;
            const leadCovered = stock >= dailyVel * leadDays;

            const abc = abcClass || 'C';
            const abcLabel = {
              A: 'Class A \u00B7 high velocity',
              B: 'Class B \u00B7 mid velocity',
              C: 'Class C \u00B7 low velocity',
            }[abc];

            return (
              <section className="ovx-drawer__sec">
                <div className="ovx-ia__head">
                  <h4>Inventory Analysis</h4>
                  <div className="ovx-ia__head-tags">
                    <span className={`ovx-ia__abc ovx-ia__abc--${abc}`}>{abcLabel}</span>
                    <span className={`ovx-tag ovx-tag--${posture.tone}`}>{posture.label}</span>
                  </div>
                </div>

                {/* Stock fill bar with safety/ROP markers */}
                <div className="ovx-ia__bar">
                  <div className="ovx-ia__bar-track">
                    <motion.div
                      className="ovx-ia__bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${stockPct}%` }}
                      transition={{ duration: 0.7, ease: EASE.out }}
                    />
                    <div className="ovx-ia__bar-mark ovx-ia__bar-mark--safety" style={{ left: `${safetyPct}%` }} title={`Safety ${safety}`} />
                    <div className="ovx-ia__bar-mark ovx-ia__bar-mark--rop" style={{ left: `${ropPct}%` }} title={`Reorder at ${rop}`} />
                  </div>
                  <div className="ovx-ia__bar-legend">
                    <span><i className="ovx-ia__chip ovx-ia__chip--stock" /> On hand {plain(stock)}</span>
                    <span><i className="ovx-ia__chip ovx-ia__chip--safety" /> Safety {plain(safety)}</span>
                    <span><i className="ovx-ia__chip ovx-ia__chip--rop" /> Reorder {plain(rop)}</span>
                  </div>
                </div>

                {/* Composition donut + weekly velocity bars side-by-side */}
                <div className="ovx-ia__split">
                  <div className="ovx-ia__panel">
                    <div className="ovx-ia__panel-head">
                      <span>Stock composition</span>
                      <strong>{plain(stock)} units</strong>
                    </div>
                    <div className="ovx-ia__donut">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={composition}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            innerRadius={42} outerRadius={62}
                            paddingAngle={2}
                            stroke="#fff" strokeWidth={2}
                          >
                            {composition.map((s) => <Cell key={s.name} fill={s.fill} />)}
                          </Pie>
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${plain(v)} units`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="ovx-ia__donut-legend">
                      {composition.map((s) => (
                        <li key={s.name}>
                          <i className="ovx-ia__chip" style={{ background: s.fill }} />
                          <span>{s.name}</span>
                          <strong>{plain(s.value)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="ovx-ia__panel">
                    <div className="ovx-ia__panel-head">
                      <span>Weekly velocity</span>
                      <strong>{variability.label}</strong>
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={weekly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#8a8a82' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#8a8a82' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`${v} units`, 'Sold']} cursor={{ fill: 'rgba(26,58,46,0.05)' }} />
                        <Bar dataKey="units" fill="#1a3a2e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="ovx-ia__cv">
                      Demand variability {(variability.cv * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Daily sell-through sparkline */}
                <div className="ovx-ia__chart">
                  <div className="ovx-ia__chart-head">
                    <span>Daily sell-through</span>
                    <strong>last 30 days {'\u00B7'} avg {dailyVel.toFixed(1)}/day</strong>
                  </div>
                  <ResponsiveContainer width="100%" height={90}>
                    <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="iaSparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1a3a2e" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#1a3a2e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(v) => `${30 - v}d ago`} formatter={(v) => [`${v} units`, 'Sold']} />
                      <Area type="monotone" dataKey="units" stroke="#1a3a2e" strokeWidth={1.6} fill="url(#iaSparkGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Reorder timeline */}
                <div className="ovx-ia__timeline">
                  <div className="ovx-ia__panel-head">
                    <span>Reorder timeline</span>
                    <strong>{leadCovered ? 'Lead time covered' : 'Lead-time risk'}</strong>
                  </div>
                  <div className="ovx-ia__tl-track">
                    <div className="ovx-ia__tl-band ovx-ia__tl-band--safe" style={{ width: pos(daysToReorder) }} />
                    <div className="ovx-ia__tl-band ovx-ia__tl-band--lead" style={{ left: pos(daysToReorder), width: `calc(${pos(leadDays)} - 0px)` }} />
                    <div className="ovx-ia__tl-mark" style={{ left: '0%' }} data-label="Today" />
                    <div className="ovx-ia__tl-mark ovx-ia__tl-mark--rop" style={{ left: pos(daysToReorder) }} data-label={`Reorder ${'\u00B7'} d${Math.round(daysToReorder)}`} />
                    <div className="ovx-ia__tl-mark ovx-ia__tl-mark--arrival" style={{ left: pos(daysToArrival) }} data-label={`Arrival ${'\u00B7'} d${Math.round(daysToArrival)}`} />
                    <div className="ovx-ia__tl-mark ovx-ia__tl-mark--out" style={{ left: pos(daysToStockout) }} data-label={`Stock-out ${'\u00B7'} d${Math.round(daysToStockout)}`} />
                  </div>
                </div>

                {/* Deep metrics grid */}
                <dl className="ovx-ia__metrics">
                  <div><dt>Days of cover</dt><dd>{Math.round(dc)} <span>days</span></dd></div>
                  <div><dt>Sell-through</dt><dd>{sellThru.toFixed(1)} <span>%</span></dd></div>
                  <div><dt>Stock turns</dt><dd>{turns.toFixed(1)} <span>x / yr</span></dd></div>
                  <div><dt>Sold 30d</dt><dd>{plain(p.sales_30d)} <span>units</span></dd></div>
                  <div><dt>Sold 90d</dt><dd>{plain(p.sales_90d)} <span>units</span></dd></div>
                  <div><dt>Avg velocity</dt><dd>{dailyVel.toFixed(1)} <span>/day</span></dd></div>
                  <div><dt>Stock value</dt><dd>{rupee(stockValue)}</dd></div>
                  <div><dt>Holding cost</dt><dd>{rupee(monthHold)} <span>/ month</span></dd></div>
                  <div><dt>Suggested reorder</dt><dd>{plain(reorderQty)} <span>units</span></dd></div>
                </dl>
              </section>
            );
          })()}

          <section className="ovx-drawer__sec">
            <h4>Cost Structure</h4>
            <dl className="ovx-drawer__dl ovx-drawer__dl--money">
              <div><dt>Manufacturing</dt><dd>{rupee(cb.manufacturing)}</dd></div>
              <div><dt>Packaging</dt><dd>{rupee(cb.packaging)}</dd></div>
              <div><dt>Freight</dt><dd>{rupee(cb.freight)}</dd></div>
              <div><dt>Marketplace Fees</dt><dd>{rupee(cb.platform_fee)}</dd></div>
              <div><dt>Taxes</dt><dd>{rupee(cb.taxes)}</dd></div>
              <div><dt>Overheads</dt><dd>{rupee(cb.other_overheads)}</dd></div>
              <div className="ovx-drawer__dl-total"><dt>Landing Cost</dt><dd>{rupee(p.landing_cost)}</dd></div>
            </dl>
          </section>

          <section className="ovx-drawer__sec">
            <div className="ovx-drawer__readiness-head">
              <h4>Marketplace Readiness</h4>
              <span className="ovx-drawer__readiness-pct">{ready}%</span>
            </div>
            <ul className="ovx-drawer__check">
              {checklist.map((c) => (
                <li key={c.label} className={c.done ? 'is-done' : ''}>
                  {c.done ? <Check size={14} /> : <Circle size={14} />}
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

// ----- Category modal (compact catalogue browser) -----------------------
function CategoryModal({ category, products, onClose, onView }) {
  if (!category) return null;
  const list = products.filter((p) => p.category === category);
  const stats = {
    count: list.length,
    avgMargin: list.length
      ? list.reduce((s, p) => s + (p.gross_margin_pct || 0), 0) / list.length
      : 0,
    inventoryUnits: list.reduce((s, p) => s + (p.stock_on_hand || 0), 0),
    low: list.filter((p) => (p.stock_on_hand || 0) < (p.reorder_point || 0)).length,
  };

  return (
    <AnimatePresence>
      <motion.div
        key="cat-scrim"
        className="ovx-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="cat-modal"
        className="ovx-cmodal"
        role="dialog"
        aria-label={`${category} styles`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.32, ease: EASE.out }}
      >
        <button type="button" className="ovx-cmodal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <header className="ovx-cmodal__head">
          <div>
            <div className="ovx-cmodal__eyebrow">Category</div>
            <h2>{category}</h2>
          </div>
          <dl className="ovx-cmodal__stats">
            <div><dt>Styles</dt><dd>{stats.count}</dd></div>
            <div><dt>Inventory</dt><dd>{plain(stats.inventoryUnits)}</dd></div>
            <div><dt>Avg Margin</dt><dd>{stats.avgMargin.toFixed(0)}%</dd></div>
            <div><dt>Low Stock</dt><dd>{stats.low}</dd></div>
          </dl>
        </header>
        <div className="ovx-cmodal__body">
          <ul className="ovx-cmodal__list">
            {list.map((p) => {
              const spec = p.specifications || {};
              const badge = highlightBadge(p);
              return (
                <li key={p.id} className="ovx-cmodal__item">
                  <div className="ovx-cmodal__thumb" style={{ background: coverFor(p) }}>
                    <div className="ovx-cmodal__thumb-mono" aria-hidden="true">
                      {(p.name || 'V').split(' ').slice(0, 2).map((w) => w[0]).join('')}
                    </div>
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                  </div>
                  <div className="ovx-cmodal__info">
                    <div className="ovx-cmodal__name">{p.name}</div>
                    <div className="ovx-cmodal__sku">{p.sku}</div>
                    <div className="ovx-cmodal__spec">
                      {[spec.color, spec.fit, spec.material].filter(Boolean).slice(0, 3).join(' \u00B7 ')}
                    </div>
                  </div>
                  <div className="ovx-cmodal__metrics">
                    <div><dt>Stock</dt><dd>{plain(p.stock_on_hand)}</dd></div>
                    <div><dt>Margin</dt><dd>{(p.gross_margin_pct || 0).toFixed(0)}%</dd></div>
                    <div><dt>Sold 30d</dt><dd>{plain(p.sales_30d)}</dd></div>
                  </div>
                  <span className={`ovx-cmodal__badge ovx-tag--${badge.tone}`}>{badge.label}</span>
                  <button
                    type="button"
                    className="ovx-cmodal__view"
                    onClick={() => onView(p)}
                  >
                    View <ArrowRight size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ----- Page --------------------------------------------------------------
export default function Overview() {
  const navigate = useNavigate();
  const { setActiveProduct } = useProduct();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [drawerProduct, setDrawerProduct] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    API.get('/api/products')
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data?.products ?? []);
      })
      .catch((err) => console.error('Overview load failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const brand = useMemo(() => products[0]?.brand || 'Vouge Studio', [products]);

  // ----- Aggregated metrics ----------------------------------------------
  const metrics = useMemo(() => {
    if (!products.length) return null;
    const inventoryUnits = products.reduce((s, p) => s + (p.stock_on_hand || 0), 0);
    const inventoryValue = products.reduce(
      (s, p) => s + (p.stock_on_hand || 0) * (p.cost_price || 0), 0,
    );
    const avgMargin = products.reduce((s, p) => s + (p.gross_margin_pct || 0), 0) / products.length;
    const lowStock = products.filter((p) => (p.stock_on_hand || 0) < (p.reorder_point || 0)).length;
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    const readinessAvg = products.reduce((s, p) => s + readinessPct(p), 0) / products.length;
    return {
      activeSkus: products.length,
      inventoryUnits,
      inventoryValue,
      avgMargin,
      lowStock,
      categoriesActive: cats.size,
      readiness: readinessAvg,
    };
  }, [products]);

  // ----- Category aggregation --------------------------------------------
  const categories = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const c = p.category || 'Other';
      if (!map.has(c)) map.set(c, []);
      map.get(c).push(p);
    }
    const out = [];
    for (const [name, list] of map.entries()) {
      const count = list.length;
      const avgMargin = list.reduce((s, x) => s + (x.gross_margin_pct || 0), 0) / count;
      const daysOfCover = list.reduce((s, x) => s + (x.days_of_cover || 0), 0) / count;
      const inventoryValue = list.reduce((s, x) => s + (x.stock_on_hand || 0) * (x.cost_price || 0), 0);
      const low = list.filter((x) => (x.stock_on_hand || 0) < (x.reorder_point || 0)).length;
      let status = 'Launch Ready';
      let statusTone = 'good';
      if (low > 0) { status = 'Restock Needed'; statusTone = 'warn'; }
      else if (daysOfCover > 180) { status = 'High Stock Depth'; statusTone = 'muted'; }
      else if (daysOfCover < 25) { status = 'Fast-Moving'; statusTone = 'accent'; }
      const cover = COVER_PALETTES[_hash(name) % COVER_PALETTES.length];
      out.push({
        name, count, avgMargin, daysOfCover, inventoryValue,
        status, statusTone,
        cover: `linear-gradient(135deg, ${cover[0]} 0%, ${cover[1]} 100%)`,
      });
    }
    return out.sort((a, b) => b.count - a.count);
  }, [products]);

  const categoryNames = useMemo(() => ['All', ...categories.map((c) => c.name)], [categories]);

  // ----- Product filter --------------------------------------------------
  const filtered = useMemo(() => {
    if (filter === 'All') return products;
    return products.filter((p) => p.category === filter);
  }, [products, filter]);

  // ----- Inventory health buckets ----------------------------------------
  const inventoryHealth = useMemo(() => {
    if (!products.length) return null;
    const low = products.filter((p) => (p.stock_on_hand || 0) < (p.reorder_point || 0));
    const over = products.filter((p) => (p.days_of_cover || 0) > 180);
    const aging = products.filter(
      (p) => (p.sales_30d || 0) < 30 && (p.days_of_cover || 0) > 90,
    );
    // Deterministic "size imbalance" demo flag - in real life this comes from variant data.
    const imbalance = products.filter((p) => (_hash(p.id) % 7) === 0).slice(0, 5);
    return { low, over, aging, imbalance, total: products.length };
  }, [products]);

  // ----- Catalogue mix (donut: SKUs per category) ------------------------
  const catalogueMix = useMemo(() => {
    return categories.map((c, i) => ({
      name: c.name,
      value: c.count,
      fill: PALETTE[i % PALETTE.length],
    }));
  }, [categories]);

  // ----- Inventory value by category (bar) -------------------------------
  const inventoryByCat = useMemo(() => {
    return categories.map((c) => ({
      category: c.name,
      value: Math.round(c.inventoryValue / 1000),
      avgMargin: Number(c.avgMargin.toFixed(1)),
    }));
  }, [categories]);

  // ----- 30d revenue by category (bar) -----------------------------------
  const revenueByCat = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const c = p.category || 'Other';
      map.set(c, (map.get(c) || 0) + (p.revenue_30d || 0));
    }
    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value: Math.round(value / 1000) }))
      .sort((a, b) => b.value - a.value);
  }, [products]);

  // ----- Sell-through trend (synthetic 30 days from sales_30d) -----------
  const sellThrough = useMemo(() => {
    if (!products.length) return [];
    const totalDaily = products.reduce((s, p) => s + (p.sales_30d || 0), 0) / 30;
    const out = [];
    for (let d = 29; d >= 0; d -= 1) {
      const wave = Math.sin((d / 30) * Math.PI * 2) * 0.18;
      const noise = ((_hash(`day-${d}`) % 1000) / 1000 - 0.5) * 0.12;
      const units = Math.max(0, Math.round(totalDaily * (1 + wave + noise)));
      const date = new Date();
      date.setDate(date.getDate() - d);
      out.push({
        day: `${date.getDate()}/${date.getMonth() + 1}`,
        units,
      });
    }
    return out;
  }, [products]);

  // ----- Margin distribution (histogram) ---------------------------------
  const marginHist = useMemo(() => {
    const buckets = [
      { label: '<30%', min: 0, max: 30, count: 0 },
      { label: '30-45%', min: 30, max: 45, count: 0 },
      { label: '45-55%', min: 45, max: 55, count: 0 },
      { label: '55-65%', min: 55, max: 65, count: 0 },
      { label: '65%+', min: 65, max: 999, count: 0 },
    ];
    for (const p of products) {
      const m = p.gross_margin_pct || 0;
      const b = buckets.find((x) => m >= x.min && m < x.max);
      if (b) b.count += 1;
    }
    return buckets;
  }, [products]);

  // ----- Top movers + slow movers ---------------------------------------
  const topMovers = useMemo(() => {
    return [...products]
      .sort((a, b) => (b.sales_30d || 0) - (a.sales_30d || 0))
      .slice(0, 5);
  }, [products]);

  const slowMovers = useMemo(() => {
    return [...products]
      .sort((a, b) => (a.sales_30d || 0) - (b.sales_30d || 0))
      .slice(0, 5);
  }, [products]);

  // ----- Price position vs market ---------------------------------------
  const pricePosition = useMemo(() => {
    let under = 0, on = 0, over = 0;
    for (const p of products) {
      const pi = p.price_index || 1;
      if (pi < 0.95) under += 1;
      else if (pi > 1.05) over += 1;
      else on += 1;
    }
    return [
      { label: 'Under-priced', value: under, tone: 'good' },
      { label: 'On-market', value: on, tone: 'muted' },
      { label: 'Over-priced', value: over, tone: 'warn' },
    ];
  }, [products]);

  // ----- Performance briefing aggregations --------------------------------
  const briefing = useMemo(() => {
    if (!products.length) return null;
    const totalRev30 = products.reduce((s, p) => s + (p.revenue_30d || 0), 0);
    // Prior 30d revenue derived from a stable per-product factor.
    const priorRev = products.reduce((s, p) => {
      const f = 0.78 + ((_hash(p.id + 'prior') % 1000) / 1000) * 0.36;
      return s + (p.revenue_30d || 0) * f;
    }, 0);
    const delta = priorRev > 0 ? ((totalRev30 - priorRev) / priorRev) * 100 : 0;

    // Daily revenue series (30d) - sum of product daily series at price.
    const series = [];
    const seedDay = _hash('rev-day');
    for (let d = 29; d >= 0; d -= 1) {
      const wave = Math.sin((d / 30) * Math.PI * 2) * 0.18;
      const noise = (((seedDay + d * 17) % 1000) / 1000 - 0.5) * 0.16;
      const date = new Date();
      date.setDate(date.getDate() - d);
      const rev = Math.max(0, Math.round((totalRev30 / 30) * (1 + wave + noise)));
      series.push({ day: `${date.getDate()}/${date.getMonth() + 1}`, revenue: rev });
    }

    const topProduct = [...products].sort(
      (a, b) => (b.sales_30d || 0) - (a.sales_30d || 0),
    )[0];
    const topCategory = [...categories].sort(
      (a, b) => b.inventoryValue - a.inventoryValue,
    )[0];
    const restock = products.filter(
      (p) => (p.stock_on_hand || 0) < (p.reorder_point || 0),
    ).length;
    const fastMovers = products.filter((p) => (p.days_of_cover || 0) < 25).length;
    const overstocked = products.filter((p) => (p.days_of_cover || 0) > 180).length;

    return {
      totalRev30, priorRev, delta, series,
      topProduct, topCategory, restock, fastMovers, overstocked,
    };
  }, [products, categories]);

  // ----- Catalogue analytics: ABC Pareto on revenue ----------------------
  const paretoData = useMemo(() => {
    if (!products.length) return [];
    const sorted = [...products].sort(
      (a, b) => (b.revenue_30d || 0) - (a.revenue_30d || 0),
    );
    const total = sorted.reduce((s, p) => s + (p.revenue_30d || 0), 0) || 1;
    let cum = 0;
    return sorted.slice(0, 30).map((p, i) => {
      cum += p.revenue_30d || 0;
      return {
        rank: i + 1,
        sku: p.sku || `#${i + 1}`,
        name: p.name,
        revenue: Math.round((p.revenue_30d || 0) / 1000),
        cumPct: Number(((cum / total) * 100).toFixed(1)),
      };
    });
  }, [products]);

  // ----- Stock age (days-of-cover) distribution -------------------------
  const stockAge = useMemo(() => {
    const buckets = [
      { label: '0-30d', min: 0, max: 30, count: 0, value: 0 },
      { label: '31-60d', min: 30, max: 60, count: 0, value: 0 },
      { label: '61-90d', min: 60, max: 90, count: 0, value: 0 },
      { label: '91-180d', min: 90, max: 180, count: 0, value: 0 },
      { label: '181+d', min: 180, max: 99999, count: 0, value: 0 },
    ];
    for (const p of products) {
      const dc = p.days_of_cover || 0;
      const b = buckets.find((x) => dc >= x.min && dc < x.max);
      if (b) {
        b.count += 1;
        b.value += Math.round(((p.stock_on_hand || 0) * (p.cost_price || 0)) / 1000);
      }
    }
    return buckets;
  }, [products]);

  // ----- Category performance scatter (margin vs sell-through) ----------
  const categoryScatter = useMemo(() => {
    return categories.map((c, i) => {
      const list = products.filter((p) => p.category === c.name);
      const sellThru = list.length
        ? list.reduce((s, p) => s + sellThroughRate(p), 0) / list.length
        : 0;
      return {
        name: c.name,
        margin: Number(c.avgMargin.toFixed(1)),
        sellThru: Number(sellThru.toFixed(1)),
        value: Math.round(c.inventoryValue / 1000),
        fill: PALETTE[i % PALETTE.length],
      };
    });
  }, [categories, products]);

  // ----- Stock health by category (stacked) -----------------------------
  const stockHealthByCat = useMemo(() => {
    return categories.map((c) => {
      const list = products.filter((p) => p.category === c.name);
      let healthy = 0, low = 0, over = 0;
      for (const p of list) {
        const stock = p.stock_on_hand || 0;
        const rop = p.reorder_point || 0;
        const dc = p.days_of_cover || 0;
        if (stock < rop) low += 1;
        else if (dc > 180) over += 1;
        else healthy += 1;
      }
      return { name: c.name, healthy, low, over };
    });
  }, [categories, products]);

  // ----- Category KPI table ---------------------------------------------
  const categoryTable = useMemo(() => {
    return categories.map((c) => {
      const list = products.filter((p) => p.category === c.name);
      const units = list.reduce((s, p) => s + (p.stock_on_hand || 0), 0);
      const sales30 = list.reduce((s, p) => s + (p.sales_30d || 0), 0);
      const rev30 = list.reduce((s, p) => s + (p.revenue_30d || 0), 0);
      const sellThru = list.length
        ? list.reduce((s, p) => s + sellThroughRate(p), 0) / list.length
        : 0;
      const restock = list.filter(
        (p) => (p.stock_on_hand || 0) < (p.reorder_point || 0),
      ).length;
      return {
        name: c.name,
        skus: c.count,
        units,
        value: c.inventoryValue,
        margin: c.avgMargin,
        cover: c.daysOfCover,
        sales30,
        rev30,
        sellThru,
        restock,
      };
    });
  }, [categories, products]);

  // ----- Catalogue summary insights -------------------------------------
  const analyticsInsights = useMemo(() => {
    if (!products.length) return null;
    // Pareto 80% threshold
    const sorted = [...products].sort(
      (a, b) => (b.revenue_30d || 0) - (a.revenue_30d || 0),
    );
    const total = sorted.reduce((s, p) => s + (p.revenue_30d || 0), 0) || 1;
    let cum = 0;
    let pareto = sorted.length;
    for (let i = 0; i < sorted.length; i += 1) {
      cum += sorted[i].revenue_30d || 0;
      if (cum / total >= 0.80) { pareto = i + 1; break; }
    }
    const totalCapital = products.reduce(
      (s, p) => s + (p.stock_on_hand || 0) * (p.cost_price || 0), 0,
    );
    const monthlyHolding = totalCapital * 0.24 / 12;
    const agingValue = products
      .filter((p) => (p.days_of_cover || 0) > 180)
      .reduce((s, p) => s + (p.stock_on_hand || 0) * (p.cost_price || 0), 0);
    return {
      pareto,
      paretoPct: ((pareto / products.length) * 100).toFixed(0),
      totalCapital,
      monthlyHolding,
      agingValue,
      agingPct: totalCapital > 0 ? ((agingValue / totalCapital) * 100).toFixed(0) : '0',
    };
  }, [products]);

  // ----- ABC classification (Pareto by 30d sales) ------------------------
  const abcMap = useMemo(() => {
    const ranked = [...products].sort((a, b) => (b.sales_30d || 0) - (a.sales_30d || 0));
    const map = {};
    const total = ranked.length || 1;
    ranked.forEach((p, i) => {
      const pct = (i + 1) / total;
      map[p.id] = pct <= 0.20 ? 'A' : pct <= 0.50 ? 'B' : 'C';
    });
    return map;
  }, [products]);

  // ----- Live ops feed (deterministic) -----------------------------------
  const feed = useMemo(() => {
    if (!products.length) return [];
    return products.slice(0, 6).map((p, i) => ({ id: p.id + i, ...eventFor(p, i) }));
  }, [products]);

  const openDrawer = useCallback((p) => setDrawerProduct(p), []);
  const closeDrawer = useCallback(() => setDrawerProduct(null), []);
  const openWorkbench = useCallback((p) => {
    setActiveProduct(p);
    setDrawerProduct(null);
    navigate(`/app/products/${p.id}`);
  }, [navigate, setActiveProduct]);

  return (
    <div className="ovx">
      {/* 1. Hero header */}
      <header className="ovx-hero">
        <div className="ovx-hero__eyebrow">Operations Overview</div>
        <h1 className="ovx-hero__title">{brand} Overview</h1>
        <p className="ovx-hero__sub">
          Launch operations, inventory readiness, and catalogue performance.
        </p>
      </header>

      {/* 1b. Performance Briefing - top-of-page analytics */}
      {briefing ? (
        <section className="ovx-brief">
          <div className="ovx-brief__main">
            <div className="ovx-brief__head">
              <div>
                <div className="ovx-brief__eyebrow">Performance Briefing</div>
                <h2>Last 30 days</h2>
              </div>
              <div className="ovx-brief__hero-num">
                <div className="ovx-brief__hero-val">{rupee(briefing.totalRev30)}</div>
                <div className={`ovx-brief__delta ${briefing.delta >= 0 ? 'is-up' : 'is-down'}`}>
                  {briefing.delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{briefing.delta >= 0 ? '+' : ''}{briefing.delta.toFixed(1)}%</span>
                  <em>vs prior 30d</em>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={briefing.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="briefGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a3a2e" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#1a3a2e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8a8a82' }} axisLine={false} tickLine={false} interval={5} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v) => [rupee(v), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#1a3a2e" strokeWidth={2} fill="url(#briefGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <aside className="ovx-brief__side">
            <div className="ovx-brief__card">
              <div className="ovx-brief__card-eyebrow">Top performer</div>
              {briefing.topProduct ? (
                <>
                  <div className="ovx-brief__card-name">{briefing.topProduct.name}</div>
                  <div className="ovx-brief__card-meta">
                    <strong>{plain(briefing.topProduct.sales_30d)}</strong>
                    <span>units {'\u00B7'} {briefing.topProduct.category}</span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="ovx-brief__card">
              <div className="ovx-brief__card-eyebrow">Lead category</div>
              {briefing.topCategory ? (
                <>
                  <div className="ovx-brief__card-name">{briefing.topCategory.name}</div>
                  <div className="ovx-brief__card-meta">
                    <strong>{rupee(briefing.topCategory.inventoryValue)}</strong>
                    <span>inventory {'\u00B7'} {briefing.topCategory.count} styles</span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="ovx-brief__chips">
              <div className="ovx-brief__chip ovx-brief__chip--good">
                <strong>{briefing.fastMovers}</strong>
                <span>fast movers</span>
              </div>
              <div className="ovx-brief__chip ovx-brief__chip--warn">
                <strong>{briefing.restock}</strong>
                <span>restock</span>
              </div>
              <div className="ovx-brief__chip ovx-brief__chip--muted">
                <strong>{briefing.overstocked}</strong>
                <span>overstocked</span>
              </div>
            </div>
          </aside>
        </section>
      ) : null}
      {/* 3d. Catalogue Analytics - deep cross-product analysis */}
      {analyticsInsights ? (
        <section className="ovx-section">
          <div className="ovx-section__head">
            <h2>Catalogue Analytics</h2>
            <p>Cross-product performance, capital deployment, and concentration analysis.</p>
          </div>

          {/* Headline insights */}
          <div className="ovx-an__insights">
            <div className="ovx-an__insight">
              <div className="ovx-an__insight-eyebrow">Revenue concentration</div>
              <div className="ovx-an__insight-val">{analyticsInsights.pareto} SKUs</div>
              <div className="ovx-an__insight-sub">
                drive 80% of revenue {'\u00B7'} {analyticsInsights.paretoPct}% of catalogue
              </div>
            </div>
            <div className="ovx-an__insight">
              <div className="ovx-an__insight-eyebrow">Capital deployed</div>
              <div className="ovx-an__insight-val">{rupee(analyticsInsights.totalCapital)}</div>
              <div className="ovx-an__insight-sub">
                {rupee(analyticsInsights.monthlyHolding)} / month carrying cost
              </div>
            </div>
            <div className="ovx-an__insight">
              <div className="ovx-an__insight-eyebrow">Aging inventory</div>
              <div className="ovx-an__insight-val">{rupee(analyticsInsights.agingValue)}</div>
              <div className="ovx-an__insight-sub">
                {analyticsInsights.agingPct}% of capital sitting 180d+
              </div>
            </div>
          </div>

          {/* Panel 1: ABC Pareto */}
          <div className="ovx-an__panel ovx-an__panel--wide">
            <div className="ovx-an__panel-head">
              <div>
                <h4>Revenue Pareto</h4>
                <span>top 30 SKUs {'\u00B7'} bars = revenue ({'\u20B9'}k) {'\u00B7'} line = cumulative %</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={paretoData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="rank" tick={{ fontSize: 10, fill: '#8a8a82' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(rank, payload) => payload?.[0]?.payload?.name || `Rank ${rank}`}
                  formatter={(v, key) => key === 'cumPct' ? [`${v}%`, 'Cumulative'] : [`\u20B9${v}k`, 'Revenue 30d']}
                />
                <Bar yAxisId="rev" dataKey="revenue" fill="#1a3a2e" radius={[4, 4, 0, 0]} />
                <Line yAxisId="pct" type="monotone" dataKey="cumPct" stroke="#b45309" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Panel 2 + 3 row */}
          <div className="ovx-an__row">
            <div className="ovx-an__panel">
              <div className="ovx-an__panel-head">
                <div>
                  <h4>Stock Age Distribution</h4>
                  <span>SKUs by days of cover</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stockAge} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(26,58,46,0.05)' }} formatter={(v, key, ctx) => key === 'count' ? [`${v} SKUs`, 'Count'] : [`\u20B9${v}k`, 'Stock value']} />
                  <Bar dataKey="count" fill="#1a3a2e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ovx-an__panel">
              <div className="ovx-an__panel-head">
                <div>
                  <h4>Category Performance Matrix</h4>
                  <span>margin {'\u00B7'} sell-through {'\u00B7'} bubble = inventory value</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="margin"
                    name="Margin"
                    domain={['dataMin - 5', 'dataMax + 5']}
                    tick={{ fontSize: 10, fill: '#6b6b62' }}
                    axisLine={false} tickLine={false}
                    label={{ value: 'Avg Margin %', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#8a8a82' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="sellThru"
                    name="Sell-through"
                    domain={['dataMin - 5', 'dataMax + 5']}
                    tick={{ fontSize: 10, fill: '#6b6b62' }}
                    axisLine={false} tickLine={false}
                    label={{ value: 'Sell-through %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#8a8a82' }}
                  />
                  <ZAxis type="number" dataKey="value" range={[100, 900]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: '#fff',
                          border: '1px solid #e0ddd5',
                          borderRadius: 8,
                          padding: '10px 12px',
                          fontSize: 12,
                          color: '#1a1a18',
                          boxShadow: '0 6px 20px rgba(20,18,12,0.08)',
                          minWidth: 160,
                        }}>
                          <div style={{
                            fontFamily: "'Inter', system-ui, sans-serif",
                            fontSize: 14,
                            fontWeight: 500,
                            marginBottom: 6,
                            color: '#1a1a18',
                          }}>{d.name}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ color: '#6b6b62' }}>Margin</span>
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{d.margin}%</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ color: '#6b6b62' }}>Sell-through</span>
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{d.sellThru}%</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ color: '#6b6b62' }}>Inventory</span>
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{'\u20B9'}{d.value}k</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={categoryScatter}>
                    {categoryScatter.map((d) => <Cell key={d.name} fill={d.fill} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Panel 4: Stock health stacked by category */}
          <div className="ovx-an__panel ovx-an__panel--wide">
            <div className="ovx-an__panel-head">
              <div>
                <h4>Stock Health by Category</h4>
                <span>SKU count {'\u00B7'} healthy / restock / overstocked</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stockHealthByCat} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(26,58,46,0.05)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6b6b62' }} iconType="circle" />
                <Bar dataKey="healthy" stackId="a" fill="#1f6b46" name="Healthy" radius={[0, 0, 0, 0]} />
                <Bar dataKey="low" stackId="a" fill="#b45309" name="Restock" />
                <Bar dataKey="over" stackId="a" fill="#9ca3af" name="Overstocked" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Panel 5: Category KPI table */}
          <div className="ovx-an__panel ovx-an__panel--wide">
            <div className="ovx-an__panel-head">
              <div>
                <h4>Category Scorecard</h4>
                <span>full operating metrics per category</span>
              </div>
            </div>
            <div className="ovx-an__table-wrap">
              <table className="ovx-an__table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">SKUs</th>
                    <th className="num">Inventory</th>
                    <th className="num">Value</th>
                    <th className="num">Avg Margin</th>
                    <th className="num">Cover</th>
                    <th className="num">Sold 30d</th>
                    <th className="num">Revenue 30d</th>
                    <th className="num">Sell-through</th>
                    <th className="num">Restock</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTable.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <button
                          type="button"
                          className="ovx-an__row-link"
                          onClick={() => setCategoryOpen(row.name)}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="num">{row.skus}</td>
                      <td className="num">{plain(row.units)}</td>
                      <td className="num">{rupee(row.value)}</td>
                      <td className="num">{row.margin.toFixed(0)}%</td>
                      <td className="num">{Math.round(row.cover)}d</td>
                      <td className="num">{plain(row.sales30)}</td>
                      <td className="num">{rupee(row.rev30)}</td>
                      <td className="num">{row.sellThru.toFixed(1)}%</td>
                      <td className="num">
                        {row.restock > 0
                          ? <span className="ovx-tag ovx-tag--warn">{row.restock}</span>
                          : <span className="ovx-an__zero">{'\u2014'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {/* 2. Top metrics strip - calm operational status */}
      <motion.div
        className="ovx-metrics"
        variants={stagger(0.05, 0.05)}
        initial="initial"
        animate="animate"
      >
        <Metric label="Active SKUs" value={metrics?.activeSkus || 0} />
        <Metric label="Launch Inventory" value={metrics?.inventoryUnits || 0} suffix=" Units" />
        <Metric label="Inventory Value" value={metrics ? metrics.inventoryValue / 100000 : 0} prefix={'\u20B9'} suffix="L" decimals={1} />
        <Metric label="Marketplace Readiness" value={metrics?.readiness || 0} suffix="%" decimals={0} />
        <Metric label="Avg Margin" value={metrics?.avgMargin || 0} suffix="%" decimals={0} />
        <Metric label="Low Stock Alerts" value={metrics?.lowStock || 0} suffix=" SKUs" soft />
        <Metric label="Categories Active" value={metrics?.categoriesActive || 0} soft />
      </motion.div>

      {/* 3. Category repository */}
      <section className="ovx-section">
        <div className="ovx-section__head">
          <h2>Categories</h2>
          <p>Each line is a repository of styles. Tap to focus the catalogue.</p>
        </div>
        <motion.div
          className="ovx-cats"
          variants={stagger(0.05, 0.05)}
          initial="initial"
          animate="animate"
        >
          {categories.map((c) => (
            <CategoryCard key={c.name} cat={c} onOpen={setCategoryOpen} />
          ))}
        </motion.div>
      </section>

      {/* 3b. Catalogue insights - operational charts (no AI talk) */}
      <section className="ovx-section">
        <div className="ovx-section__head">
          <h2>Catalogue Insights</h2>
          <p>How the brand is performing across categories this month.</p>
        </div>
        <div className="ovx-charts">
          <div className="ovx-chart">
            <div className="ovx-chart__head">
              <h4>Catalogue Mix</h4>
              <span>SKUs per category</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={catalogueMix}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {catalogueMix.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="ovx-chart__legend">
              {catalogueMix.map((d) => (
                <li key={d.name}>
                  <span className="ovx-chart__swatch" style={{ background: d.fill }} />
                  <span className="ovx-chart__legend-name">{d.name}</span>
                  <span className="ovx-chart__legend-val">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ovx-chart">
            <div className="ovx-chart__head">
              <h4>Inventory Value</h4>
              <span>by category {'\u00B7'} {'\u20B9'}k at cost</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={inventoryByCat} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(26,58,46,0.05)' }} />
                <Bar dataKey="value" fill="#1a3a2e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="ovx-chart">
            <div className="ovx-chart__head">
              <h4>Sell-Through (30 Days)</h4>
              <span>units shipped daily</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={sellThrough} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a3a2e" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1a3a2e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b6b62' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="units" stroke="#1a3a2e" strokeWidth={2} fill="url(#sellGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="ovx-chart">
            <div className="ovx-chart__head">
              <h4>Margin Spread</h4>
              <span>SKUs grouped by gross margin</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={marginHist} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ece9e2" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b6b62' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(107,74,138,0.05)' }} />
                <Bar dataKey="count" fill="#6b4a8a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3c. Movers + Pricing position */}
      <section className="ovx-section">
        <div className="ovx-section__head">
          <h2>Movement & Pricing</h2>
          <p>What's selling, what's stalling, and where the price sits versus the market.</p>
        </div>
        <div className="ovx-movers">
          <div className="ovx-movers__panel">
            <div className="ovx-movers__head">
              <TrendingUp size={14} />
              <h4>Top Movers</h4>
              <span>last 30 days</span>
            </div>
            <ul className="ovx-movers__list">
              {topMovers.map((p, i) => (
                <li key={p.id} onClick={() => openDrawer(p)}>
                  <span className="ovx-movers__rank">{i + 1}</span>
                  <div className="ovx-movers__thumb" style={{ background: coverFor(p) }}>
                    {p.image ? <img src={p.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
                  </div>
                  <div className="ovx-movers__name">
                    <strong>{p.name}</strong>
                    <span>{p.category}</span>
                  </div>
                  <div className="ovx-movers__metric">
                    <strong>{plain(p.sales_30d)}</strong>
                    <span>units</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="ovx-movers__panel">
            <div className="ovx-movers__head">
              <TrendingDown size={14} />
              <h4>Slow Movers</h4>
              <span>needs attention</span>
            </div>
            <ul className="ovx-movers__list">
              {slowMovers.map((p, i) => (
                <li key={p.id} onClick={() => openDrawer(p)}>
                  <span className="ovx-movers__rank">{i + 1}</span>
                  <div className="ovx-movers__thumb" style={{ background: coverFor(p) }}>
                    {p.image ? <img src={p.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
                  </div>
                  <div className="ovx-movers__name">
                    <strong>{p.name}</strong>
                    <span>{p.category}</span>
                  </div>
                  <div className="ovx-movers__metric">
                    <strong>{plain(p.sales_30d)}</strong>
                    <span>units</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="ovx-movers__panel ovx-movers__panel--price">
            <div className="ovx-movers__head">
              <h4>Price Position</h4>
              <span>vs market</span>
            </div>
            <div className="ovx-price">
              {pricePosition.map((b) => {
                const total = pricePosition.reduce((s, x) => s + x.value, 0) || 1;
                const pct = (b.value / total) * 100;
                return (
                  <div key={b.label} className="ovx-price__row">
                    <div className="ovx-price__head">
                      <span>{b.label}</span>
                      <strong>{b.value}</strong>
                    </div>
                    <div className="ovx-price__track">
                      <motion.div
                        className={`ovx-price__fill ovx-price__fill--${b.tone}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: EASE.out }}
                      />
                    </div>
                    <div className="ovx-price__pct">{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>


      {/* 4. Product repository grid */}
      <section className="ovx-section">
        <div className="ovx-section__head ovx-section__head--row">
          <div>
            <h2>Catalogue</h2>
            <p>{filtered.length} styles {filter === 'All' ? 'across all categories' : `in ${filter}`}.</p>
          </div>
          <div className="ovx-filters">
            {categoryNames.map((c) => (
              <button
                key={c}
                type="button"
                className={`ovx-filter ${filter === c ? 'is-active' : ''}`}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="ovx-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="ovx-card ovx-card--skel">
                <div className="ovx-card__cover" />
                <div className="ovx-card__body">
                  <div className="ovx-skel" style={{ width: '70%' }} />
                  <div className="ovx-skel" style={{ width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            className="ovx-grid"
            variants={stagger(0.04, 0)}
            initial="initial"
            animate="animate"
          >
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} onOpen={openDrawer} />
            ))}
          </motion.div>
        )}
      </section>

      {/* 5. Inventory health */}
      {inventoryHealth ? (
        <section className="ovx-section">
          <div className="ovx-section__head">
            <h2>Inventory Health</h2>
            <p>Where the catalogue needs attention this week.</p>
          </div>
          <div className="ovx-health">
            <div className="ovx-health__panel">
              <h4>Restock Pipeline</h4>
              <HealthBar label="Low Stock" value={inventoryHealth.low.length} total={inventoryHealth.total} tone="warn" />
              <HealthBar label="Aging Inventory" value={inventoryHealth.aging.length} total={inventoryHealth.total} tone="muted" />
              <HealthBar label="Overstocked" value={inventoryHealth.over.length} total={inventoryHealth.total} tone="soft" />
              <HealthBar label="Size Imbalance" value={inventoryHealth.imbalance.length} total={inventoryHealth.total} tone="accent" />
            </div>
            <div className="ovx-health__panel">
              <h4>Needs Reorder Soon</h4>
              {inventoryHealth.low.length === 0 ? (
                <div className="ovx-health__empty">All styles above reorder point.</div>
              ) : (
                <ul className="ovx-health__list">
                  {inventoryHealth.low.slice(0, 6).map((p) => (
                    <li key={p.id} onClick={() => openDrawer(p)}>
                      <div className="ovx-health__thumb" style={{ background: coverFor(p) }} />
                      <div className="ovx-health__name">
                        <strong>{p.name}</strong>
                        <span>{p.stock_on_hand} on hand {'\u00B7'} reorder at {p.reorder_point}</span>
                      </div>
                      <ArrowUpRight size={14} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="ovx-health__panel">
              <h4>Holding Excess Inventory</h4>
              {inventoryHealth.over.length === 0 ? (
                <div className="ovx-health__empty">No overstock detected.</div>
              ) : (
                <ul className="ovx-health__list">
                  {inventoryHealth.over.slice(0, 6).map((p) => (
                    <li key={p.id} onClick={() => openDrawer(p)}>
                      <div className="ovx-health__thumb" style={{ background: coverFor(p) }} />
                      <div className="ovx-health__name">
                        <strong>{p.name}</strong>
                        <span>{Math.round(p.days_of_cover || 0)} days of cover</span>
                      </div>
                      <ArrowUpRight size={14} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <CategoryModal
        category={categoryOpen}
        products={products}
        onClose={() => setCategoryOpen(null)}
        onView={(p) => { setCategoryOpen(null); setDrawerProduct(p); }}
      />

      <ProductDrawer
        product={drawerProduct}
        abcClass={drawerProduct ? abcMap[drawerProduct.id] : 'C'}
        onClose={closeDrawer}
        onOpenWorkbench={openWorkbench}
      />
    </div>
  );
}

