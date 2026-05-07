import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, Sparkles, Zap, AlertCircle, RefreshCw,
  CalendarDays, SplitSquareHorizontal,
} from 'lucide-react';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';

/* ─── Archetype glow colors ─────────────────────────────────── */
const GLOW = {
  PREMIUM:           '#22C55E',
  PENETRATION:       '#3B82F6',
  CLEARANCE:         '#EF4444',
  SKIM:              '#F59E0B',
  COMPETITIVE_MATCH: '#8B5CF6',
  HOLD:              '#71717A',
};

/* Archetype → CSS badge class */
const ARCHETYPE_BADGE = {
  PREMIUM:           'badge-premium',
  PENETRATION:       'badge-penetration',
  CLEARANCE:         'badge-clearance',
  SKIM:              'badge-skim',
  COMPETITIVE_MATCH: 'badge-match',
  HOLD:              'badge-hold',
};

const COMPARE_ARCHETYPES = ['PENETRATION', 'PREMIUM', 'COMPETITIVE_MATCH', 'HOLD'];

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');

/* ─── Skeleton block ────────────────────────────────────────── */
function SkelBar({ width = '100%', height = 12, style }) {
  return (
    <span
      className="sc-skel"
      style={{ width, height, borderRadius: 4, display: 'block', ...style }}
    />
  );
}

function StrategyCardSkeleton() {
  return (
    <div className="sc card sc--loading">
      <div className="sc__header">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkelBar width="140px" height={10} />
          <SkelBar width="200px" height={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <SkelBar width="80px" height={20} style={{ borderRadius: 999 }} />
          <SkelBar width="100px" height={10} />
        </div>
      </div>

      <div className="sc__price-block" style={{ gap: 12 }}>
        <SkelBar width="80px" height={16} />
        <SkelBar width="20px" height={16} />
        <SkelBar width="160px" height={36} />
        <SkelBar width="100px" height={20} style={{ borderRadius: 999 }} />
      </div>

      <div className="sc__rationale">
        <SkelBar width="60%" height={10} />
        <div style={{ height: 8 }} />
        <SkelBar width="100%" height={10} />
        <div style={{ height: 6 }} />
        <SkelBar width="92%" height={10} />
        <div style={{ height: 6 }} />
        <SkelBar width="76%" height={10} />
      </div>

      <div className="sc__tiles">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sc__tile">
            <SkelBar width="60%" height={10} style={{ margin: '0 auto 10px' }} />
            <SkelBar width="50%" height={18} style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Error state ───────────────────────────────────────────── */
function StrategyCardError({ onRetry }) {
  return (
    <div className="sc card sc--error">
      <AlertCircle size={24} className="sc__error-icon" />
      <div className="sc__error-title">Failed to load strategy</div>
      <div className="sc__error-sub">Check your connection and try again</div>
      <button type="button" className="btn-secondary sc__retry" onClick={onRetry}>
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}

/* ─── Priority pill (auto-trigger rules) ───────────────────── */
function PriorityPill({ priority }) {
  const cls = `sc__priority sc__priority--${(priority || 'low').toLowerCase()}`;
  return <span className={cls}>{priority}</span>;
}

/* ─── Severity dot (risk flags) ────────────────────────────── */
function SeverityDot({ severity }) {
  const cls = `sc__sev-dot sc__sev-dot--${(severity || 'info').toLowerCase()}`;
  return <span className={cls} aria-hidden="true" />;
}

/* ─── Main component ───────────────────────────────────────── */
export default function StrategyCard({ productId }) {
  const { activeProduct } = useProduct();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showActionPlan, setShowActionPlan] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);

  const fetchStrategy = useCallback(() => {
    if (!productId) return;
    setLoading(true);
    setError('');
    setData(null);
    setShowActionPlan(false);
    setShowSimulation(false);
    API.get(`/api/strategy/${productId}`)
      .then((r) => setData(r.data))
      .catch((err) => {
        console.error('Strategy fetch failed:', err);
        setError(err.message || 'Failed');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => { fetchStrategy(); }, [fetchStrategy]);

  if (loading) return <StrategyCardSkeleton />;
  if (error)   return <StrategyCardError onRetry={fetchStrategy} />;
  if (!data)   return null;

  const {
    product_name, archetype = 'HOLD',
    current_price = 0, recommended_price = 0,
    confidence = 0, rationale = '',
    risk_flags = [], action_plan = [], triggers = [],
    simulation, expected_outcome = {},
  } = data;

  const glow = GLOW[archetype] || GLOW.HOLD;
  const badgeCls = ARCHETYPE_BADGE[archetype] || 'badge-neutral';

  const priceDiff = recommended_price - current_price;
  const pricePct  = current_price > 0 ? (priceDiff / current_price) * 100 : 0;
  const priceUp   = priceDiff > 0.5;
  const priceDown = priceDiff < -0.5;

  let changeBadgeCls = 'badge-neutral';
  let changeText = 'No change';
  if (priceUp) {
    changeBadgeCls = 'badge-success';
    changeText = `+₹${fmt(Math.abs(priceDiff))} · +${pricePct.toFixed(1)}%`;
  } else if (priceDown) {
    changeBadgeCls = 'badge-danger';
    changeText = `-₹${fmt(Math.abs(priceDiff))} · ${pricePct.toFixed(1)}%`;
  }

  const category = activeProduct?.category || activeProduct?.product_type || 'Apparel';
  const productLabel = product_name || activeProduct?.name || 'Product';

  const revenueImpact = expected_outcome.revenue_impact_pct ?? 0;
  const simSummary = simulation?.summary || {};

  return (
    <div className="sc card">
      {/* Ambient glow */}
      <span
        className="sc__glow"
        aria-hidden="true"
        style={{ background: glow }}
      />

      {/* Section 1 — Header row */}
      <div className="sc__header">
        <div>
          <div className="sc__supra">Vouge Studio · {category}</div>
          <div className="sc__brand">{productLabel}</div>
        </div>
        <div className="sc__header-right">
          <span className={`${badgeCls} sc__archetype-badge`}>{archetype}</span>
          <span className="sc__confidence">{Math.round(confidence)}% confidence</span>
        </div>
      </div>

      {/* Section 2 — Price block */}
      <div className="sc__price-block">
        <span className="sc__current-price">₹{fmt(current_price)}</span>
        <ArrowRight size={18} className="sc__price-arrow" />
        <span className="sc__rec-price">₹{fmt(recommended_price)}</span>
        <span className={`${changeBadgeCls} sc__change`}>{changeText}</span>
        <span className="sc__archetype-note">Archetype: {archetype} strategy</span>
      </div>

      {/* Section 3 — AI Rationale */}
      <div className="sc__rationale">
        <div className="sc__rationale-head">
          <span className="sc__rationale-label">
            <Sparkles size={12} /> AI Analysis
          </span>
          <span className="sc__rationale-meta">Groq · llama-3.3-70b</span>
        </div>
        <p className="sc__rationale-text">{rationale}</p>
      </div>

      {/* Section 4 — Outcome tiles */}
      <div className="sc__tiles">
        <div className="sc__tile">
          <div className="sc__tile-label">30-Day Revenue</div>
          <div className="sc__tile-value">₹{fmt(expected_outcome.revenue_30d)}</div>
        </div>
        <div className="sc__tile">
          <div className="sc__tile-label">30-Day Margin</div>
          <div className="sc__tile-value">₹{fmt(expected_outcome.margin_30d)}</div>
        </div>
        <div className="sc__tile">
          <div className="sc__tile-label">vs Hold</div>
          <div
            className={`sc__tile-value ${
              revenueImpact >= 0 ? 'sc__tile-value--up' : 'sc__tile-value--down'
            }`}
          >
            {revenueImpact >= 0 ? '+' : ''}{revenueImpact.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Section 5 — Trigger rules */}
      {triggers.length > 0 && (
        <div className="sc__triggers">
          <div className="sc__section-label text-label">
            <Zap size={12} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Auto-Trigger Rules
          </div>
          <div className="sc__trigger-list">
            {triggers.map((t, i) => (
              <div key={i} className="sc__trigger-row">
                <PriorityPill priority={t.priority} />
                <span className="sc__trigger-cond">{t.condition}</span>
                <span className="sc__trigger-arrow">→</span>
                <span className="sc__trigger-action">
                  {t.action}{t.value != null ? ` ₹${fmt(t.value)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 6 — Risk flags */}
      {risk_flags.length > 0 && (
        <div className="sc__risks">
          {risk_flags.map((flag, i) => (
            <div key={i} className="sc__risk-row">
              <SeverityDot severity={flag.severity} />
              <span className="sc__risk-msg">{flag.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section 7 — Action buttons */}
      <div className="sc__actions">
        <button
          type="button"
          className="btn-secondary sc__action-btn"
          onClick={() => setShowActionPlan((v) => !v)}
        >
          <CalendarDays size={14} />
          {showActionPlan ? 'Hide 14-Day Plan' : 'View 14-Day Plan'}
        </button>
        <button
          type="button"
          className="btn-secondary sc__action-btn"
          onClick={() => setShowSimulation((v) => !v)}
        >
          <SplitSquareHorizontal size={14} />
          {showSimulation ? 'Hide Comparison' : 'Compare Strategies'}
        </button>
      </div>

      {/* Section 8 — 14-day action plan */}
      <div className={`sc__expand ${showActionPlan ? 'sc__expand--open' : ''}`}>
        <div className="sc__expand-inner">
          <div className="sc__expand-title">14-Day Price Action Plan</div>
          <div className="sc__plan-wrap">
            <table className="sc__plan-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Date</th>
                  <th>Price</th>
                  <th>Demand</th>
                  <th>Revenue</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {action_plan.map((d, i) => (
                  <tr key={i} className={i === 0 ? 'sc__plan-row--today' : ''}>
                    <td>{d.day}</td>
                    <td>{d.date}</td>
                    <td className="sc__plan-price">₹{fmt(d.recommended_price)}</td>
                    <td>{Math.round(d.expected_demand || 0)}</td>
                    <td className="sc__plan-rev">₹{fmt(d.expected_revenue)}</td>
                    <td>₹{fmt(d.expected_margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 9 — Strategy comparison */}
      <div className={`sc__expand ${showSimulation ? 'sc__expand--open' : ''}`}>
        <div className="sc__expand-inner">
          <div className="sc__expand-title">Strategy Comparison — 30-Day Projection</div>
          <div className="sc__compare-grid">
            {COMPARE_ARCHETYPES.map((a) => {
              const stats = simSummary[a];
              const isRec = a === archetype;
              const holdRev = simSummary.HOLD?.total_revenue || 0;
              const myRev = stats?.total_revenue || 0;
              const vsHold = holdRev > 0 ? ((myRev - holdRev) / holdRev) * 100 : 0;
              const positive = vsHold >= 0;
              return (
                <div
                  key={a}
                  className={`sc__compare-card ${isRec ? 'sc__compare-card--rec' : ''}`}
                >
                  {isRec && <span className="sc__compare-rec-badge">Recommended</span>}
                  <div className="sc__compare-name">{a.replace('_', ' ')}</div>

                  {stats ? (
                    <>
                      <div className="sc__compare-price">
                        ₹{fmt(stats.total_revenue / Math.max(1, stats.total_units || 1))}
                      </div>
                      <div className="sc__compare-rev-label">30-day revenue</div>
                      <div className="sc__compare-rev-value">₹{fmt(stats.total_revenue)}</div>
                      {a !== 'HOLD' && (
                        <div
                          className={`sc__compare-delta ${
                            positive ? 'sc__compare-delta--up' : 'sc__compare-delta--down'
                          }`}
                        >
                          {positive ? '+' : ''}{vsHold.toFixed(1)}% vs Hold
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="sc__compare-empty">No data</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
