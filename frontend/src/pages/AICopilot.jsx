import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot, Send, Target, TrendingUp, AlertTriangle, BarChart3, Lightbulb,
  RefreshCw, Zap, Crown, Tag, Heart, Package, DollarSign,
} from 'lucide-react';

import API from '../api/client';
import { useProduct } from '../context/ProductContext';

// ─────────────────────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  { value: 'maximize_profit', label: 'Maximize Profit', desc: 'Increase margins while protecting volume' },
  { value: 'increase_revenue', label: 'Increase Revenue', desc: 'Grow top-line sales and market share' },
  { value: 'maximize_market_share', label: 'Maximize Market Share', desc: 'Aggressive growth and customer acquisition' },
  { value: 'optimize_inventory', label: 'Optimize Inventory', desc: 'Balance stock levels and minimize holding costs' },
];

const AGENT_ICONS = {
  'Pricing Agent': Crown,
  'Competitor Agent': Target,
  'Inventory Agent': Package,
  'Marketing Agent': Tag,
  'Trend Agent': TrendingUp,
  'Revenue Agent': DollarSign,
};

const INSIGHT_ICONS = {
  market_risk: AlertTriangle,
  revenue_opportunity: TrendingUp,
  trend_alert: Zap,
  ai_recommendation: Lightbulb,
  info: BarChart3,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function InsightCard({ card }) {
  const Icon = INSIGHT_ICONS[card.type] || BarChart3;
  const severityColor = {
    CRITICAL: '#EF4444',
    WARNING: '#F59E0B',
    INFO: '#3B82F6',
  }[card.severity] || '#6B7280';

  return (
    <div className="ai-insight-card">
      <div className="ai-insight-card__header">
        <Icon size={16} className="ai-insight-card__icon" />
        <span className="ai-insight-card__title">{card.title}</span>
        {card.impact_pct != null && (
          <span className={`ai-insight-card__impact ai-insight-card__impact--${card.impact_pct > 0 ? 'positive' : 'negative'}`}>
            {card.impact_pct > 0 ? '+' : ''}{card.impact_pct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="ai-insight-card__desc">{card.description}</div>
    </div>
  );
}

function AgentBadge({ agent }) {
  const Icon = AGENT_ICONS[agent] || Bot;
  return (
    <div className="ai-agent-badge">
      <Icon size={14} className="ai-agent-badge__icon" />
      <span>{agent}</span>
    </div>
  );
}

function StrategyResponse({ data }) {
  return (
    <div className="ai-strategy-response">
      {/* Narrative */}
      <div className="ai-strategy__narrative">
        <div className="ai-strategy__narrative-text">
          {data.strategic_narrative.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      <div className="ai-strategy__insights">
        <h4 className="ai-strategy__section-title">Key Insights</h4>
        <div className="ai-insights-grid">
          {data.key_insights.map((insight, i) => (
            <div key={i} className="ai-insight-item">
              <div className="ai-insight-item__text">{insight}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Action */}
      <div className="ai-strategy__action">
        <h4 className="ai-strategy__section-title">Recommended Action</h4>
        <div className="ai-action-card">
          <div className="ai-action-card__text">{data.recommended_action}</div>
          <div className="ai-action-card__meta">
            <span className="ai-action-card__confidence">
              Confidence: {data.confidence_score.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Expected Impact */}
      <div className="ai-strategy__impact">
        <h4 className="ai-strategy__section-title">Expected Impact</h4>
        <div className="ai-impact-grid">
          <div className="ai-impact-item">
            <div className="ai-impact-item__label">Revenue Impact</div>
            <div className={`ai-impact-item__value ${data.expected_impact.revenue_impact_pct > 0 ? 'positive' : 'negative'}`}>
              {data.expected_impact.revenue_impact_pct > 0 ? '+' : ''}{data.expected_impact.revenue_impact_pct.toFixed(1)}%
            </div>
          </div>
          <div className="ai-impact-item">
            <div className="ai-impact-item__label">Margin Impact</div>
            <div className={`ai-impact-item__value ${data.expected_impact.margin_impact_pct > 0 ? 'positive' : 'negative'}`}>
              {data.expected_impact.margin_impact_pct > 0 ? '+' : ''}{data.expected_impact.margin_impact_pct.toFixed(1)}%
            </div>
          </div>
          <div className="ai-impact-item">
            <div className="ai-impact-item__label">Volume Projection</div>
            <div className="ai-impact-item__value">{data.expected_impact.volume_projection.toLocaleString()} units</div>
          </div>
          <div className="ai-impact-item">
            <div className="ai-impact-item__label">Timeframe</div>
            <div className="ai-impact-item__value">{data.expected_impact.timeframe}</div>
          </div>
        </div>
      </div>

      {/* Agent Breakdown */}
      <div className="ai-strategy__agents">
        <h4 className="ai-strategy__section-title">Multi-Agent Analysis</h4>
        <div className="ai-agents-grid">
          {Object.entries(data.reasoning_breakdown).map(([agent, reasoning]) => (
            <div key={agent} className="ai-agent-card">
              <AgentBadge agent={agent} />
              <div className="ai-agent-card__reasoning">{reasoning}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="ai-strategy__next-steps">
        <h4 className="ai-strategy__section-title">Next Steps</h4>
        <ul className="ai-next-steps">
          {data.next_steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AICopilot() {
  const { activeProduct } = useProduct();
  const productId = activeProduct?.id || activeProduct?.product_id;

  const [goalType, setGoalType] = useState('maximize_profit');
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState(null);
  const [insights, setInsights] = useState([]);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [strategy, insights]);

  const loadInsights = useCallback(async () => {
    if (!productId) return;
    try {
      const res = await API.get(`/api/copilot/insights/${productId}`);
      setInsights(res.data.cards || []);
    } catch (e) {
      console.error('Failed to load insights:', e);
    }
  }, [productId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const generateStrategy = useCallback(async () => {
    if (!productId || !objective.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await API.get(`/api/copilot/strategy/${productId}`, {
        params: {
          goal_type: goalType,
          objective: objective.trim(),
        },
      });
      setStrategy(res.data);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to generate strategy');
    } finally {
      setLoading(false);
    }
  }, [productId, goalType, objective]);

  const handleSubmit = (e) => {
    e.preventDefault();
    generateStrategy();
  };

  const reset = () => {
    setStrategy(null);
    setError(null);
    setObjective('');
  };

  return (
    <div className="ai-copilot-page">
      {/* Header */}
      <div className="ai-header">
        <div>
          <div className="ai-header__eyebrow">
            <Bot size={14} /> AI Strategy Generator
          </div>
          <h1 className="ai-header__title">Multi-Agent Strategic Reasoning Engine</h1>
          <p className="ai-header__sub">
            Get executive-level strategic recommendations powered by 6 specialized AI agents analyzing pricing, competition, inventory, marketing, trends, and revenue.
          </p>
        </div>
        <button className="ai-refresh" onClick={loadInsights}>
          <RefreshCw size={14} /> Refresh Insights
        </button>
      </div>

      {/* Insight Cards */}
      {insights.length > 0 && (
        <div className="ai-insights-section">
          <h3 className="ai-section-title">Market Intelligence</h3>
          <div className="ai-insights-grid">
            {insights.map((card, i) => (
              <InsightCard key={i} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* Strategy Generator */}
      <div className="ai-generator-section">
        <h3 className="ai-section-title">Generate Strategy</h3>
        
        <form className="ai-generator-form" onSubmit={handleSubmit}>
          {/* Goal Selection */}
          <div className="ai-form-group">
            <label className="ai-form-label">Business Goal</label>
            <div className="ai-goal-options">
              {GOAL_OPTIONS.map((goal) => (
                <label key={goal.value} className="ai-goal-option">
                  <input
                    type="radio"
                    name="goal"
                    value={goal.value}
                    checked={goalType === goal.value}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="ai-goal-radio"
                  />
                  <div className="ai-goal-content">
                    <div className="ai-goal-title">{goal.label}</div>
                    <div className="ai-goal-desc">{goal.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Objective Input */}
          <div className="ai-form-group">
            <label className="ai-form-label">Strategic Objective</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Describe your specific objective in natural language..."
              className="ai-objective-textarea"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="ai-form-actions">
            <button
              type="submit"
              className="ai-generate-btn"
              disabled={loading || !objective.trim() || !productId}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Generating Strategy...
                </>
              ) : (
                <>
                  <Bot size={16} />
                  Generate AI Strategy
                </>
              )}
            </button>
            {strategy && (
              <button type="button" className="ai-reset-btn" onClick={reset}>
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="ai-error">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Strategy Response */}
        {strategy && (
          <div className="ai-strategy-section">
            <StrategyResponse data={strategy} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
