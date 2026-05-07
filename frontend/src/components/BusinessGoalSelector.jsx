import React, { useState } from 'react';
import { ChevronRight, Target, TrendingUp, Shield, Zap, Award, Package, Lightbulb } from 'lucide-react';
import './BusinessGoalSelector.css';

/**
 * BusinessGoalSelector Modal
 * 
 * First screen of AI Strategy Builder.
 * Users select their primary business objective, which influences all AI recommendations.
 */

const BUSINESS_GOALS = [
  {
    id: 'maximize_profit',
    icon: TrendingUp,
    title: 'Maximize Profit',
    subtitle: 'Focus on margin over volume',
    description: 'Increase gross margin through optimized pricing and efficient cost management.',
    color: '#22C55E',
  },
  {
    id: 'increase_revenue',
    icon: Award,
    title: 'Increase Revenue',
    subtitle: 'Grow top-line sales',
    description: 'Drive total sales value through volume and strategic pricing.',
    color: '#3B82F6',
  },
  {
    id: 'maximize_market_share',
    icon: Target,
    title: 'Maximize Market Share',
    subtitle: 'Aggressive growth strategy',
    description: 'Capture market territory through competitive pricing and volume.',
    color: '#F59E0B',
  },
  {
    id: 'clear_inventory',
    icon: Package,
    title: 'Clear Inventory',
    subtitle: 'Reduce excess stock',
    description: 'Move aged inventory quickly through aggressive clearance pricing.',
    color: '#EF4444',
  },
  {
    id: 'launch_product',
    icon: Lightbulb,
    title: 'Launch Product',
    subtitle: 'Market entry strategy',
    description: 'Establish market position for new products with optimal entry pricing.',
    color: '#8B5CF6',
  },
  {
    id: 'beat_competitors',
    icon: Zap,
    title: 'Beat Competitors',
    subtitle: 'Competitive dominance',
    description: 'Win market share from competitors through strategic positioning.',
    color: '#EC4899',
  },
  {
    id: 'premium_positioning',
    icon: Shield,
    title: 'Premium Positioning',
    subtitle: 'Luxury market strategy',
    description: 'Establish premium brand perception through strategic pricing.',
    color: '#14B8A6',
  },
  {
    id: 'seasonal_optimization',
    icon: TrendingUp,
    title: 'Seasonal Optimization',
    subtitle: 'Maximize seasonal demand',
    description: 'Optimize pricing for seasonal peaks and troughs.',
    color: '#06B6D4',
  },
];

export default function BusinessGoalSelector({ 
  onSelect, 
  isOpen = true,
  activeProduct 
}) {
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSelect = (goalId) => {
    setSelectedGoal(goalId);
    if (onSelect) {
      onSelect(goalId);
    }
    // Auto-collapse after selection
    setTimeout(() => setIsExpanded(false), 300);
  };

  if (!isOpen) return null;

  const selectedGoalObj = BUSINESS_GOALS.find(g => g.id === selectedGoal);

  return (
    <div className="goal-selector-overlay">
      <div className="goal-selector-modal">
        {/* Header */}
        <div className="goal-selector-header">
          <div>
            <h2>What's Your Priority?</h2>
            <p>
              Select your primary business objective. 
              AI will tailor all recommendations to this goal.
            </p>
          </div>
          {selectedGoalObj && (
            <div className="goal-badge" style={{ background: selectedGoalObj.color }}>
              {selectedGoalObj.title}
            </div>
          )}
        </div>

        {/* Goals Grid */}
        <div className={`goals-grid ${isExpanded ? 'expanded' : ''}`}>
          {BUSINESS_GOALS.map((goal) => {
            const Icon = goal.icon;
            const isSelected = selectedGoal === goal.id;
            return (
              <button
                key={goal.id}
                className={`goal-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(goal.id)}
                style={{
                  borderColor: isSelected ? goal.color : 'rgba(255,255,255,0.1)',
                  background: isSelected ? `${goal.color}08` : 'transparent',
                }}
              >
                <div className="goal-card-icon" style={{ color: goal.color }}>
                  <Icon size={24} />
                </div>
                <div className="goal-card-content">
                  <h3>{goal.title}</h3>
                  <p>{goal.subtitle}</p>
                </div>
                {isSelected && (
                  <div className="goal-card-check" style={{ color: goal.color }}>
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Goal Details */}
        {selectedGoalObj && (
          <div className="goal-details">
            <h4>About this goal</h4>
            <p>{selectedGoalObj.description}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="goal-selector-footer">
          {selectedGoal ? (
            <button 
              className="btn btn-primary"
              onClick={() => {
                setIsExpanded(true);
              }}
            >
              Continue with {selectedGoalObj?.title}
              <ChevronRight size={18} />
            </button>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              ← Select a goal to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
