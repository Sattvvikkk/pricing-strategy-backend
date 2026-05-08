"""Scenario Simulator - What-if analysis for pricing strategies.

Simulates the impact of changing key variables:
- Price change %
- Ad spend multiplier
- Inventory quantity
- Competitor reaction
- Demand spike

Returns before/after metrics for revenue, margin, sell-through.
"""

import numpy as np
from typing import Dict, Any, List
from dataclasses import dataclass


@dataclass
class SimulationInput:
    """User-adjustable simulation parameters."""
    price_change_pct: float = 0.0          # -20 to +20
    ad_spend_multiplier: float = 1.0      # 0.5 to 3.0
    inventory_quantity: int = 300         # 100 to 1000
    competitor_reaction: str = "neutral"  # "aggressive", "neutral", "passive"
    demand_spike: float = 1.0            # 0.5 to 2.0


@dataclass
class SimulationMetrics:
    """Key business metrics."""
    revenue: float
    margin_pct: float
    sell_through_pct: float
    units_sold: int
    avg_price: float
    market_share: float


class ScenarioSimulator:
    """Simulates business outcomes under different scenarios."""
    
    def __init__(self, base_data: Dict[str, Any]):
        """
        Initialize with base product data.
        
        Args:
            base_data: {
                "current_price": 799,
                "cost_price": 400,
                "current_stock": 300,
                "avg_daily_demand": 30,
                "elasticity": -1.5,
                "competitor_avg_price": 750,
                "market_size": 10000,
                "current_revenue": 1200000,  # ₹12L
                "current_margin": 0.18,
                "current_sell_through": 0.61,
                "current_market_share": 0.08
            }
        """
        self.base = base_data
    
    def _calculate_demand_impact(self, price_change_pct: float, ad_multiplier: float, demand_spike: float) -> float:
        """Calculate demand change based on price, ads, and external spike."""
        # Price elasticity impact
        price_impact = 1 + (price_change_pct / 100) * self.base.get("elasticity", -1.5)
        
        # Ad spend impact (diminishing returns)
        ad_impact = 1 + (ad_multiplier - 1) * 0.3  # 30% of ad multiplier translates to demand
        
        # External demand spike
        external_impact = demand_spike
        
        return price_impact * ad_impact * external_impact
    
    def _calculate_competitor_impact(self, competitor_reaction: str, price_change_pct: float) -> float:
        """Calculate market share impact from competitor reaction."""
        base_market_share = self.base.get("current_market_share", 0.08)
        
        if competitor_reaction == "aggressive":
            # Competitors match/undercut our price change
            if price_change_pct < -5:  # We dropped price significantly
                return base_market_share * 0.9  # Lose 10% share
            elif price_change_pct > 5:  # We raised price
                return base_market_share * 0.85  # Lose 15% share
        elif competitor_reaction == "passive":
            # Competitors don't react
            if price_change_pct < -5:
                return base_market_share * 1.15  # Gain 15% share
            elif price_change_pct > 5:
                return base_market_share * 0.95  # Lose 5% share
        
        return base_market_share
    
    def _simulate_scenario(self, inputs: SimulationInput) -> SimulationMetrics:
        """Run a single simulation scenario."""
        current_price = self.base.get("current_price", 799)
        cost_price = self.base.get("cost_price", 400)
        base_demand = self.base.get("avg_daily_demand", 30)
        
        # Calculate new price
        new_price = current_price * (1 + inputs.price_change_pct / 100)
        new_price = max(cost_price * 1.1, new_price)  # Minimum 10% margin
        
        # Calculate demand
        demand_multiplier = self._calculate_demand_impact(
            inputs.price_change_pct, inputs.ad_spend_multiplier, inputs.demand_spike
        )
        new_daily_demand = base_demand * demand_multiplier
        
        # Calculate 30-day sales
        days_of_stock = inputs.inventory_quantity / max(new_daily_demand, 1)
        units_sold = min(inputs.inventory_quantity, new_daily_demand * 30)
        
        # Calculate revenue
        revenue = units_sold * new_price
        
        # Calculate margin
        margin_pct = (new_price - cost_price) / new_price
        
        # Calculate sell-through
        sell_through_pct = units_sold / inputs.inventory_quantity
        
        # Calculate market share
        market_share = self._calculate_competitor_impact(inputs.competitor_reaction, inputs.price_change_pct)
        
        return SimulationMetrics(
            revenue=revenue,
            margin_pct=margin_pct,
            sell_through_pct=sell_through_pct,
            units_sold=int(units_sold),
            avg_price=new_price,
            market_share=market_share
        )
    
    def simulate(self, inputs: SimulationInput) -> Dict[str, Any]:
        """
        Run simulation and return before/after comparison.
        
        Returns:
            {
                "before": SimulationMetrics,
                "after": SimulationMetrics,
                "changes": {
                    "revenue_change_pct": float,
                    "margin_change_pct": float,
                    "sell_through_change_pct": float,
                    "market_share_change_pct": float
                }
            }
        """
        # Base metrics (current state)
        before = SimulationMetrics(
            revenue=self.base.get("current_revenue", 1200000),
            margin_pct=self.base.get("current_margin", 0.18),
            sell_through_pct=self.base.get("current_sell_through", 0.61),
            units_sold=int(self.base.get("avg_daily_demand", 30) * 30),
            avg_price=self.base.get("current_price", 799),
            market_share=self.base.get("current_market_share", 0.08)
        )
        
        # Simulated metrics
        after = self._simulate_scenario(inputs)
        
        # Calculate changes
        changes = {
            "revenue_change_pct": ((after.revenue - before.revenue) / before.revenue) * 100,
            "margin_change_pct": ((after.margin_pct - before.margin_pct) / before.margin_pct) * 100,
            "sell_through_change_pct": ((after.sell_through_pct - before.sell_through_pct) / before.sell_through_pct) * 100,
            "market_share_change_pct": ((after.market_share - before.market_share) / before.market_share) * 100,
            "units_change": after.units_sold - before.units_sold,
            "price_change": after.avg_price - before.avg_price
        }
        
        return {
            "before": before,
            "after": after,
            "changes": changes,
            "inputs": inputs
        }


def simulate_scenario(base_data: Dict[str, Any], inputs: SimulationInput) -> Dict[str, Any]:
    """Public API for scenario simulation."""
    simulator = ScenarioSimulator(base_data)
    return simulator.simulate(inputs)
