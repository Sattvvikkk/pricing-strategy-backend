import React, { useMemo } from 'react';
import { TrendingUp, Shield, Zap, Target } from 'lucide-react';
import './StrategyScore.css';

/**
 * StrategyScore Component
 * 
 * Displays holistic strategy evaluation:
 * - Revenue Potential (0-100)
 * - Risk Level (Low/Medium/High)
 * - Competitive Advantage (Low/Medium/High)
 * - Scalability (Low/Medium/High)
 * - Overall Score with recommendation
 */

export default function StrategyScore({ strategy }) {
  const scores = useMemo(() => {
    // Revenue Potential (0-100)
    const revenueImpact = strategy?.expected_outcome?.revenue_impact_pct || 0;
    const revenuePotential = Math.min(100, Math.max(0, 50 + revenueImpact * 2));

    // Risk Level (calculated from risk flags and confidence)
    const riskFlagCount = strategy?.risk_flags?.length || 0;
    const criticalRisks = strategy?.risk_flags?.filter(f => f.severity === 'CRITICAL')?.length || 0;
    const confidence = strategy?.confidence || 75;
    
    let riskLevel = 'low';
    let riskScore = 80;
    if (criticalRisks > 0) {
      riskLevel = 'high';
      riskScore = 40;
    } else if (riskFlagCount > 2) {
      riskLevel = 'medium';
      riskScore = 60;
    } else if (confidence < 60) {
      riskLevel = 'medium';
      riskScore = 60;
    }

    // Competitive Advantage
    const archetype = strategy?.archetype || 'HOLD';
    const elasticity = Math.abs(strategy?.elasticity || 0);
    const competitorStats = strategy?.competitor_stats || {};
    const currentPrice = strategy?.current_price || 0;
    const recommendedPrice = strategy?.recommended_price || 0;
    const priceVsMarket = currentPrice > 0 ? 
      Math.abs((recommendedPrice - (competitorStats.avg_price || currentPrice)) / (competitorStats.avg_price || currentPrice)) : 0;

    let competitiveAdvantage = 'medium';
    let competitiveScore = 60;
    
    // Premium archetypes have good advantage
    if (archetype === 'PREMIUM' || archetype === 'SKIM') {
      competitiveAdvantage = 'high';
      competitiveScore = 85;
    }
    // Penetration and aggressive strategies
    else if (archetype === 'PENETRATION' && priceVsMarket > 0.15) {
      competitiveAdvantage = 'high';
      competitiveScore = 80;
    }
    // Clearance has tactical advantage
    else if (archetype === 'CLEARANCE') {
      competitiveAdvantage = 'medium';
      competitiveScore = 65;
    }
    // Low elasticity gives pricing power
    else if (elasticity < 0.8) {
      competitiveAdvantage = 'high';
      competitiveScore = 75;
    }
    // High elasticity means price-sensitive market
    else if (elasticity > 1.8) {
      competitiveAdvantage = 'low';
      competitiveScore = 45;
    }

    // Scalability
    const expectedUnits = strategy?.expected_outcome?.units_30d || 0;
    const margin = strategy?.expected_outcome?.margin_30d || 18;
    
    let scalability = 'medium';
    let scalabilityScore = 60;
    
    if (margin > 25 && archetype === 'PREMIUM') {
      scalability = 'high';
      scalabilityScore = 85;
    } else if (margin > 20 && expectedUnits > 500) {
      scalability = 'high';
      scalabilityScore = 80;
    } else if (margin < 12 || expectedUnits < 200) {
      scalability = 'low';
      scalabilityScore = 40;
    } else if (archetype === 'PENETRATION' && expectedUnits > 600) {
      scalability = 'high';
      scalabilityScore = 78;
    }

    // Overall Score
    const overallScore = Math.round(
      (revenuePotential * 0.35 + riskScore * 0.25 + competitiveScore * 0.25 + scalabilityScore * 0.15)
    );

    // Recommendation
    let recommendation = 'Proceed with caution';
    let recommendationColor = '#F59E0B';
    
    if (overallScore >= 75) {
      recommendation = 'Highly recommended';
      recommendationColor = '#22C55E';
    } else if (overallScore >= 60) {
      recommendation = 'Good strategy';
      recommendationColor = '#3B82F6';
    } else if (overallScore >= 40) {
      recommendation = 'Moderate opportunity';
      recommendationColor = '#F59E0B';
    } else {
      recommendation = 'High risk';
      recommendationColor = '#EF4444';
    }

    return {
      revenuePotential: Math.round(revenuePotential),
      riskLevel,
      riskScore,
      competitiveAdvantage,
      competitiveScore,
      scalability,
      scalabilityScore,
      overallScore,
      recommendation,
      recommendationColor,
    };
  }, [strategy]);

  const ScoreGauge = ({ value, max = 100, size = 'medium' }) => {
    const percentage = (value / max) * 100;
    const color = percentage >= 70 ? '#22C55E' : percentage >= 50 ? '#3B82F6' : percentage >= 30 ? '#F59E0B' : '#EF4444';
    
    return (
      <div className={`gauge gauge-${size}`}>
        <svg viewBox="0 0 120 120" className="gauge-svg">
          {/* Background circle */}
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${(percentage / 100) * 314.159} 314.159`}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px', transition: 'stroke-dasharray 0.6s ease' }}
          />
          {/* Center text */}
          <text x="60" y="60" textAnchor="middle" dy="0.3em" className="gauge-text">
            {value}
          </text>
        </svg>
      </div>
    );
  };

  const LevelBadge = ({ level, score }) => {
    let bgColor = '#EF4444';
    let textColor = '#FCA5A5';
    
    if (level === 'high') {
      bgColor = '#22C55E';
      textColor = '#86EFAC';
    } else if (level === 'medium') {
      bgColor = '#F59E0B';
      textColor = '#FCD34D';
    }

    return (
      <div className="level-badge" style={{ backgroundColor: `${bgColor}20`, borderColor: bgColor }}>
        <span style={{ color: bgColor, fontWeight: 700 }}>
          {level.toUpperCase()}
        </span>
        <div className="level-indicator" style={{ backgroundColor: bgColor }} />
      </div>
    );
  };

  return (
    <div className="strategy-score">
      {/* Header with Overall Score */}
      <div className="score-header">
        <div className="overall-score-section">
          <h3>Strategy Score</h3>
          <div className="overall-score">
            <ScoreGauge value={scores.overallScore} size="large" />
            <div className="overall-info">
              <p className="overall-label">Overall Score</p>
              <p className="overall-recommendation" style={{ color: scores.recommendationColor }}>
                {scores.recommendation}
              </p>
              <p className="overall-hint">
                {scores.overallScore >= 75 && '✅ This strategy is well-positioned for success.'}
                {scores.overallScore >= 60 && scores.overallScore < 75 && '🟢 Strong fundamentals with manageable risks.'}
                {scores.overallScore >= 40 && scores.overallScore < 60 && '🟡 Mixed signals - review carefully.'}
                {scores.overallScore < 40 && '⚠️ Significant risks need mitigation.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Four Score Cards */}
      <div className="score-cards">
        {/* Revenue Potential */}
        <div className="score-card revenue-card">
          <div className="card-header">
            <TrendingUp size={18} style={{ color: '#3B82F6' }} />
            <h4>Revenue Potential</h4>
          </div>
          <div className="card-content">
            <ScoreGauge value={scores.revenuePotential} />
            <div className="card-details">
              <p className="card-label">30-day impact</p>
              <p className="card-value">
                {strategy?.expected_outcome?.revenue_impact_pct > 0 ? '+' : ''}
                {strategy?.expected_outcome?.revenue_impact_pct?.toFixed(1)}%
              </p>
              <p className="card-hint">
                {scores.revenuePotential >= 70 && '💰 Strong revenue generation'}
                {scores.revenuePotential >= 50 && scores.revenuePotential < 70 && '📈 Solid revenue growth'}
                {scores.revenuePotential < 50 && '📉 Limited revenue impact'}
              </p>
            </div>
          </div>
        </div>

        {/* Risk Level */}
        <div className="score-card risk-card">
          <div className="card-header">
            <Shield size={18} style={{ color: '#EC4899' }} />
            <h4>Risk Level</h4>
          </div>
          <div className="card-content">
            <LevelBadge level={scores.riskLevel} score={scores.riskScore} />
            <div className="card-details">
              <p className="card-label">Risk assessment</p>
              <p className="card-value">{scores.riskScore}/100</p>
              {strategy?.risk_flags && strategy.risk_flags.length > 0 && (
                <div className="risk-flags">
                  {strategy.risk_flags.slice(0, 2).map((flag, idx) => (
                    <div key={idx} className="risk-flag-item" style={{
                      borderLeft: `3px solid ${flag.severity === 'CRITICAL' ? '#EF4444' : flag.severity === 'WARNING' ? '#F59E0B' : '#3B82F6'}`
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                        {flag.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Competitive Advantage */}
        <div className="score-card competitive-card">
          <div className="card-header">
            <Zap size={18} style={{ color: '#F59E0B' }} />
            <h4>Competitive Advantage</h4>
          </div>
          <div className="card-content">
            <LevelBadge level={scores.competitiveAdvantage} score={scores.competitiveScore} />
            <div className="card-details">
              <p className="card-label">Market position</p>
              <p className="card-value">{scores.competitiveScore}/100</p>
              <p className="card-hint">
                {strategy?.archetype === 'PREMIUM' && '👑 Premium positioning'}
                {strategy?.archetype === 'PENETRATION' && '🎯 Market share focused'}
                {strategy?.archetype === 'CLEARANCE' && '⚡ Tactical advantage'}
                {strategy?.archetype === 'COMPETITIVE_MATCH' && '🔄 Balanced approach'}
              </p>
            </div>
          </div>
        </div>

        {/* Scalability */}
        <div className="score-card scalability-card">
          <div className="card-header">
            <Target size={18} style={{ color: '#22C55E' }} />
            <h4>Scalability</h4>
          </div>
          <div className="card-content">
            <LevelBadge level={scores.scalability} score={scores.scalabilityScore} />
            <div className="card-details">
              <p className="card-label">Growth potential</p>
              <p className="card-value">{scores.scalabilityScore}/100</p>
              <p className="card-hint">
                {scores.scalability === 'high' && '🚀 High growth potential'}
                {scores.scalability === 'medium' && '📊 Moderate growth outlook'}
                {scores.scalability === 'low' && '⚠️ Limited scalability'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom insights */}
      <div className="score-insights">
        <div className="insight">
          <span className="insight-label">Confidence:</span>
          <span className="insight-value">{strategy?.confidence || 75}%</span>
        </div>
        <div className="insight">
          <span className="insight-label">Strategy Type:</span>
          <span className="insight-value">{strategy?.archetype?.replace('_', ' ') || 'HOLD'}</span>
        </div>
        <div className="insight">
          <span className="insight-label">Price Elasticity:</span>
          <span className="insight-value">{strategy?.elasticity?.toFixed(2) || '—'}</span>
        </div>
        <div className="insight">
          <span className="insight-label">Recommended Action:</span>
          <span className="insight-value" style={{
            color: scores.overallScore >= 70 ? '#22C55E' : scores.overallScore >= 50 ? '#3B82F6' : '#F59E0B'
          }}>
            {scores.overallScore >= 70 ? 'Execute' : scores.overallScore >= 50 ? 'Review & Refine' : 'Assess Alternatives'}
          </span>
        </div>
      </div>
    </div>
  );
}
