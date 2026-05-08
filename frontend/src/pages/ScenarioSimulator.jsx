import { useState, useEffect, useCallback } from 'react';
import {
  Sliders, TrendingUp, TrendingDown, DollarSign, Package, Target, Zap,
  BarChart3, RefreshCw, Play, AlertTriangle, CheckCircle, Info,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';

// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(value) {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  return `₹${(value / 1000).toFixed(0)}K`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  return value.toLocaleString();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, before, after, change, format = formatCurrency }) {
  const isPositive = change > 0;
  const changeColor = isPositive ? '#10B981' : '#EF4444';
  const changeIcon = isPositive ? TrendingUp : TrendingDown;
  const ChangeIcon = changeIcon;

  return (
    <div className="sim-metric-card">
      <div className="sim-metric-card__label">{label}</div>
      <div className="sim-metric-card__values">
        <div className="sim-metric-card__before">
          <span className="sim-metric-card__before-label">Before</span>
          <span className="sim-metric-card__before-value">{format(before)}</span>
        </div>
        <div className="sim-metric-card__after">
          <span className="sim-metric-card__after-label">After</span>
          <span className="sim-metric-card__after-value">{format(after)}</span>
        </div>
      </div>
      <div className="sim-metric-card__change" style={{ color: changeColor }}>
        <ChangeIcon size={14} />
        <span>{isPositive ? '+' : ''}{formatPercent(change / before)}</span>
      </div>
    </div>
  );
}

function SliderControl({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step, 
  format, 
  icon: Icon,
  description 
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="sim-slider-control">
      <div className="sim-slider-control__header">
        <div className="sim-slider-control__label-group">
          <Icon size={16} className="sim-slider-control__icon" />
          <span className="sim-slider-control__label">{label}</span>
        </div>
        <div className="sim-slider-control__value">
          {format ? format(value) : value}
        </div>
      </div>
      {description && (
        <div className="sim-slider-control__desc">{description}</div>
      )}
      <div className="sim-slider-control__slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="sim-slider"
          style={{ '--value-percentage': `${percentage}%` }}
        />
      </div>
      <div className="sim-slider-control__ticks">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

function SelectControl({ label, value, onChange, options, icon: Icon }) {
  return (
    <div className="sim-select-control">
      <div className="sim-select-control__header">
        <Icon size={16} className="sim-select-control__icon" />
        <span className="sim-select-control__label">{label}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sim-select"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExplainableAI({ simulation }) {
  const { changes, inputs } = simulation;
  
  // Determine confidence based on magnitude of changes
  const totalChange = Math.abs(changes.revenue_change_pct) + Math.abs(changes.margin_change_pct);
  const confidence = Math.min(95, Math.max(65, 85 - totalChange / 2));
  
  // Determine key factors
  const factors = [];
  if (Math.abs(inputs.price_change_pct) > 5) {
    factors.push(`Price change of ${inputs.price_change_pct > 0 ? '+' : ''}${inputs.price_change_pct.toFixed(1)}%`);
  }
  if (inputs.ad_spend_multiplier !== 1.0) {
    factors.push(`Ad spend multiplier of ${inputs.ad_spend_multiplier.toFixed(1)}x`);
  }
  if (inputs.competitor_reaction !== 'neutral') {
    factors.push(`${inputs.competitor_reaction} competitor reaction`);
  }
  if (inputs.demand_spike !== 1.0) {
    factors.push(`Demand spike factor of ${inputs.demand_spike.toFixed(1)}x`);
  }
  
  return (
    <div className="sim-explainable">
      <div className="sim-explainable__header">
        <div className="sim-explainable__confidence">
          <span className="sim-explainable__confidence-label">AI Confidence</span>
          <span className="sim-explainable__confidence-value">{confidence.toFixed(0)}%</span>
        </div>
      </div>
      
      <div className="sim-explainable__section">
        <h4 className="sim-explainable__section-title">WHY</h4>
        <div className="sim-explainable__factors">
          {factors.map((factor, i) => (
            <div key={i} className="sim-explainable__factor">
              <CheckCircle size={14} className="sim-explainable__factor-icon" />
              <span>{factor}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="sim-explainable__section">
        <h4 className="sim-explainable__section-title">IMPACT</h4>
        <div className="sim-explainable__impact">
          <div className="sim-explainable__impact-item">
            <span>Revenue</span>
            <span className={changes.revenue_change_pct > 0 ? 'positive' : 'negative'}>
              {changes.revenue_change_pct > 0 ? '+' : ''}{changes.revenue_change_pct.toFixed(1)}%
            </span>
          </div>
          <div className="sim-explainable__impact-item">
            <span>Margin</span>
            <span className={changes.margin_change_pct > 0 ? 'positive' : 'negative'}>
              {changes.margin_change_pct > 0 ? '+' : ''}{changes.margin_change_pct.toFixed(1)}%
            </span>
          </div>
          <div className="sim-explainable__impact-item">
            <span>Sell-through</span>
            <span className={changes.sell_through_change_pct > 0 ? 'positive' : 'negative'}>
              {changes.sell_through_change_pct > 0 ? '+' : ''}{changes.sell_through_change_pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyScoreSystem({ simulation }) {
  const { changes, inputs } = simulation;
  
  // Calculate scores
  const revenuePotential = Math.min(100, Math.max(0, 50 + changes.revenue_change_pct * 2));
  const riskLevel = Math.max(0, Math.min(100, 100 - Math.abs(changes.price_change_pct) * 3));
  const competitiveAdvantage = inputs.competitor_reaction === 'passive' ? 85 : 
                              inputs.competitor_reaction === 'neutral' ? 60 : 35;
  const inventoryHealth = Math.min(100, Math.max(0, 50 + changes.sell_through_change_pct * 2));
  const scalability = inputs.ad_spend_multiplier > 1.5 ? 85 : 70;
  
  const scores = [
    { metric: 'Revenue Potential', score: revenuePotential, color: '#10B981' },
    { metric: 'Risk Level', score: riskLevel, color: riskLevel > 70 ? '#10B981' : riskLevel > 40 ? '#F59E0B' : '#EF4444' },
    { metric: 'Competitive Advantage', score: competitiveAdvantage, color: competitiveAdvantage > 70 ? '#10B981' : competitiveAdvantage > 50 ? '#F59E0B' : '#EF4444' },
    { metric: 'Inventory Health', score: inventoryHealth, color: inventoryHealth > 70 ? '#10B981' : inventoryHealth > 50 ? '#F59E0B' : '#EF4444' },
    { metric: 'Scalability', score: scalability, color: '#8B5CF6' },
  ];
  
  return (
    <div className="sim-score-system">
      <h4 className="sim-score-system__title">Strategy Score System</h4>
      <div className="sim-score-grid">
        {scores.map(({ metric, score, color }) => (
          <div key={metric} className="sim-score-item">
            <div className="sim-score-item__header">
              <span className="sim-score-item__metric">{metric}</span>
              <span className="sim-score-item__score" style={{ color }}>{score}</span>
            </div>
            <div className="sim-score-item__bar">
              <div 
                className="sim-score-item__fill" 
                style={{ width: `${score}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIInsightCards({ simulation }) {
  const { changes, inputs } = simulation;
  
  const cards = [];
  
  // Market Risk Card
  if (inputs.competitor_reaction === 'aggressive' && inputs.price_change_pct < -5) {
    cards.push({
      type: 'risk',
      icon: AlertTriangle,
      title: '🚨 Market Risk Detected',
      description: 'Aggressive competitor reaction expected with price reduction. Consider defensive positioning.',
      severity: 'high'
    });
  }
  
  // Revenue Opportunity Card
  if (changes.revenue_change_pct > 10) {
    cards.push({
      type: 'opportunity',
      icon: TrendingUp,
      title: '📈 Revenue Opportunity',
      description: `AI predicts ${changes.revenue_change_pct.toFixed(1)}% revenue lift with current strategy.`,
      severity: 'low'
    });
  }
  
  // Demand Alert Card
  if (inputs.demand_spike > 1.3) {
    cards.push({
      type: 'trend',
      icon: Zap,
      title: '🔥 Demand Spike Expected',
      description: `External demand surge of ${((inputs.demand_spike - 1) * 100).toFixed(0)}% detected. Optimize inventory.`,
      severity: 'medium'
    });
  }
  
  // AI Recommendation Card
  if (Math.abs(inputs.price_change_pct) > 10) {
    cards.push({
      type: 'recommendation',
      icon: Target,
      title: '🧠 AI Recommendation',
      description: inputs.price_change_pct > 0 
        ? 'Consider bundling to justify price increase and maintain volume.'
        : 'Monitor margin erosion with aggressive pricing. Protect brand value.',
      severity: 'medium'
    });
  }
  
  // Default insight if no specific cards
  if (cards.length === 0) {
    cards.push({
      type: 'info',
      icon: Info,
      title: 'ℹ️ Market Stable',
      description: 'Current strategy shows balanced risk/reward profile. Monitor for opportunities.',
      severity: 'low'
    });
  }
  
  return (
    <div className="sim-insight-cards">
      <h4 className="sim-insight-cards__title">AI Insights</h4>
      <div className="sim-insight-cards__grid">
        {cards.map((card, i) => {
          const Icon = card.icon;
          const severityColors = {
            high: '#EF4444',
            medium: '#F59E0B',
            low: '#10B981'
          };
          
          return (
            <div key={i} className={`sim-insight-card sim-insight-card--${card.type}`}>
              <div className="sim-insight-card__header">
                <Icon size={16} className="sim-insight-card__icon" />
                <span className="sim-insight-card__title">{card.title}</span>
              </div>
              <div className="sim-insight-card__description">{card.description}</div>
              <div className="sim-insight-card__severity" style={{ color: severityColors[card.severity] }}>
                {card.severity.toUpperCase()} PRIORITY
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ScenarioSimulator() {
  const { activeProduct } = useProduct();
  const productId = activeProduct?.id || activeProduct?.product_id;

  const [inputs, setInputs] = useState({
    price_change_pct: 0,
    ad_spend_multiplier: 1.0,
    inventory_quantity: 300,
    competitor_reaction: 'neutral',
    demand_spike: 1.0,
  });

  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSimulation = useCallback(async () => {
    if (!productId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await API.post(`/api/scenario-simulator/${productId}`, inputs);
      setSimulation(res.data);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to run simulation');
    } finally {
      setLoading(false);
    }
  }, [productId, inputs]);

  // Auto-run simulation on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [inputs, runSimulation]);

  const resetInputs = () => {
    setInputs({
      price_change_pct: 0,
      ad_spend_multiplier: 1.0,
      inventory_quantity: 300,
      competitor_reaction: 'neutral',
      demand_spike: 1.0,
    });
  };

  return (
    <div className="sim-page">
      {/* Header */}
      <div className="sim-header">
        <div>
          <div className="sim-header__eyebrow">
            <Sliders size={14} /> Scenario Simulator
          </div>
          <h1 className="sim-header__title">What-If Analysis</h1>
          <p className="sim-header__sub">
            Adjust sliders to simulate different pricing and market scenarios. See real-time impact on revenue, margin, and sell-through.
          </p>
        </div>
        <button className="sim-reset" onClick={resetInputs}>
          <RefreshCw size={14} /> Reset
        </button>
      </div>

      {/* Controls */}
      <div className="sim-controls">
        <h3 className="sim-section-title">Simulation Parameters</h3>
        
        <div className="sim-controls-grid">
          <SliderControl
            label="Price Change"
            value={inputs.price_change_pct}
            onChange={(v) => setInputs(prev => ({ ...prev, price_change_pct: v }))}
            min={-20}
            max={20}
            step={0.5}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
            icon={DollarSign}
            description="Adjust product price to see impact on demand and revenue"
          />
          
          <SliderControl
            label="Ad Spend Multiplier"
            value={inputs.ad_spend_multiplier}
            onChange={(v) => setInputs(prev => ({ ...prev, ad_spend_multiplier: v }))}
            min={0.5}
            max={3}
            step={0.1}
            format={(v) => `${v.toFixed(1)}x`}
            icon={Zap}
            description="Increase or decrease advertising spend to boost demand"
          />
          
          <SliderControl
            label="Inventory Quantity"
            value={inputs.inventory_quantity}
            onChange={(v) => setInputs(prev => ({ ...prev, inventory_quantity: v }))}
            min={100}
            max={1000}
            step={50}
            format={formatNumber}
            icon={Package}
            description="Available stock for the simulation period"
          />
          
          <SelectControl
            label="Competitor Reaction"
            value={inputs.competitor_reaction}
            onChange={(v) => setInputs(prev => ({ ...prev, competitor_reaction: v }))}
            options={[
              { value: 'aggressive', label: 'Aggressive - Match/undercut pricing' },
              { value: 'neutral', label: 'Neutral - Standard response' },
              { value: 'passive', label: 'Passive - No reaction' },
            ]}
            icon={Target}
          />
          
          <SliderControl
            label="Demand Spike"
            value={inputs.demand_spike}
            onChange={(v) => setInputs(prev => ({ ...prev, demand_spike: v }))}
            min={0.5}
            max={2}
            step={0.1}
            format={(v) => `${v.toFixed(1)}x`}
            icon={TrendingUp}
            description="External demand factors (seasonality, trends, events)"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="sim-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && !simulation && (
        <div className="sim-loading">
          <RefreshCw size={20} className="animate-spin" />
          Running simulation...
        </div>
      )}

      {/* Results */}
      {simulation && (
        <>
          {/* Metrics Comparison */}
          <div className="sim-metrics">
            <h3 className="sim-section-title">Impact Analysis</h3>
            <div className="sim-metrics-grid">
              <MetricCard
                label="Revenue"
                before={simulation.before.revenue}
                after={simulation.after.revenue}
                change={simulation.changes.revenue_change_pct * simulation.before.revenue / 100}
              />
              <MetricCard
                label="Margin"
                before={simulation.before.margin_pct}
                after={simulation.after.margin_pct}
                change={simulation.changes.margin_change_pct * simulation.before.margin_pct / 100}
                format={formatPercent}
              />
              <MetricCard
                label="Sell-through"
                before={simulation.before.sell_through_pct}
                after={simulation.after.sell_through_pct}
                change={simulation.changes.sell_through_change_pct * simulation.before.sell_through_pct / 100}
                format={formatPercent}
              />
              <MetricCard
                label="Market Share"
                before={simulation.before.market_share}
                after={simulation.after.market_share}
                change={simulation.changes.market_share_change_pct * simulation.before.market_share / 100}
                format={formatPercent}
              />
            </div>
          </div>

          {/* Explainable AI */}
          <div className="sim-explainable-section">
            <ExplainableAI simulation={simulation} />
          </div>

          {/* Strategy Score System */}
          <div className="sim-score-section">
            <StrategyScoreSystem simulation={simulation} />
          </div>

          {/* AI Insight Cards */}
          <div className="sim-insights-section">
            <AIInsightCards simulation={simulation} />
          </div>
        </>
      )}
    </div>
  );
}
