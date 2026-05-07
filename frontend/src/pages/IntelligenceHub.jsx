import React, { useState, useEffect, useCallback } from 'react';
import API from '../api/client';
import { useProduct } from '../context/ProductContext';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts';

// ── Signal metadata ────────────────────────────────────────────────────────────

const SIGNAL_META = {
  pricing:     { label: 'Pricing',     emoji: '💰', color: '#6366f1', desc: 'Competitor prices & position' },
  demand:      { label: 'Demand',      emoji: '📈', color: '#10b981', desc: 'Search trends & velocity' },
  sales:       { label: 'Sales',       emoji: '🛒', color: '#f59e0b', desc: 'Conversion & revenue momentum' },
  market:      { label: 'Market',      emoji: '🌐', color: '#3b82f6', desc: 'Marketplace movement' },
  inventory:   { label: 'Inventory',   emoji: '📦', color: '#8b5cf6', desc: 'Stock aging & burn rate' },
  sentiment:   { label: 'Sentiment',   emoji: '⭐', color: '#ec4899', desc: 'Reviews & ratings' },
  advertising: { label: 'Advertising', emoji: '📣', color: '#f97316', desc: 'ROAS & CAC estimates' },
  seasonality: { label: 'Seasonality', emoji: '🎉', color: '#14b8a6', desc: 'Festivals & trends' },
};

const STATUS_CONFIG = {
  GOOD: { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#10b981', dot: '#10b981' },
  WARN: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#f59e0b', dot: '#f59e0b' },
  RISK: { bg: 'rgba(239,68,68,0.12)',  border: '#ef4444', text: '#ef4444', dot: '#ef4444' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function HealthRing({ score, status }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const progress = ((score || 0) / 100) * circ;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.WARN;

  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
        <circle
          cx={70} cy={70} r={r}
          fill="none"
          stroke={cfg.border}
          strokeWidth={10}
          strokeDasharray={`${progress} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${cfg.border})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 140, height: 140,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: cfg.text, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: '0.65rem', color: cfg.text, fontWeight: 600, letterSpacing: 2, marginTop: 4 }}>{status}</div>
      </div>
    </div>
  );
}

function ScoreBar({ score, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 6, overflow: 'hidden', marginTop: 6 }}>
      <div style={{
        width: `${score}%`, height: '100%', borderRadius: 6,
        background: `linear-gradient(90deg, ${color}80, ${color})`,
        transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: `0 0 8px ${color}60`,
      }} />
    </div>
  );
}

function MiniSparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height: 40, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height={40}>
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
            fill={`url(#sg-${color.replace('#', '')})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.88)', fontWeight: 600, textAlign: 'right' }}>
        {String(value)}
      </span>
    </div>
  );
}

function SignalCard({ signalKey, signal }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SIGNAL_META[signalKey] || {};
  const cfg  = STATUS_CONFIG[signal.status] || STATUS_CONFIG.WARN;
  const metrics = signal.metrics || {};
  const metricEntries = Object.entries(metrics).slice(0, 6);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${expanded ? cfg.border : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16,
        padding: '20px 20px 16px',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
        opacity: expanded ? 1 : 0.4, transition: 'opacity 0.3s',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: '1.3rem' }}>{meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>{meta.desc}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px',
          borderRadius: 20, border: `1px solid ${cfg.border}`,
          background: cfg.bg,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: cfg.text, letterSpacing: 1 }}>
            {signal.status}
          </span>
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: meta.color, minWidth: 32, textAlign: 'right' }}>
          {signal.score}
        </div>
      </div>

      <ScoreBar score={signal.score} color={meta.color} />
      <MiniSparkline data={signal.sparkline} color={meta.color} />

      {/* Headline */}
      <div style={{ fontSize: '0.71rem', color: 'rgba(255,255,255,0.55)', marginTop: 10, lineHeight: 1.5 }}>
        {signal.headline}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          {/* Metrics */}
          {metricEntries.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, marginBottom: 6 }}>
                METRICS
              </div>
              {metricEntries.map(([k, v]) => (
                <MetricRow key={k} label={k.replace(/_/g, ' ')} value={typeof v === 'boolean' ? (v ? 'Yes ⚠️' : 'No') : v} />
              ))}
            </div>
          )}

          {/* Insights */}
          {signal.insights?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, marginBottom: 6 }}>
                INSIGHTS
              </div>
              {signal.insights.map((ins, i) => (
                <div key={i} style={{ fontSize: '0.71rem', color: 'rgba(255,255,255,0.6)', marginBottom: 4, paddingLeft: 10,
                  borderLeft: `2px solid ${meta.color}40` }}>
                  {ins}
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          {signal.recommendations?.[0] && (
            <div style={{
              background: `${meta.color}14`, border: `1px solid ${meta.color}30`,
              borderRadius: 8, padding: '8px 12px', fontSize: '0.72rem', color: meta.color,
              fontWeight: 500, lineHeight: 1.5,
            }}>
              💡 {signal.recommendations[0]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RadarOverview({ signals }) {
  const data = Object.entries(signals).map(([key, s]) => ({
    category: SIGNAL_META[key]?.label || key,
    score: s.score,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
        <PolarGrid stroke="rgba(255,255,255,0.08)" />
        <PolarAngleAxis dataKey="category" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }} />
        <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.18}
          strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntelligenceHub() {
  const { activeProduct } = useProduct();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]  = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const productId = activeProduct?.id || 'vs-essential-cotton-tee';

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    API.get(`/api/intelligence/${productId}`)
      .then(res => {
        setData(res.data);
        setLastRefresh(new Date());
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load intelligence data');
        setLoading(false);
      });
  }, [productId]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0f0a 100%)',
    padding: '32px 28px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  };

  if (loading && !data) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, border: '3px solid rgba(99,102,241,0.2)',
          borderTopColor: '#6366f1', borderRadius: '50%',
          animation: 'spin 0.9s linear infinite', margin: '0 auto 16px',
        }} />
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
          Analysing intelligence signals…
        </div>
      </div>
    </div>
  );

  if (error && !data) return (
    <div style={{ ...pageStyle }}>
      <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 12, padding: 20, fontSize: '0.85rem' }}>
        ⚠️ {error}
      </div>
    </div>
  );

  const signals = data?.signals || {};
  const health  = data?.overall_health_score || 0;
  const hStatus = data?.health_status || 'WARN';
  const hCfg    = STATUS_CONFIG[hStatus] || STATUS_CONFIG.WARN;

  return (
    <div style={pageStyle}>
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
            🧠 Intelligence Hub
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', margin: '6px 0 0' }}>
            AI-powered signal intelligence for <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{data?.product_name || productId}</strong>
            {lastRefresh && (
              <span style={{ marginLeft: 12, opacity: 0.5 }}>
                · Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)',
            color: '#6366f1', borderRadius: 10, padding: '8px 18px',
            fontSize: '0.78rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? '↻ Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* ── Hero: health ring + radar ───────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20, padding: '28px 32px', marginBottom: 24,
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <HealthRing score={health} status={hStatus} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, fontWeight: 700 }}>
              OVERALL HEALTH
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              {Object.entries(signals).map(([key, s]) => {
                const c = STATUS_CONFIG[s.status]?.dot || '#888';
                return (
                  <div key={key} title={`${SIGNAL_META[key]?.label}: ${s.score}`}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}` }} />
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>
            SIGNAL RADAR
          </div>
          <RadarOverview signals={signals} />
        </div>
      </div>

      {/* ── Summary KPI pills ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {Object.entries(signals).map(([key, s]) => {
          const meta = SIGNAL_META[key];
          const cfg  = STATUS_CONFIG[s.status] || STATUS_CONFIG.WARN;
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}30`,
            }}>
              <span style={{ fontSize: '0.9rem' }}>{meta.emoji}</span>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{meta.label}</span>
              <span style={{ fontSize: '0.72rem', color: cfg.text, fontWeight: 800 }}>{s.score}</span>
            </div>
          );
        })}
      </div>

      {/* ── Signal cards grid ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {Object.entries(signals).map(([key, signal]) => (
          <SignalCard key={key} signalKey={key} signal={signal} />
        ))}
      </div>

      {/* ── Footer note ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 28, textAlign: 'center', fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)' }}>
        Intelligence signals auto-refresh every 60 seconds · Click any card to expand details
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
