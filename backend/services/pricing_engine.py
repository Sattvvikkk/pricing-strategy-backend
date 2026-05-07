"""Pricing engine — blends rule-based + ML (XGBoost) for final recommendation.

Per-product price corridors are derived from cost_price and current_price,
not from the old global PRICE_FLOOR / PRICE_CEILING constants.
"""
import numpy as np
from config import DEMAND_UP_THRESH, DEMAND_DOWN_THRESH, HIGH_STOCK, LOW_STOCK, RULE_WEIGHT, ML_WEIGHT


def _corridor(features: dict) -> tuple[float, float]:
    """Compute per-product price floor and ceiling."""
    cost_price    = float(features.get("cost_price", features["current_price"] * 0.45))
    current_price = float(features["current_price"])
    floor   = cost_price * 1.20
    ceiling = current_price * 1.50
    # Hard sanity: ceiling must be at least 10 % above current; floor at most 80 % of current
    ceiling = max(ceiling, current_price * 1.10)
    floor   = min(floor,   current_price * 0.80)
    return floor, ceiling


def rule_based_price(features: dict) -> dict:
    """Simple rule-based pricing heuristics using product demand/stock signals."""
    current       = float(features["current_price"])
    demand_ma_7   = float(features["demand_ma_7"])
    demand_ma_30  = float(features.get("demand_ma_30", demand_ma_7))
    stock         = int(features["stock"])
    comp_avg      = float(features.get("competitor_avg_price", current))
    # Derive demand trend from MA difference (works with build_features output)
    trend = (demand_ma_7 - demand_ma_30) / demand_ma_30 if demand_ma_30 > 0 else 0.0

    floor, ceiling = _corridor(features)

    action, adj_pct, reasons = "Hold", 0.0, []

    if trend > DEMAND_UP_THRESH and comp_avg > current * 1.05:
        adj_pct = np.random.uniform(0.05, 0.10)
        action  = "Increase"
        reasons.append("Rising demand with higher competitor prices")
    elif trend < DEMAND_DOWN_THRESH:
        adj_pct = np.random.uniform(-0.10, -0.05)
        action  = "Decrease"
        reasons.append("Declining demand trend")

    if stock > HIGH_STOCK and demand_ma_7 < 25:
        adj_pct = min(adj_pct, np.random.uniform(-0.15, -0.10))
        action  = "Decrease"
        reasons.append("High inventory with low demand")
    elif stock < LOW_STOCK and demand_ma_7 > 40:
        adj_pct = max(adj_pct, np.random.uniform(0.05, 0.10))
        action  = "Increase"
        reasons.append("Low stock with high demand")

    if comp_avg < current * 0.90 and action != "Increase":
        adj_pct = min(adj_pct, -0.05)
        action  = "Decrease"
        reasons.append("Competitors pricing significantly lower")

    if not reasons:
        reasons.append("Market conditions stable")

    rec = round(float(np.clip(current * (1 + adj_pct), floor, ceiling)))
    return {"recommended_price": rec, "action": action, "reasons": reasons}


def compute_recommendation(features: dict, ml_result: dict) -> dict:
    """Blend rule-based and ML prices; apply per-product corridor."""
    floor, ceiling = _corridor(features)
    rule     = rule_based_price(features)
    ml_price = float(ml_result.get("optimal_price", ml_result.get("recommended_price", features["current_price"])))

    blended = round(float(np.clip(
        RULE_WEIGHT * rule["recommended_price"] + ML_WEIGHT * ml_price,
        floor, ceiling,
    )))
    current = float(features["current_price"])

    if blended > current * 1.02:
        action = "Increase"
    elif blended < current * 0.98:
        action = "Decrease"
    else:
        action = "Hold"

    # Estimate revenue impact using elasticity (default -1.0 if not available)
    elasticity = float(features.get("elasticity", -1.0))
    price_chg  = (blended - current) / current if current > 0 else 0.0
    demand_ma  = float(features["demand_ma_7"])
    new_demand = demand_ma * (1 + elasticity * price_chg)
    old_rev    = current  * demand_ma
    new_rev    = blended  * new_demand
    impact     = ((new_rev - old_rev) / old_rev * 100) if old_rev > 0 else 0.0

    return {
        "current_price":      current,
        "recommended_price":  blended,
        "action":             action,
        "revenue_impact_pct": round(impact, 1),
        "confidence":         ml_result.get("confidence", 70),
        "rule_price":         rule["recommended_price"],
        "ml_price":           round(ml_price),
        "reasons":            rule["reasons"],
    }


def scenario_recommendation(
    features: dict,
    ml_result: dict,
    demand_change_pct: float = 0,
    comp_change_pct: float = 0,
) -> dict:
    """Run a what-if scenario by modifying feature inputs then re-computing."""
    mod = features.copy()
    mod["demand_ma_7"]  = float(features["demand_ma_7"])  * (1 + demand_change_pct / 100)
    mod["demand_ma_30"] = float(features.get("demand_ma_30", features["demand_ma_7"])) * (1 + demand_change_pct / 100)
    mod["competitor_avg_price"] = float(features.get("competitor_avg_price", features["current_price"])) * (1 + comp_change_pct / 100)
    return compute_recommendation(mod, ml_result)
