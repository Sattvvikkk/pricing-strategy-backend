import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';
import {
  IndianRupee, Percent, Package, Users,
  TrendingUp, TrendingDown,
} from 'lucide-react';

import { motion } from 'framer-motion';
import API from '../api/client';
import { useProduct } from '../context/ProductContext';
import StrategyCard from '../components/StrategyCard';
import ProductIntelligenceGrid from '../components/ProductIntelligenceGrid';
import AnimatedCounter from '../components/AnimatedCounter';
import { fadeUp, stagger } from '../motion/tokens';

const TOOLTIP_STYLE = {
  background: '#1A1A1A',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#FFFFFF',
  fontSize: 13,
};

function Skeleton({ width = '60%', height = 28 }) {
  return (
    <span
      className="pe-skel"
      style={{ display: 'inline-block', width, height, borderRadius: 4 }}
    />
  );
}

function ChangePill({ value, suffix = '%' }) {
  if (value == null || Number.isNaN(value)) return null;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`pe-kpi__change ${positive ? 'pe-kpi__change--up' : 'pe-kpi__change--down'}`}>
      <Icon size={12} />
      {positive ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

function KpiTile({ Icon, label, numericValue, change, loading, prefix = '', suffix = '', decimals = 0 }) {
  return (
    <motion.div className="pe-kpi" variants={fadeUp}>
      <div className="pe-kpi__head">
        <span className="pe-kpi__label">{label}</span>
        <Icon size={16} className="pe-kpi__icon" />
      </div>
      <div className="pe-kpi__value">
        {loading
          ? <Skeleton width="70%" height={28} />
          : <AnimatedCounter
              value={numericValue || 0}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
            />}
      </div>
      <div className="pe-kpi__change-row">
        {loading ? <Skeleton width="40%" height={14} /> : <ChangePill value={change} />}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { activeProduct } = useProduct();
  const productId = activeProduct?.id || activeProduct?.product_id;

  const [dashboard, setDashboard] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjust, setAdjust] = useState(0); // -20..20 (% price change)

  // Fetch dashboard + forecast whenever product changes
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      API.get('/api/dashboard', { params: { product_id: productId } }),
      API.get('/api/analytics/forecast', { params: { product_id: productId } }),
    ])
      .then(([dashRes, fcRes]) => {
        if (cancelled) return;
        setDashboard(dashRes.data);
        setForecast(fcRes.data);
      })
      .catch((err) => {
        console.error('Dashboard fetch failed:', err);
        if (!cancelled) {
          setDashboard(null);
          setForecast(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [productId]);

  const kpis = dashboard?.kpis;
  const ml = dashboard?.ml;
  const elasticity = ml?.elasticity ?? -1.5;

  // KPI values
  const todaysRevenue = useMemo(() => {
    if (!kpis) return null;
    const monthly = kpis.monthly_revenue || 0;
    return Math.round(monthly / 30);
  }, [kpis]);

  const grossMargin = useMemo(() => {
    if (!dashboard?.product || !kpis) return null;
    const cost = dashboard.product.cost_price || 0;
    const price = kpis.current_price || dashboard.product.current_price || 0;
    if (price <= 0) return null;
    return ((price - cost) / price) * 100;
  }, [dashboard, kpis]);

  const unitsSoldToday = kpis?.avg_daily_demand ?? null;

  const competitorAvg = useMemo(() => {
    if (!kpis || !ml) return null;
    if (kpis.price_index && kpis.current_price) {
      return Math.round(kpis.current_price / kpis.price_index);
    }
    return null;
  }, [kpis, ml]);

  // Forecast chart data
  const chartData = useMemo(() => {
    if (!forecast) return [];
    const actual = (forecast.actual || []).map((r) => ({
      date: r.date,
      forecast: null,
      baseline: r.actual,
      isHistorical: true,
    }));
    const predicted = (forecast.predicted || []).map((r) => ({
      date: r.date,
      forecast: Math.round(r.yhat),
      baseline: Math.round(r.yhat_lower),
      isHistorical: false,
    }));
    return [...actual, ...predicted];
  }, [forecast]);

  const todayMarker = useMemo(() => {
    if (!forecast?.actual?.length) return null;
    return forecast.actual[forecast.actual.length - 1].date;
  }, [forecast]);

  // Scenario simulator
  const scenario = useMemo(() => {
    if (!kpis) return null;
    const basePrice = kpis.current_price || 0;
    const baseDemand = kpis.avg_daily_demand || 0;
    const priceMult = 1 + adjust / 100;
    // Demand response via elasticity: %ΔQ = elasticity × %ΔP
    const demandMult = 1 + (elasticity * adjust) / 100;
    const newDemand = Math.max(0, baseDemand * demandMult);
    const baseRevenue = basePrice * baseDemand;
    const newRevenue = basePrice * priceMult * newDemand;

    return {
      demandDeltaPct: baseDemand > 0 ? ((newDemand - baseDemand) / baseDemand) * 100 : 0,
      revenueDeltaPct: baseRevenue > 0 ? ((newRevenue - baseRevenue) / baseRevenue) * 100 : 0,
      newDemand,
      newRevenue,
    };
  }, [kpis, adjust, elasticity]);

  return (
    <div className="pe-dashboard">
      {/* Row 1 — Strategy Card */}
      <StrategyCard productId={productId} />

      {/* Row 2 — KPI tiles */}
      <motion.div
        className="pe-dashboard__kpis"
        variants={stagger(0.06, 0.05)}
        initial="initial"
        animate="animate"
      >
        <KpiTile
          Icon={IndianRupee}
          label="Today's Revenue"
          prefix="₹"
          numericValue={todaysRevenue}
          change={kpis?.revenue_impact_pct}
          loading={loading || !kpis}
        />
        <KpiTile
          Icon={Percent}
          label="Gross Margin"
          numericValue={grossMargin}
          suffix="%"
          decimals={1}
          loading={loading || grossMargin == null}
        />
        <KpiTile
          Icon={Package}
          label="Units Sold Today"
          numericValue={unitsSoldToday != null ? Math.round(unitsSoldToday) : 0}
          loading={loading || unitsSoldToday == null}
        />
        <KpiTile
          Icon={Users}
          label="Competitor Avg Price"
          prefix="₹"
          numericValue={competitorAvg}
          loading={loading || competitorAvg == null}
        />
      </motion.div>

      {/* Product Intelligence Grid */}
      <ProductIntelligenceGrid />

      {/* Row 3 — Forecast + Scenario */}
      <div className="pe-dashboard__row3">
        {/* Forecast chart */}
        <div className="card pe-forecast">
          <div className="pe-forecast__head">
            <h3 className="pe-forecast__title">30-Day Demand Forecast</h3>
            <span className="badge-neutral">Prophet · ML</span>
          </div>

          {loading ? (
            <div className="pe-skel" style={{ height: 260, borderRadius: 8 }} />
          ) : chartData.length === 0 ? (
            <div className="pe-empty">No forecast data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#52525B', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#52525B', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(139,92,246,0.30)' }} />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline"
                  stroke="#71717A"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
                {todayMarker && (
                  <ReferenceLine
                    x={todayMarker}
                    stroke="rgba(139,92,246,0.40)"
                    strokeDasharray="3 3"
                    label={{ value: 'Today', position: 'insideTopRight', fill: '#A78BFA', fontSize: 11 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Scenario simulator */}
        <div className="card pe-scenario">
          <h3 className="pe-scenario__title">Price Impact Simulator</h3>
          <p className="pe-scenario__sub">
            Drag to see how a price change affects demand and revenue
          </p>

          <div className="pe-scenario__control">
            <label className="pe-scenario__label">Price adjustment</label>
            <div className="pe-scenario__readout">
              {adjust >= 0 ? '+' : ''}{adjust}%
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={adjust}
              onChange={(e) => setAdjust(Number(e.target.value))}
              className="pe-scenario__range"
              disabled={loading || !kpis}
            />
            <div className="pe-scenario__ticks">
              <span>-20%</span>
              <span>0%</span>
              <span>+20%</span>
            </div>
          </div>

          <div className="pe-scenario__results">
            <div className="pe-scenario__tile">
              <div className="pe-scenario__tile-label">Projected Demand</div>
              <div
                className={`pe-scenario__tile-value ${
                  scenario && scenario.demandDeltaPct >= 0
                    ? 'pe-scenario__tile-value--up'
                    : 'pe-scenario__tile-value--down'
                }`}
              >
                {loading || !scenario
                  ? <Skeleton width="50%" height={18} />
                  : `${scenario.demandDeltaPct >= 0 ? '+' : ''}${scenario.demandDeltaPct.toFixed(1)}%`}
              </div>
            </div>

            <div className="pe-scenario__tile">
              <div className="pe-scenario__tile-label">Projected Revenue</div>
              <div
                className={`pe-scenario__tile-value ${
                  scenario && scenario.revenueDeltaPct >= 0
                    ? 'pe-scenario__tile-value--up'
                    : 'pe-scenario__tile-value--down'
                }`}
              >
                {loading || !scenario
                  ? <Skeleton width="50%" height={18} />
                  : `${scenario.revenueDeltaPct >= 0 ? '+' : ''}${scenario.revenueDeltaPct.toFixed(1)}%`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
