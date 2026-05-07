import React, { useState, useMemo } from 'react';
import { Sliders, TrendingUp, BarChart3, Target, AlertCircle } from 'lucide-react';
import './ScenarioSimulator.css';

/**
 * ScenarioSimulator Component
 * 
 * Interactive "what-if" scenario modeling.
 * Users adjust sliders to simulate strategy impact on:
 * - Revenue
 * - Margin
 * - Sell-through rate
 * - Competitive position
 */

export default function ScenarioSimulator({ strategy, onScenarioChange }) {
  // Baseline (current strategy)
  const baseline = {
    price: strategy?.current_price || 1000,
    expectedRevenue: strategy?.expected_outcome?.revenue_30d || 100000,
    expectedMargin: strategy?.expected_outcome?.margin_30d || 18,
    expectedUnits: strategy?.expected_outcome?.units_30d || 500,
    elasticity: strategy?.elasticity || -1.2,
    compAvgPrice: strategy?.competitor_stats?.avg_price || 1000,
  };

  // Scenario adjustments
  const [priceChange, setPriceChange] = useState(0);
  const [adSpendMultiplier, setAdSpendMultiplier] = useState(1.0);
  const [demandSpike, setDemandSpike] = useState(0);
  const [inventoryAdjustment, setInventoryAdjustment] = useState(0);

  // Calculate simulated outcomes
  const scenario = useMemo(() => {
    // New price
    const newPrice = baseline.price * (1 + priceChange / 100);
    const priceChangeAbsolute = newPrice - baseline.price;

    // Demand impact from price elasticity
    const demandMultiplier = 1 + (priceChange / 100) * baseline.elasticity + demandSpike / 100;
    const demandAdjustment = Math.max(0.1, demandMultiplier); // Don't go below 10% of baseline

    // Units sold
    const newUnits = baseline.expectedUnits * demandAdjustment;

    // Revenue (price × units)
    const newRevenue = newPrice * newUnits;
    const revenueChange = ((newRevenue - baseline.expectedRevenue) / baseline.expectedRevenue) * 100;

    // Margin (impacted by discounting and ad spend)
    const marginImpact = (priceChange * 0.3) - (adSpendMultiplier - 1) * 5; // Ad spend reduces margin
    const newMargin = baseline.expectedMargin + marginImpact;

    // Sell-through rate (units / available inventory)
    const availableInventory = 1000 * (1 + inventoryAdjustment / 100);
    const sellThrough = (newUnits / availableInventory) * 100;

    // Competitive position
    const priceVsMarket = ((newPrice - baseline.compAvgPrice) / baseline.compAvgPrice) * 100;
    const competitivePosition = priceVsMarket < -10 ? 'aggressive' : 
                                priceVsMarket > 10 ? 'premium' : 
                                'competitive';

    return {
      newPrice,
      priceChangeAbsolute,
      newRevenue,
      revenueChange,
      newMargin: Math.max(5, newMargin), // Min 5% margin
      marginChange: newMargin - baseline.expectedMargin,
      newUnits: Math.round(newUnits),
      unitsChange: ((newUnits - baseline.expectedUnits) / baseline.expectedUnits) * 100,
      sellThrough: Math.min(100, sellThrough),
      competitivePosition,
      priceVsMarket,
      demandAdjustment,
    };
  }, [priceChange, adSpendMultiplier, demandSpike, inventoryAdjustment, baseline]);

  // Determine card colors based on impact
  const getImpactColor = (value) => {
    if (value > 5) return '#22C55E'; // green - positive
    if (value < -5) return '#EF4444'; // red - negative
    return '#F59E0B'; // orange - neutral
  };

  const getIndicatorColor = (change) => {
    if (change > 0) return '#22C55E';
    if (change < 0) return '#EF4444';
    return '#8B5CF6';
  };

  const formatCurrency = (val) => `₹${Math.round(val).toLocaleString('en-IN')}`;
  const formatPercent = (val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;

  return (
    <div className="scenario-simulator">
      <div className="simulator-header">
        <div className="simulator-title">
          <Sliders size={20} style={{ color: '#3B82F6' }} />
          <div>
            <h3>Scenario Simulator</h3>
            <p>Adjust variables to forecast strategy impact</p>
          </div>
        </div>
      </div>

      <div className="simulator-container">
        {/* Left: Sliders */}
        <div className="sliders-panel">
          <div className="slider-group">
            <div className="slider-header">
              <label>Price Adjustment</label>
              <span className="slider-value">
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="30"
              step="1"
              value={priceChange}
              onChange={(e) => setPriceChange(Number(e.target.value))}
              className="slider"
              style={{
                background: `linear-gradient(to right, #EF4444 0%, #EF4444 ${((priceChange + 30) / 60) * 100}%, #22C55E ${((priceChange + 30) / 60) * 100}%, #22C55E 100%)`
              }}
            />
            <div className="slider-labels">
              <span>-30%</span>
              <span>0%</span>
              <span>+30%</span>
            </div>
            <p className="slider-hint">Impact: demand {scenario.demandAdjustment > 1 ? 'increases' : 'decreases'} by {Math.abs((scenario.demandAdjustment - 1) * 100).toFixed(0)}%</p>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <label>Ad Spend Multiplier</label>
              <span className="slider-value">{adSpendMultiplier.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={adSpendMultiplier}
              onChange={(e) => setAdSpendMultiplier(Number(e.target.value))}
              className="slider"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((adSpendMultiplier - 0.5) / 2.5) * 100}%, #8B5CF6 ${((adSpendMultiplier - 0.5) / 2.5) * 100}%, #8B5CF6 100%)`
              }}
            />
            <div className="slider-labels">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>3.0x</span>
            </div>
            <p className="slider-hint">Higher spend drives volume but reduces margin</p>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <label>Demand Spike</label>
              <span className="slider-value">
                {demandSpike > 0 ? '+' : ''}{demandSpike.toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="50"
              step="1"
              value={demandSpike}
              onChange={(e) => setDemandSpike(Number(e.target.value))}
              className="slider"
              style={{
                background: `linear-gradient(to right, #EF4444 0%, #EF4444 ${((demandSpike + 20) / 70) * 100}%, #22C55E ${((demandSpike + 20) / 70) * 100}%, #22C55E 100%)`
              }}
            />
            <div className="slider-labels">
              <span>-20%</span>
              <span>0%</span>
              <span>+50%</span>
            </div>
            <p className="slider-hint">Market trend or seasonal spike</p>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <label>Inventory Adjustment</label>
              <span className="slider-value">
                {inventoryAdjustment > 0 ? '+' : ''}{inventoryAdjustment.toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              value={inventoryAdjustment}
              onChange={(e) => setInventoryAdjustment(Number(e.target.value))}
              className="slider"
              style={{
                background: `linear-gradient(to right, #EF4444 0%, #EF4444 ${((inventoryAdjustment + 50) / 100) * 100}%, #22C55E ${((inventoryAdjustment + 50) / 100) * 100}%, #22C55E 100%)`
              }}
            />
            <div className="slider-labels">
              <span>-50%</span>
              <span>0%</span>
              <span>+50%</span>
            </div>
            <p className="slider-hint">Available stock for sell-through</p>
          </div>

          <button 
            className="reset-btn"
            onClick={() => {
              setPriceChange(0);
              setAdSpendMultiplier(1.0);
              setDemandSpike(0);
              setInventoryAdjustment(0);
            }}
          >
            Reset to Baseline
          </button>
        </div>

        {/* Right: Impact Cards */}
        <div className="impact-panel">
          <div className="impact-card revenue-card">
            <div className="impact-header">
              <TrendingUp size={20} style={{ color: '#3B82F6' }} />
              <h4>Revenue (30-day)</h4>
            </div>
            <div className="impact-main">
              <div className="impact-value">
                {formatCurrency(scenario.newRevenue)}
              </div>
              <div className="impact-change" style={{ color: getIndicatorColor(scenario.revenueChange) }}>
                {scenario.revenueChange > 0 ? '📈' : scenario.revenueChange < 0 ? '📉' : '➡️'}
                {formatPercent(scenario.revenueChange)}
              </div>
            </div>
            <div className="impact-baseline">
              vs baseline {formatCurrency(baseline.expectedRevenue)}
            </div>
          </div>

          <div className="impact-card margin-card">
            <div className="impact-header">
              <BarChart3 size={20} style={{ color: '#22C55E' }} />
              <h4>Gross Margin</h4>
            </div>
            <div className="impact-main">
              <div className="impact-value">
                {scenario.newMargin.toFixed(1)}%
              </div>
              <div className="impact-change" style={{ color: getIndicatorColor(scenario.marginChange) }}>
                {scenario.marginChange > 0 ? '📈' : scenario.marginChange < 0 ? '📉' : '➡️'}
                {formatPercent(scenario.marginChange)}
              </div>
            </div>
            <div className="impact-baseline">
              vs baseline {baseline.expectedMargin.toFixed(1)}%
            </div>
          </div>

          <div className="impact-card volume-card">
            <div className="impact-header">
              <Target size={20} style={{ color: '#F59E0B' }} />
              <h4>Volume (units)</h4>
            </div>
            <div className="impact-main">
              <div className="impact-value">
                {scenario.newUnits.toLocaleString('en-IN')}
              </div>
              <div className="impact-change" style={{ color: getIndicatorColor(scenario.unitsChange) }}>
                {scenario.unitsChange > 0 ? '📈' : scenario.unitsChange < 0 ? '📉' : '➡️'}
                {formatPercent(scenario.unitsChange)}
              </div>
            </div>
            <div className="impact-baseline">
              vs baseline {baseline.expectedUnits.toLocaleString('en-IN')} units
            </div>
          </div>

          <div className="impact-card sellthrough-card">
            <div className="impact-header">
              <BarChart3 size={20} style={{ color: '#8B5CF6' }} />
              <h4>Sell-Through Rate</h4>
            </div>
            <div className="impact-main">
              <div className="impact-value">
                {scenario.sellThrough.toFixed(0)}%
              </div>
              <div className="sellthrough-bar">
                <div 
                  className="sellthrough-fill"
                  style={{ width: `${scenario.sellThrough}%` }}
                />
              </div>
            </div>
            <div className="impact-baseline">
              {scenario.sellThrough > 80 ? '✅ Excellent' : scenario.sellThrough > 60 ? '🟡 Good' : '⚠️ Needs attention'}
            </div>
          </div>

          <div className="impact-card price-card">
            <div className="impact-header">
              <AlertCircle size={20} style={{ color: '#EC4899' }} />
              <h4>Competitive Position</h4>
            </div>
            <div className="impact-main">
              <div className="impact-value" style={{
                color: scenario.competitivePosition === 'premium' ? '#22C55E' : 
                       scenario.competitivePosition === 'aggressive' ? '#3B82F6' : 
                       '#F59E0B'
              }}>
                {scenario.competitivePosition.toUpperCase()}
              </div>
              <div className="impact-change">
                {scenario.priceVsMarket > 0 ? '↑' : '↓'}
                {Math.abs(scenario.priceVsMarket).toFixed(1)}% vs market avg
              </div>
            </div>
            <div className="impact-baseline">
              Market avg: {formatCurrency(baseline.compAvgPrice)}
            </div>
          </div>
        </div>
      </div>

      {/* Summary insight */}
      <div className="simulator-insight">
        <p>
          {scenario.revenueChange > 10 && '🚀 This scenario drives strong revenue growth.'}
          {scenario.revenueChange > 0 && scenario.revenueChange <= 10 && '✅ This scenario shows positive revenue impact.'}
          {scenario.revenueChange <= 0 && scenario.revenueChange > -10 && '⚠️ Revenue remains relatively stable with this scenario.'}
          {scenario.revenueChange <= -10 && '⛔ This scenario significantly reduces revenue.'}
          {' '} 
          {scenario.newMargin > baseline.expectedMargin && 'Margins improve.'}
          {scenario.newMargin < baseline.expectedMargin && 'Margins compress.'}
          {' '}
          {scenario.sellThrough > 80 && 'Stock turns efficiently.' }
          {scenario.sellThrough <= 80 && 'Consider inventory management.'}
        </p>
      </div>
    </div>
  );
}
