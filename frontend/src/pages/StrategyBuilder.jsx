import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Target, Layers, ChevronRight, Sparkles, ShieldCheck, ShieldAlert,
  AlertTriangle, TrendingUp, Loader2, Package,
} from 'lucide-react';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';
import AnimatedCounter from '../components/AnimatedCounter';
import { fadeUp, stagger, EASE } from '../motion/tokens';

const OBJECTIVES = [
  { id: 'maximize_revenue',  label: 'Maximize revenue' },
  { id: 'maximize_margin',   label: 'Maximize margin' },
  { id: 'reduce_inventory',  label: 'Reduce inventory' },
  { id: 'win_market_share',  label: 'Win market share' },
];

const HORIZONS = [7, 14, 30, 90];

function riskMeta(score) {
  if (score < 0.25) return { Icon: ShieldCheck,   label: 'Low',    color: '#16803c', bg: 'rgba(22,128,60,0.12)' };
  if (score < 0.45) return { Icon: ShieldAlert,   label: 'Medium', color: '#b45309', bg: 'rgba(180,83,9,0.14)' };
  return                    { Icon: AlertTriangle, label: 'High',   color: '#b91c1c', bg: 'rgba(185,28,28,0.12)' };
}

// ── Product picker ─────────────────────────────────────────────────────────
function ProductPicker({ products, value, onChange }) {
  return (
    <select
      className="sb-picker"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>Select a product…</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · ₹{p.current_price}
        </option>
      ))}
    </select>
  );
}

// ── Candidate card ─────────────────────────────────────────────────────────
function StrategyCard({ s, isLeader }) {
  const risk = riskMeta(s.risk_score);
  const up = s.expected_revenue_uplift_pct >= 0;
  return (
    <motion.article
      className={`sb-card ${isLeader ? 'sb-card--leader' : ''}`}
      variants={fadeUp}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE.out } }}
    >
      {isLeader && (
        <div className="sb-card__leader-badge">
          <Sparkles size={11} strokeWidth={2.25} /> Best for objective
        </div>
      )}
      <header className="sb-card__head">
        <h3 className="sb-card__name">{s.name}</h3>
        <span className="sb-card__risk" style={{ background: risk.bg, color: risk.color }}>
          <risk.Icon size={11} strokeWidth={2.25} /> {risk.label} risk
        </span>
      </header>

      <div className="sb-card__price-row">
        <div className="sb-card__price">₹{Number(s.recommended_price).toLocaleString('en-IN')}</div>
        <div className={`sb-card__delta ${s.price_change_pct >= 0 ? 'is-up' : 'is-down'}`}>
          {s.price_change_pct >= 0 ? '+' : ''}{s.price_change_pct.toFixed(1)}%
        </div>
      </div>

      <dl className="sb-card__metrics">
        <div className="sb-card__metric">
          <dt>Revenue impact</dt>
          <dd className={up ? 'is-up' : 'is-down'}>
            {up ? '+' : ''}{s.expected_revenue_uplift_pct.toFixed(1)}%
          </dd>
        </div>
        <div className="sb-card__metric">
          <dt>Expected units</dt>
          <dd>{s.expected_units?.toLocaleString()}</dd>
        </div>
        <div className="sb-card__metric">
          <dt>Margin</dt>
          <dd>{s.expected_margin_pct?.toFixed(1)}%</dd>
        </div>
        <div className="sb-card__metric">
          <dt>Confidence</dt>
          <dd>{Math.round(s.confidence * 100)}%</dd>
        </div>
      </dl>

      <div className="sb-card__drivers">
        {s.drivers.map((d, i) => (
          <span key={i} className="sb-card__driver">{d}</span>
        ))}
      </div>

      <p className="sb-card__rationale">{s.rationale}</p>

      <footer className="sb-card__foot">
        <div className="sb-card__score">
          <span className="sb-card__score-label">Objective fit</span>
          <span className="sb-card__score-value">{s.objective_score?.toFixed(0)}</span>
        </div>
        <div className="sb-card__score-bar">
          <motion.span
            className="sb-card__score-fill"
            initial={{ width: 0 }}
            animate={{ width: `${s.objective_score}%` }}
            transition={{ duration: 0.8, ease: EASE.outExpo }}
          />
        </div>
      </footer>
    </motion.article>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function StrategyBuilder() {
  const navigate = useNavigate();
  const { activeProduct } = useProduct();

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(activeProduct?.id || '');
  const [objective, setObjective] = useState('maximize_revenue');
  const [horizon, setHorizon] = useState(30);
  const [aggressiveness, setAggressiveness] = useState(0.5);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load product list for the picker
  useEffect(() => {
    API.get('/api/products')
      .then((res) => {
        const list = res.data?.products || [];
        setProducts(list);
        if (!productId && list[0]) setProductId(list[0].id);
      })
      .catch(() => setProducts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch candidates
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    API.get(`/api/strategy/generate/${productId}`, {
      params: { objective, horizon_days: horizon, aggressiveness, top_k: 5 },
    })
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [productId, objective, horizon, aggressiveness]);

  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  return (
    <div className="sb">
      <header className="sb__header">
        <div>
          <h1 className="sb__title">Strategy Builder</h1>
          <p className="sb__sub">
            Generate ranked pricing strategies powered by the ML multi-agent engine.
          </p>
        </div>
        {product && (
          <button
            type="button"
            className="sb__open-product"
            onClick={() => navigate(`/app/products/${product.id}`)}
          >
            <Package size={13} />
            Open workbench
            <ChevronRight size={13} />
          </button>
        )}
      </header>

      {/* Controls */}
      <section className="sb-controls card">
        <div className="sb-controls__row">
          <label className="sb-controls__field">
            <span className="sb-controls__label">Product</span>
            <ProductPicker products={products} value={productId} onChange={setProductId} />
          </label>

          <div className="sb-controls__field">
            <span className="sb-controls__label">Objective</span>
            <div className="sb-controls__pills">
              {OBJECTIVES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`sb-pill ${objective === o.id ? 'sb-pill--active' : ''}`}
                  onClick={() => setObjective(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sb-controls__row">
          <div className="sb-controls__field">
            <span className="sb-controls__label">Horizon</span>
            <div className="sb-controls__pills">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`sb-pill ${horizon === h ? 'sb-pill--active' : ''}`}
                  onClick={() => setHorizon(h)}
                >
                  {h} days
                </button>
              ))}
            </div>
          </div>

          <div className="sb-controls__field sb-controls__field--slider">
            <span className="sb-controls__label">
              Aggressiveness · {Math.round(aggressiveness * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={aggressiveness}
              onChange={(e) => setAggressiveness(Number(e.target.value))}
              className="pe-scenario__range"
            />
            <div className="sb-controls__slider-ticks">
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
          </div>
        </div>
      </section>

      {/* Summary strip */}
      {data && product && (
        <motion.div
          className="sb-summary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="sb-summary__cell">
            <span>Current price</span>
            <strong>₹{Number(product.current_price).toLocaleString('en-IN')}</strong>
          </div>
          <div className="sb-summary__cell">
            <span>Strategies evaluated</span>
            <strong>{data.all_candidates_count}</strong>
          </div>
          <div className="sb-summary__cell">
            <span>Top recommendation</span>
            <strong>{data.strategies?.[0]?.name}</strong>
          </div>
          <div className="sb-summary__cell">
            <span>Best uplift</span>
            <strong className={data.strategies?.[0]?.expected_revenue_uplift_pct >= 0 ? 'is-up' : 'is-down'}>
              {data.strategies?.[0]?.expected_revenue_uplift_pct >= 0 ? '+' : ''}
              {data.strategies?.[0]?.expected_revenue_uplift_pct?.toFixed(1)}%
            </strong>
          </div>
        </motion.div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="sb-loading">
          <Loader2 size={24} className="pw-spin" />
          <p>Running strategies through ML engine…</p>
        </div>
      ) : !data?.strategies?.length ? (
        <div className="pw-empty">
          <Target size={32} strokeWidth={1.25} />
          <h3>No strategies generated</h3>
          <p>Pick a product to get started.</p>
        </div>
      ) : (
        <motion.div
          className="sb-grid"
          variants={stagger(0.06, 0)}
          initial="initial"
          animate="animate"
        >
          {data.strategies.map((s, i) => (
            <StrategyCard key={s.name} s={s} isLeader={i === 0} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
