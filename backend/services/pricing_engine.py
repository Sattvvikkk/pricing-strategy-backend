"""Pricing engine — blends rule-based + ML (XGBoost) for final recommendation."""
import numpy as np
from config import (PRICE_FLOOR, PRICE_CEILING, DEMAND_UP_THRESH,
                    DEMAND_DOWN_THRESH, HIGH_STOCK, LOW_STOCK, RULE_WEIGHT, ML_WEIGHT)


def rule_based_price(features: dict) -> dict:
    current = features["current_price"]
    trend = features["demand_trend"]
    stock = features["stock"]
    comp_avg = features["competitor_avg_price"]
    demand = features["demand_ma_7"]

    action, adj_pct, reasons = "Hold", 0.0, []

    if trend > DEMAND_UP_THRESH and comp_avg > current * 1.05:
        adj_pct = np.random.uniform(0.05, 0.10)
        action = "Increase"
        reasons.append("Rising demand with higher competitor prices")
    elif trend < DEMAND_DOWN_THRESH:
        adj_pct = np.random.uniform(-0.10, -0.05)
        action = "Decrease"
        reasons.append("Declining demand trend")

    if stock > HIGH_STOCK and demand < 25:
        adj_pct = min(adj_pct, np.random.uniform(-0.15, -0.10))
        action = "Decrease"
        reasons.append("High inventory with low demand")
    elif stock < LOW_STOCK and demand > 40:
        adj_pct = max(adj_pct, np.random.uniform(0.05, 0.10))
        action = "Increase"
        reasons.append("Low stock with high demand")

    if comp_avg < current * 0.90 and action != "Increase":
        adj_pct = min(adj_pct, -0.05)
        action = "Decrease"
        reasons.append("Competitors pricing significantly lower")

    if not reasons:
        reasons.append("Market conditions stable")

    rec = round(np.clip(current * (1 + adj_pct), PRICE_FLOOR, PRICE_CEILING))
    return {"recommended_price": rec, "action": action, "reasons": reasons}


def compute_recommendation(features: dict, ml_result: dict) -> dict:
    rule = rule_based_price(features)
    ml_price = ml_result["optimal_price"]

    blended = round(np.clip(RULE_WEIGHT * rule["recommended_price"] + ML_WEIGHT * ml_price,
                            PRICE_FLOOR, PRICE_CEILING))
    current = features["current_price"]

    if blended > current * 1.02:
        action = "Increase"
    elif blended < current * 0.98:
        action = "Decrease"
    else:
        action = "Hold"

    old_rev = current * features["demand_ma_7"]
    elasticity = -0.5
    price_chg = (blended - current) / current
    new_demand = features["demand_ma_7"] * (1 + elasticity * price_chg)
    new_rev = blended * new_demand
    impact = ((new_rev - old_rev) / old_rev * 100) if old_rev > 0 else 0

    return {
        "current_price": current,
        "recommended_price": blended,
        "action": action,
        "revenue_impact_pct": round(impact, 1),
        "confidence": ml_result.get("confidence", 70),
        "rule_price": rule["recommended_price"],
        "ml_price": ml_price,
        "reasons": rule["reasons"],
    }


def scenario_recommendation(features: dict, ml_result: dict,
                            demand_change_pct: float = 0, comp_change_pct: float = 0) -> dict:
    mod = features.copy()
    mod["demand_ma_7"] *= (1 + demand_change_pct / 100)
    mod["demand_trend"] *= (1 + demand_change_pct / 100)
    mod["competitor_avg_price"] *= (1 + comp_change_pct / 100)
    return compute_recommendation(mod, ml_result)
