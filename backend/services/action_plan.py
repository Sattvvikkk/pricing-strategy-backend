"""Action Plan Generator — 14-day per-archetype price movement plan.

generate_action_plan(features, archetype, elasticity, recommended_price, cost_price)
    → list of 14 dicts, one per day.
"""
import math
from datetime import date, timedelta
from typing import List, Dict, Any


# ── Internal helpers ──────────────────────────────────────────────────────────

def _clamp(price: float, corridor_min: float, corridor_max: float) -> float:
    return max(corridor_min, min(corridor_max, price))


def _sinusoidal_variation(day: int, price: float) -> float:
    """±₹10 to ±₹30 sinusoidal drift based on price tier."""
    if price < 1000:
        amplitude = 10.0
    elif price < 3000:
        amplitude = 20.0
    else:
        amplitude = 30.0
    return amplitude * math.sin(2 * math.pi * day / 7)


# ── Public API ────────────────────────────────────────────────────────────────

def generate_action_plan(
    features: Dict[str, Any],
    archetype: str,
    elasticity: float,
    recommended_price: float,
    cost_price: float,
) -> List[Dict[str, Any]]:
    """
    Generate a 14-day action plan with archetype-specific price trajectories.

    Returns a list of 14 dicts, each with:
        date, day, recommended_price, expected_demand,
        expected_revenue, expected_margin
    """
    current_price = float(features["current_price"])
    base_demand   = float(features.get("demand_ma_7", 20.0))

    # Corridor: never below cost × 1.2, never above current × 1.5
    corridor_min = cost_price * 1.2
    corridor_max = current_price * 1.5
    # Also respect recommended_price ceiling
    corridor_max = max(corridor_max, recommended_price * 1.1)

    today = date.today()
    plan: List[Dict[str, Any]] = []

    for day_idx in range(14):      # 0 → 13 internally; day 1 → 14 in output
        day_num = day_idx + 1
        day_date = today + timedelta(days=day_idx)

        # ── Price calculation by archetype ────────────────────────────────────

        if archetype == "PENETRATION":
            # Days 0-4: drop 2% per day; Days 5-13: hold at recommended
            if day_idx < 5:
                price = current_price * ((1 - 0.02) ** day_idx)
            else:
                price = recommended_price

        elif archetype == "CLEARANCE":
            # Linear 1% drop each day — no stabilisation
            price = current_price * ((1 - 0.01) ** day_idx)

        elif archetype == "SKIM":
            # Start at current × 1.05, concave curve toward recommended_price
            start_price = current_price * 1.05
            # Concave: drops faster early (sqrt curve)
            t = day_idx / 13.0  # 0 → 1
            concave_t = math.sqrt(t)  # 0 → 1, but faster near start
            price = start_price + (recommended_price - start_price) * concave_t

        elif archetype == "COMPETITIVE_MATCH":
            # Linear interpolation from current to recommended over 14 days
            price = current_price + (recommended_price - current_price) * (day_idx / 13.0)

        elif archetype in ("PREMIUM", "HOLD"):
            # Hold at recommended with slight sinusoidal variation
            variation = _sinusoidal_variation(day_idx, recommended_price)
            price = recommended_price + variation

        else:
            # Fallback: hold at recommended
            price = recommended_price

        # ── Clamp to corridor ────────────────────────────────────────────────
        price = _clamp(price, corridor_min, corridor_max)

        # ── Demand using elasticity coefficient ───────────────────────────────
        # demand = base_demand × (price / current_price) ** elasticity
        if current_price > 0:
            demand = base_demand * ((price / current_price) ** elasticity)
        else:
            demand = base_demand
        demand = max(0.0, demand)

        # ── Revenue & margin ──────────────────────────────────────────────────
        revenue = price * demand
        margin  = (price - cost_price) * demand

        plan.append({
            "date":             day_date.isoformat(),
            "day":              day_num,
            "recommended_price": round(price),
            "expected_demand":   round(demand, 1),
            "expected_revenue":  round(revenue, 2),
            "expected_margin":   round(margin, 2),
        })

    return plan
