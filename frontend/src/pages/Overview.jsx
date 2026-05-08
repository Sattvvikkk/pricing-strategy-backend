import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  IndianRupee, Percent, Package, Users, AlertTriangle,
  TrendingUp, TrendingDown, ShieldAlert, Sparkles,
} from 'lucide-react';

import API from '../api/client';
import AnimatedCounter from '../components/AnimatedCounter';
import { useProduct } from '../context/ProductContext';
import { fadeUp, stagger, EASE } from '../motion/tokens';

const TOOLTIP_STYLE = {
  background: '#0d1f18',
  border: '1px solid rgba(206,237,111,0.2)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

const RISK_COLORS = { Low: '#16803c', Medium: '#b45309', High: '#b91c1c' };
const TREND_ICONS = {
  Surging: TrendingUp,
  Rising: TrendingUp,
  Stable: TrendingUp,
  Declining: TrendingDown,
};

// ── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({ Icon, label, value, prefix = '', suffix = '', decimals = 0, accent }) {
  return (
    <motion.div className="pe-kpi" variants={fadeUp}>
      <div className="pe-kpi__head">
        <span className="pe-kpi__label">{label}</span>
        <Icon size={16} className="pe-kpi__icon" style={accent ? { color: accent } : undefined} />
      </div>
      <div className="pe-kpi__value">
        <AnimatedCounter value={value || 0} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
    </motion.div>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────
function ProductCard({ p, onOpen }) {
  const TrendIcon = TREND_ICONS[p.demand_trend] || TrendingUp;
  const trendUp = p.demand_trend === 'Rising' || p.demand_trend === 'Surging';
  const initial = (p.name || 'P').charAt(0).toUpperCase();

  return (
    <motion.button
      type="button"
      className="pu-card"
      variants={fadeUp}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE.out } }}
      onClick={() => onOpen(p)}
    >
      <div className="pu-card__head">
        <div className="pu-card__thumb" aria-hidden="true">{initial}</div>
        <div className="pu-card__title-block">
          <h3 className="pu-card__title">{p.name}</h3>
          <span className="pu-card__cat">{p.category} · {p.sku}</span>
        </div>
        <span
          className="pu-card__risk"
          style={{ background: `${RISK_COLORS[p.risk_flag]}1a`, color: RISK_COLORS[p.risk_flag] }}
        >
          {p.risk_flag}
        </span>
      </div>

      <div className="pu-card__price-row">
        <div>
          <div className="pu-card__price">₹{Number(p.current_price).toLocaleString('en-IN')}</div>
          <div className="pu-card__sub">cost ₹{Number(p.cost_price).toLocaleString('en-IN')}</div>
        </div>
        <div className="pu-card__margin">
          <div className="pu-card__margin-value">{p.gross_margin_pct?.toFixed(1)}%</div>
          <div className="pu-card__margin-label">margin</div>
        </div>
      </div>

      <dl className="pu-card__metrics">
        <div className="pu-card__metric">
          <dt>Stock</dt>
          <dd>{p.stock_on_hand?.toLocaleString()}</dd>
        </div>
        <div className="pu-card__metric">
          <dt>Sales 30d</dt>
          <dd>{p.sales_30d?.toLocaleString()}</dd>
        </div>
        <div className="pu-card__metric">
          <dt>Rev 30d</dt>
          <dd>₹{(p.revenue_30d / 1000).toFixed(0)}k</dd>
        </div>
        <div className="pu-card__metric">
          <dt>vs Mkt</dt>
          <dd className={p.price_index < 1 ? 'is-up' : p.price_index > 1.05 ? 'is-down' : ''}>
            {p.price_index < 1 ? '−' : '+'}{Math.abs((p.price_index - 1) * 100).toFixed(1)}%
          </dd>
        </div>
      </dl>

      <div className="pu-card__foot">
        <span className={`pu-card__trend ${trendUp ? 'is-up' : 'is-down'}`}>
          <TrendIcon size={12} strokeWidth={2.25} />
          {p.demand_trend}
        </span>
        <span className="pu-card__rec">
          <Sparkles size={11} strokeWidth={2.25} />
          {p.recommendation}
        </span>
      </div>
    </motion.button>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Overview() {
  const navigate = useNavigate();
  const { setActiveProduct } = useProduct();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

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

  // ── Aggregations ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!products.length) return null;
    const total_revenue = products.reduce((s, p) => s + (p.revenue_30d || 0), 0);
    const total_inventory_value = products.reduce(
      (s, p) => s + (p.stock_on_hand || 0) * (p.cost_price || 0), 0,
    );
    const avg_margin =
      products.reduce((s, p) => s + (p.gross_margin_pct || 0), 0) / products.length;
    const at_risk = products.filter((p) => p.risk_flag === 'High').length;
    return {
      total_revenue,
      total_inventory_value,
      avg_margin,
      active_products: products.length,
      at_risk,
    };
  }, [products]);

  const categoryRevenue = useMemo(() => {
    const map = {};
    for (const p of products) {
      const c = p.category || 'Other';
      map[c] = (map[c] || 0) + (p.revenue_30d || 0);
    }
    return Object.entries(map)
      .map(([category, revenue]) => ({ category, revenue: Math.round(revenue / 1000) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [products]);

  const marginDistribution = useMemo(() => {
    const buckets = [
      { label: '<30%', min: 0, max: 30, count: 0 },
      { label: '30–50%', min: 30, max: 50, count: 0 },
      { label: '50–65%', min: 50, max: 65, count: 0 },
      { label: '65%+', min: 65, max: 999, count: 0 },
    ];
    for (const p of products) {
      const m = p.gross_margin_pct || 0;
      const b = buckets.find((x) => m >= x.min && m < x.max);
      if (b) b.count += 1;
    }
    return buckets;
  }, [products]);

  const stockHealth = useMemo(() => {
    let healthy = 0, low = 0, over = 0;
    for (const p of products) {
      const dc = p.days_of_cover || 0;
      if (p.stock_on_hand < (p.reorder_point || 0)) low += 1;
      else if (dc > 180) over += 1;
      else healthy += 1;
    }
    return [
      { name: 'Healthy', value: healthy, color: '#16803c' },
      { name: 'Low Stock', value: low, color: '#b91c1c' },
      { name: 'Overstock', value: over, color: '#b45309' },
    ];
  }, [products]);

  // Filters
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (filter === 'All') return products;
    return products.filter((p) => p.category === filter);
  }, [products, filter]);

  const handleOpen = (p) => {
    setActiveProduct(p);
    navigate(`/app/products/${p.id}`);
  };

  return (
    <div className="ov">
      {/* Header */}
      <header className="ov__header">
        <div>
          <h1 className="ov__title">Overview</h1>
          <p className="ov__sub">
            Real-time intelligence across your entire product universe.
          </p>
        </div>
      </header>

      {/* KPI strip */}
      <motion.div
        className="ov__kpis"
        variants={stagger(0.05, 0.05)}
        initial="initial"
        animate="animate"
      >
        <KpiTile
          Icon={IndianRupee}
          label="Revenue (30d)"
          prefix="₹"
          value={kpis ? Math.round(kpis.total_revenue / 1000) : 0}
          suffix="k"
        />
        <KpiTile
          Icon={Percent}
          label="Avg Gross Margin"
          value={kpis?.avg_margin || 0}
          suffix="%"
          decimals={1}
        />
        <KpiTile
          Icon={Package}
          label="Inventory Value"
          prefix="₹"
          value={kpis ? Math.round(kpis.total_inventory_value / 1000) : 0}
          suffix="k"
        />
        <KpiTile
          Icon={Users}
          label="Active SKUs"
          value={kpis?.active_products || 0}
        />
        <KpiTile
          Icon={ShieldAlert}
          label="At-Risk SKUs"
          value={kpis?.at_risk || 0}
          accent="#b91c1c"
        />
      </motion.div>

      {/* Charts row */}
      <div className="ov__charts">
        <div className="card ov__chart-card">
          <div className="ov__chart-head">
            <h3>Revenue by Category</h3>
            <span className="ov__chart-meta">last 30 days · ₹k</span>
          </div>
          {loading ? (
            <div className="pe-skel" style={{ height: 240, borderRadius: 8 }} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryRevenue} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(206,237,111,0.1)' }} />
                <Bar dataKey="revenue" fill="#1a3a2e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card ov__chart-card">
          <div className="ov__chart-head">
            <h3>Margin Distribution</h3>
            <span className="ov__chart-meta">SKUs by gross margin %</span>
          </div>
          {loading ? (
            <div className="pe-skel" style={{ height: 240, borderRadius: 8 }} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={marginDistribution} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(206,237,111,0.1)' }} />
                <Bar dataKey="count" fill="#a3d540" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card ov__chart-card">
          <div className="ov__chart-head">
            <h3>Stock Health</h3>
            <span className="ov__chart-meta">across catalog</span>
          </div>
          {loading ? (
            <div className="pe-skel" style={{ height: 240, borderRadius: 8 }} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stockHealth}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {stockHealth.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: '#52525B' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Product Universe */}
      <section className="ov__universe">
        <div className="ov__universe-head">
          <div>
            <h2 className="ov__universe-title">Product Universe</h2>
            <p className="ov__universe-sub">
              Click any product to open its intelligence workspace.
            </p>
          </div>
          <div className="ov__filters">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`pe-filter-pill ${filter === c ? 'pe-filter-pill--active' : ''}`}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="pu-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="pu-card pu-card--skel">
                <div className="pe-skel" style={{ height: 36, width: 36, borderRadius: 10 }} />
                <div className="pe-skel" style={{ height: 14, width: '70%', borderRadius: 4 }} />
                <div className="pe-skel" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                <div className="pe-skel" style={{ height: 60, width: '100%', borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            className="pu-grid"
            variants={stagger(0.04, 0)}
            initial="initial"
            animate="animate"
          >
            {filteredProducts.map((p) => (
              <ProductCard key={p.id} p={p} onOpen={handleOpen} />
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
