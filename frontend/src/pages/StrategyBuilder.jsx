import { useState, useEffect } from 'react';
import { useProduct } from '../context/ProductContext';
import API from '../api/client';
import StrategyCard from '../components/StrategyCard';
import BusinessGoalSelector from '../components/BusinessGoalSelector';
import AICopilot from '../components/AICopilot';
import AIInsightCards from '../components/AIInsightCards';
import ScenarioSimulator from '../components/ScenarioSimulator';
import StrategyScore from '../components/StrategyScore';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, ShieldCheck, Target, Activity } from 'lucide-react';

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');

const TOOLTIP_STYLE = {
  background: '#1A1A1A',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#FFFFFF',
  fontSize: 13,
};

const ARCHETYPE_META = {
  CLEARANCE:         { color: '#EF4444', desc: 'Sell through excess inventory quickly with aggressive pricing.' },
  PENETRATION:       { color: '#3B82F6', desc: 'Capture market share with a low entry price to build volume.' },
  PREMIUM:           { color: '#22C55E', desc: 'Maximise margin by leveraging brand strength and low elasticity.' },
  SKIM:              { color: '#F59E0B', desc: 'Launch high and lower price over time as demand matures.' },
  COMPETITIVE_MATCH: { color: '#8B5CF6', desc: 'Stay in lock-step with the market to defend volume.' },
  HOLD:              { color: '#71717A', desc: 'Current price is optimal — no change recommended.' },
};

export default function StrategyBuilder() {
  const { activeProduct } = useProduct();
  const productId = activeProduct?.id || activeProduct?.product_id;

  const [strategy, setStrategy] = useState(null);
  const [simData, setSimData] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showGoalSelector, setShowGoalSelector] = useState(true);

  // Fetch strategy data to build the simulation chart + corridor panel
  useEffect(() => {
    if (!productId) return;
    API.get(`/api/strategy/${productId}`)
      .then(r => {
        setStrategy(r.data);
        // Build simulation chart from 30-day series
        const series = r.data?.simulation?.series || {};
        const days = Object.values(series)[0]?.length || 0;
        const rows = Array.from({ length: days }, (_, i) => {
          const row = { day: i + 1 };
          for (const [name, arr] of Object.entries(series)) {
            row[name] = arr[i]?.revenue ?? 0;
          }
          return row;
        });
        setSimData(rows);
      })
      .catch(() => {});
  }, [productId]);

  const handleGoalSelect = (goal) => {
    setSelectedGoal(goal);
    setShowGoalSelector(false);
  };

  const handleGoalChange = (newGoal) => {
    setSelectedGoal(newGoal);
  };

  const archetype = strategy?.archetype || 'HOLD';
  const meta = ARCHETYPE_META[archetype] || ARCHETYPE_META.HOLD;
  const corridor = strategy?.price_corridor;
  const compStats = strategy?.competitor_stats;
  const currentPrice = strategy?.current_price || 0;
  const recommendedPrice = strategy?.recommended_price || 0;

  const SIM_COLORS = {
    PENETRATION:       '#3B82F6',
    PREMIUM:           '#22C55E',
    COMPETITIVE_MATCH: '#8B5CF6',
    HOLD:              '#71717A',
    CLEARANCE:         '#EF4444',
    SKIM:              '#F59E0B',
  };

  return (
    <div className="main-content">
      {/* Business Goal Selector Modal */}
      <BusinessGoalSelector 
        onSelect={handleGoalSelect}
        isOpen={showGoalSelector}
        activeProduct={activeProduct}
      />

      <div className="page-header">
        <h2>Strategy Builder</h2>
        <p>
          AI-powered pricing intelligence for <strong>{activeProduct?.name || 'selected product'}</strong>
          {selectedGoal && (
            <span style={{ marginLeft: 16, color: 'rgba(255,255,255,0.6)' }}>
              · Goal: {selectedGoal.replace('_', ' ')}
            </span>
          )}
        </p>
      </div>

      {/* AI Insights Row */}
      <div style={{ marginBottom: 24 }}>
        <AIInsightCards productId={productId} isCompact={true} />
      </div>

      {/* Row 1: Strategy Card (full intelligence card) */}
      <StrategyCard productId={productId} />

      {/* Row 2: AI Copilot Chat (if goal selected) */}
      {selectedGoal && (
        <div style={{ marginTop: 24, height: 500 }}>
          <AICopilot 
            productId={productId} 
            goalType={selectedGoal}
            onGoalChange={handleGoalChange}
          />
        </div>
      )}

      {/* Row 3: Archetype + Corridor + Competitor stats */}
      {strategy && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 }}>

          {/* Archetype Info */}
          <div className="card" style={{ borderTop: `3px solid ${meta.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <ShieldCheck size={18} style={{ color: meta.color }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Active Archetype
              </span>
            </div>
            <div style={{
              fontSize: '1.4rem', fontWeight: 800, color: meta.color, marginBottom: 8,
              letterSpacing: '-0.02em',
            }}>
              {archetype.replace('_', ' ')}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {meta.desc}
            </p>
            <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Elasticity:&nbsp;
              <strong style={{ color: 'var(--text-primary)' }}>
                {strategy.elasticity?.toFixed(2) ?? '—'}
              </strong>
              &nbsp;·&nbsp;Confidence:&nbsp;
              <strong style={{ color: 'var(--text-primary)' }}>
                {Math.round(strategy.confidence ?? 0)}%
              </strong>
            </div>
          </div>

          {/* Price Corridor */}
          {corridor && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Target size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Price Corridor
                </span>
              </div>
              {/* Visual corridor bar */}
              <div style={{ position: 'relative', height: 8, background: 'var(--border)', borderRadius: 8, marginBottom: 16 }}>
                {/* filled corridor range */}
                <div style={{
                  position: 'absolute', left: 0, right: 0,
                  height: '100%', background: 'var(--accent)',
                  borderRadius: 8, opacity: 0.25,
                }} />
                {/* current price marker */}
                {currentPrice > 0 && corridor.max > corridor.min && (
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(100, Math.max(0, ((currentPrice - corridor.min) / (corridor.max - corridor.min)) * 100))}%`,
                    top: -4, width: 2, height: 16,
                    background: '#71717A', borderRadius: 2,
                    transform: 'translateX(-50%)',
                  }} title="Current price" />
                )}
                {/* recommended price marker */}
                {recommendedPrice > 0 && corridor.max > corridor.min && (
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(100, Math.max(0, ((recommendedPrice - corridor.min) / (corridor.max - corridor.min)) * 100))}%`,
                    top: -4, width: 3, height: 16,
                    background: 'var(--accent)', borderRadius: 2,
                    transform: 'translateX(-50%)',
                  }} title="Recommended price" />
                )}
              </div>
              {/* Labels under the bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                <span>₹{fmt(corridor.min)} <span style={{ opacity: 0.5 }}>floor</span></span>
                <span style={{ color: '#71717A', fontSize: '0.68rem' }}>▏current ₹{fmt(currentPrice)}▕</span>
                <span>₹{fmt(corridor.max)} <span style={{ opacity: 0.5 }}>ceiling</span></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Floor (min allowed)', val: corridor.min, note: 'Cost + margin buffer' },
                  { label: 'Ceiling (max allowed)', val: corridor.max, note: 'Elasticity bound' },
                  { label: 'Recommended price', val: recommendedPrice },
                  { label: 'Current price', val: currentPrice },
                ].map(({ label, val, note }) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>₹{fmt(val)}</div>
                    {note && <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitor Stats */}
          {compStats && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Activity size={18} style={{ color: '#F59E0B' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Market Intelligence
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Market Average', val: compStats.avg_price, cmp: currentPrice },
                  { label: 'Market Low (P25)', val: compStats.p25, cmp: currentPrice },
                  { label: 'Market Min', val: compStats.min_price, cmp: currentPrice },
                  { label: 'Market Max', val: compStats.max_price, cmp: currentPrice },
                ].map(({ label, val, cmp }) => {
                  const diff = val - cmp;
                  const up = diff > 0;
                  return (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem' }}>
                        ₹{fmt(val)}
                        <span style={{ fontSize: '0.72rem', color: up ? '#22C55E' : '#EF4444', display: 'flex', alignItems: 'center', gap: 2 }}>
                          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {up ? '+' : ''}{Math.round(diff)}
                        </span>
                      </span>
                    </div>
                  );
                })}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {compStats.count} competitor listings analysed
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 4: 30-day revenue simulation chart */}
      {simData.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                30-Day Revenue Simulation
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Projected daily revenue across all strategy archetypes
              </p>
            </div>
            <span className="badge-accent">ML · XGBoost</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={simData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#52525B', fontSize: 11 }}
                axisLine={false} tickLine={false}
                label={{ value: 'Day', position: 'insideBottomRight', offset: -8, fill: '#52525B', fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: '#52525B', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, name) => [`₹${fmt(v)}`, name.replace('_', ' ')]}
              />
              {Object.keys(simData[0] || {})
                .filter(k => k !== 'day')
                .map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={SIM_COLORS[name] || '#888'}
                    strokeWidth={name === archetype ? 2.5 : 1.2}
                    strokeDasharray={name === archetype ? undefined : '4 3'}
                    dot={false}
                    opacity={name === archetype ? 1 : 0.5}
                  />
                ))}
              <ReferenceLine
                x={1}
                stroke="rgba(139,92,246,0.3)"
                strokeDasharray="3 3"
                label={{ value: 'Today', position: 'insideTopRight', fill: '#A78BFA', fontSize: 11 }}
              />
            </LineChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
            {Object.keys(simData[0] || {})
              .filter(k => k !== 'day')
              .map(name => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: 24, height: 3, background: SIM_COLORS[name] || '#888', borderRadius: 2, display: 'inline-block', opacity: name === archetype ? 1 : 0.5 }} />
                  {name.replace('_', ' ')}
                  {name === archetype && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 600 }}>← active</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

