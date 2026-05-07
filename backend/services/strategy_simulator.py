"""Strategy Simulator — 30-day projection for 4 strategies.

simulate_strategies(features, archetype, elasticity, cost_price)
    → {
        "series":  { strategy: [30 dicts] },
        "summary": { strategy: {total_revenue, total_margin, total_units} }
      }
"""
from typing import Dict, Any


_STRATEGIES = ["PENETRATION", "PREMIUM", "COMPETITIVE_MATCH", "HOLD"]


def simulate_strategies(
    features: Dict[str, Any],
    archetype: str,
    elasticity: float,
    cost_price: float,
) -> Dict[str, Any]:
    """
    Run 30-day projections for 4 fixed strategies.

    Target prices:
        PENETRATION       → comp_avg × 0.90
        PREMIUM           → current_price × 1.10
        COMPETITIVE_MATCH → comp_avg × 1.02
        HOLD              → current_price

    Demand at each day: base_demand × (target_price / current_price) ** elasticity
    """
    current_price = float(features["current_price"])
    comp_avg      = float(features.get("competitor_avg_price", current_price))
    base_demand   = float(features.get("demand_ma_7", 20.0))

    target_prices = {
        "PENETRATION":       comp_avg * 0.90,
        "PREMIUM":           current_price * 1.10,
        "COMPETITIVE_MATCH": comp_avg * 1.02,
        "HOLD":              current_price,
    }

    series:  Dict[str, list] = {}
    summary: Dict[str, Dict[str, float]] = {}

    for strategy in _STRATEGIES:
        target_price = target_prices[strategy]
        days_data: list = []

        total_revenue = 0.0
        total_margin  = 0.0
        total_units   = 0.0

        for day in range(1, 31):
            # Demand using elasticity
            if current_price > 0:
                demand = base_demand * ((target_price / current_price) ** elasticity)
            else:
                demand = base_demand
            demand = max(0.0, demand)

            daily_revenue = target_price * demand
            daily_margin  = (target_price - cost_price) * demand

            total_revenue += daily_revenue
            total_margin  += daily_margin
            total_units   += demand

            days_data.append({
                "day":     day,
                "price":   round(target_price, 2),
                "demand":  round(demand, 1),
                "revenue": round(daily_revenue, 2),
                "margin":  round(daily_margin, 2),
            })

        series[strategy]  = days_data
        summary[strategy] = {
            "total_revenue": round(total_revenue, 2),
            "total_margin":  round(total_margin, 2),
            "total_units":   round(total_units, 1),
        }

    return {"series": series, "summary": summary}
