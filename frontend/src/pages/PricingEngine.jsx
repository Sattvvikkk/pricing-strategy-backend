import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Gauge, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Sparkles, History, Loader2, Lock,
} from 'lucide-react';

import API from '../api/client';
import AnimatedCounter from '../components/AnimatedCounter';
import { fadeUp, stagger, EASE } from '../motion/tokens';

const DEFAULT_CONSTRAINTS = {
  min_margin_pct: 25,
  max_price_change_pct: 12,
  auto_apply_threshold_pct: 4,
  min_confidence_for_auto: 0.75,
  clearance_mode: false,
};

function GuardrailRow({ g }) {
  const Icon = g.passed ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`pe-guard ${g.passed ? 'is-ok' : 'is-bad'}`}>
      <Icon size={13} strokeWidth={2.25} />
      <div className="pe-guard__body">
        <span className="pe-guard__name">{g.name.replace(/_/g, ' ')}</span>
        <span className="pe-guard__detail">{g.detail}</span>
      </div>
    </div>
  );
}

export default function PricingEngine() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [decision, setDecision] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS);
  const [overriding, setOverriding] = useState(false);
  const [overridePrice, setOverridePrice] = useState('');

  // Load products
  useEffect(() => {
    API.get('/api/products')
      .then((r) => {
        const list = r.data?.products || [];
        setProducts(list);
        if (!productId && list[0]) setProductId(list[0].id);
      })
      .catch(() => setProducts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run optimization on product/constraint change
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    API.post('/api/pricing/optimize', { product_id: productId, constraints })
      .then((r) => {
        if (cancelled) return;
        setDecision(r.data);
        setOverridePrice(String(r.data?.recommended_price || ''));
      })
      .catch(() => !cancelled && setDecision(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [productId, constraints]);

  // Refresh audit
  useEffect(() => {
    if (!productId) return;
    API.get(`/api/pricing/audit/${productId}`)
      .then((r) => setAudit(r.data?.entries || []))
      .catch(() => setAudit([]));
  }, [productId, decision]);

  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  const submitOverride = async () => {
    if (!productId || !overridePrice) return;
    setOverriding(true);
    try {
      await API.post('/api/pricing/override', {
        product_id: productId,
        new_price: Number(overridePrice),
        actor: 'pricing-manager@vougestudio.com',
        note: 'Manual override from pricing engine',
      });
      const r = await API.get(`/api/pricing/audit/${productId}`);
      setAudit(r.data?.entries || []);
    } finally {
      setOverriding(false);
    }
  };

  return (
    <div className="dpe">
      <header className="dpe__header">
        <div>
          <div className="dpe__title-row">
            <Gauge size={20} strokeWidth={1.75} />
            <h1 className="dpe__title">Dynamic Pricing Engine</h1>
          </div>
          <p className="dpe__sub">
            Final price decisions, guardrail-validated, audit-tracked.
          </p>
        </div>
        <div className="ai__product-picker">
          <label className="sb-controls__label">Product</label>
          <select
            className="sb-picker"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Constraints */}
      <section className="dpe-cons card">
        <h2 className="dpe-section-title">Constraints</h2>
        <div className="dpe-cons__grid">
          <label className="dpe-cons__field">
            <span>Min margin %</span>
            <input
              type="number"
              min={0}
              max={90}
              step={1}
              value={constraints.min_margin_pct}
              onChange={(e) => setConstraints({ ...constraints, min_margin_pct: Number(e.target.value) })}
            />
          </label>
          <label className="dpe-cons__field">
            <span>Max move %</span>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={constraints.max_price_change_pct}
              onChange={(e) => setConstraints({ ...constraints, max_price_change_pct: Number(e.target.value) })}
            />
          </label>
          <label className="dpe-cons__field">
            <span>Auto-apply ≤ %</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={constraints.auto_apply_threshold_pct}
              onChange={(e) => setConstraints({ ...constraints, auto_apply_threshold_pct: Number(e.target.value) })}
            />
          </label>
          <label className="dpe-cons__field">
            <span>Min confidence</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={constraints.min_confidence_for_auto}
              onChange={(e) => setConstraints({ ...constraints, min_confidence_for_auto: Number(e.target.value) })}
            />
          </label>
          <label className="dpe-cons__toggle">
            <input
              type="checkbox"
              checked={constraints.clearance_mode}
              onChange={(e) => setConstraints({ ...constraints, clearance_mode: e.target.checked })}
            />
            <span>Clearance mode</span>
          </label>
        </div>
      </section>

      {/* Decision card */}
      {loading || !decision ? (
        <div className="dpe-loading">
          <Loader2 size={24} className="pw-spin" />
          <p>Running engine…</p>
        </div>
      ) : (
        <motion.section
          className="dpe-decision card"
          variants={fadeUp}
          initial="initial"
          animate="animate"
        >
          <div className="dpe-decision__top">
            <div>
              <span className="dpe-decision__label">Decision</span>
              <h2 className="dpe-decision__title">
                {decision.delta_pct === 0 ? 'Hold price' :
                  decision.delta_pct > 0 ? `Increase ${decision.delta_pct.toFixed(1)}%` :
                  `Decrease ${Math.abs(decision.delta_pct).toFixed(1)}%`}
              </h2>
            </div>
            <div className={`dpe-decision__badge ${decision.auto_applied ? 'is-auto' : 'is-manual'}`}>
              {decision.auto_applied ? (
                <>
                  <CheckCircle2 size={14} strokeWidth={2.25} />
                  Auto-apply
                </>
              ) : (
                <>
                  <Lock size={14} strokeWidth={2.25} />
                  Approval required
                </>
              )}
            </div>
          </div>

          <div className="dpe-decision__prices">
            <div className="dpe-decision__price-card">
              <span>Current</span>
              <strong>₹{Number(decision.current_price).toLocaleString('en-IN')}</strong>
            </div>
            <div className="dpe-decision__arrow">→</div>
            <div className="dpe-decision__price-card dpe-decision__price-card--rec">
              <span>Recommended</span>
              <strong>₹{Number(decision.recommended_price).toLocaleString('en-IN')}</strong>
              <span className={`dpe-decision__delta ${decision.delta_pct >= 0 ? 'is-up' : 'is-down'}`}>
                {decision.delta_pct >= 0 ? '+' : ''}{decision.delta_pct.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="dpe-decision__metrics">
            <div className="dpe-decision__metric">
              <span>Confidence</span>
              <strong>
                <AnimatedCounter
                  value={Math.round((decision.confidence_score || 0) * 100)}
                  suffix="%"
                />
              </strong>
            </div>
            <div className="dpe-decision__metric">
              <span>Revenue uplift</span>
              <strong className={decision.expected_revenue_uplift_pct >= 0 ? 'is-up' : 'is-down'}>
                {decision.expected_revenue_uplift_pct >= 0 ? '+' : ''}{decision.expected_revenue_uplift_pct.toFixed(1)}%
              </strong>
            </div>
            <div className="dpe-decision__metric">
              <span>Margin uplift</span>
              <strong className={decision.expected_margin_uplift_pct >= 0 ? 'is-up' : 'is-down'}>
                {decision.expected_margin_uplift_pct >= 0 ? '+' : ''}{decision.expected_margin_uplift_pct.toFixed(2)} pts
              </strong>
            </div>
            <div className="dpe-decision__metric">
              <span>Rollout</span>
              <strong>{decision.rollout?.phase}</strong>
            </div>
          </div>

          {/* Reasons */}
          <div className="dpe-decision__reasons">
            <span className="dpe-decision__label">Reason codes</span>
            <ul>
              {decision.reason_codes.map((r, i) => (
                <li key={i}><Sparkles size={11} /> {r}</li>
              ))}
            </ul>
          </div>

          {/* Rollout */}
          {decision.rollout?.schedule && (
            <div className="dpe-decision__rollout">
              <span>Rollout schedule</span>
              <strong>{decision.rollout.schedule}</strong>
            </div>
          )}
        </motion.section>
      )}

      {/* Guardrails */}
      {decision && (
        <motion.section
          className="dpe-guards card"
          variants={stagger(0.04)}
          initial="initial"
          animate="animate"
        >
          <h2 className="dpe-section-title">Guardrails</h2>
          <div className="dpe-guards__grid">
            {decision.guardrails.map((g) => (
              <motion.div key={g.name} variants={fadeUp}>
                <GuardrailRow g={g} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Override + Audit */}
      <div className="dpe-bottom">
        <section className="dpe-override card">
          <h2 className="dpe-section-title">Manual override</h2>
          <p className="dpe-override__sub">
            Set any price (will be flagged for approval and recorded in audit log).
          </p>
          <div className="dpe-override__row">
            <input
              type="number"
              className="dpe-override__input"
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
              placeholder="Override price"
            />
            <button
              type="button"
              className="pw-btn pw-btn--primary"
              onClick={submitOverride}
              disabled={overriding || !overridePrice}
            >
              {overriding ? <Loader2 size={14} className="pw-spin" /> : <Lock size={14} />}
              Submit override
            </button>
          </div>
        </section>

        <section className="dpe-audit card">
          <h2 className="dpe-section-title">
            <History size={14} /> Audit log
          </h2>
          {audit.length === 0 ? (
            <div className="pw-empty">No decisions yet.</div>
          ) : (
            <ul className="dpe-audit__list">
              {audit.slice(0, 8).map((entry, i) => (
                <li key={i} className="dpe-audit__row">
                  <div className="dpe-audit__head">
                    <span className={`dpe-audit__type ${entry.type === 'manual_override' ? 'is-manual' : entry.auto_applied ? 'is-auto' : 'is-pending'}`}>
                      {entry.type === 'manual_override' ? 'Override' :
                        entry.auto_applied ? 'Auto-applied' : 'Pending approval'}
                    </span>
                    <span className="dpe-audit__time">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="dpe-audit__body">
                    <span>₹{entry.current_price} → ₹{entry.recommended_price}</span>
                    <span className={entry.delta_pct >= 0 ? 'is-up' : 'is-down'}>
                      {entry.delta_pct >= 0 ? '+' : ''}{entry.delta_pct?.toFixed(2)}%
                    </span>
                  </div>
                  {entry.actor && <div className="dpe-audit__actor">by {entry.actor}{entry.note ? ` · ${entry.note}` : ''}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
