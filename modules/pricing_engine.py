"""
Module E — Dynamic Pricing Engine (CORE LOGIC)
Blends rule-based pricing with ML-based optimization.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from config import (
    PRICE_FLOOR, PRICE_CEILING, COST_PRICE,
    DEMAND_INCREASE_THRESHOLD, DEMAND_DECREASE_THRESHOLD,
    HIGH_STOCK_THRESHOLD, LOW_STOCK_THRESHOLD,
    COMPETITOR_HIGH_FACTOR, RULE_WEIGHT, ML_WEIGHT,
)


def rule_based_price(features: dict) -> dict:
    """Apply business rules to determine recommended price adjustment."""
    current = features["current_price"]
    trend = features["demand_trend"]
    stock = features["stock"]
    comp_avg = features["competitor_avg_price"]
    demand = features["demand_ma_7"]

    action = "Hold"
    adjustment_pct = 0.0
    reasons = []

    # Rule 1: High demand + competitor prices high → increase
    comp_high = comp_avg > current * COMPETITOR_HIGH_FACTOR
    if trend > DEMAND_INCREASE_THRESHOLD and comp_high:
        adjustment_pct = np.random.uniform(0.05, 0.10)
        action = "Increase"
        reasons.append("Rising demand with higher competitor prices")

    # Rule 2: Demand decreasing → decrease
    elif trend < DEMAND_DECREASE_THRESHOLD:
        adjustment_pct = np.random.uniform(-0.10, -0.05)
        action = "Decrease"
        reasons.append("Declining demand trend")

    # Rule 3: High stock + low demand → aggressive decrease
    if stock > HIGH_STOCK_THRESHOLD and demand < 25:
        adjustment_pct = min(adjustment_pct, np.random.uniform(-0.15, -0.10))
        action = "Decrease"
        reasons.append("High inventory with low demand")

    # Rule 4: Low stock + high demand → increase
    elif stock < LOW_STOCK_THRESHOLD and demand > 40:
        adjustment_pct = max(adjustment_pct, np.random.uniform(0.05, 0.10))
        action = "Increase"
        reasons.append("Low stock with high demand")

    # Rule 5: Competitor undercut protection
    if comp_avg < current * 0.90 and action != "Increase":
        adjustment_pct = min(adjustment_pct, -0.05)
        action = "Decrease"
        reasons.append("Competitors pricing significantly lower")

    if not reasons:
        reasons.append("Market conditions are stable")

    rec_price = current * (1 + adjustment_pct)
    rec_price = np.clip(rec_price, PRICE_FLOOR, PRICE_CEILING)

    return {
        "recommended_price": round(rec_price),
        "action": action,
        "adjustment_pct": round(adjustment_pct * 100, 1),
        "reasons": reasons,
    }


def ml_based_price(processed_df: pd.DataFrame,
                   forecast_demand: float) -> float:
    """Train a Ridge regression on historical data to suggest a price."""
    df = processed_df.dropna().copy()
    if len(df) < 30:
        return df["price"].iloc[-1]

    feature_cols = ["units_sold", "competitor_avg_price", "stock",
                    "demand_ma_7", "rating"]
    X = df[feature_cols].values
    # Target: the price that maximized revenue (proxy)
    y = df["price"].values

    model = Ridge(alpha=1.0)
    model.fit(X, y)

    # Predict with forecasted demand & latest features
    last = df.iloc[-1]
    pred_features = np.array([[
        forecast_demand,
        last["competitor_avg_price"],
        last["stock"],
        forecast_demand,
        last["rating"],
    ]])
    ml_price = float(model.predict(pred_features)[0])
    return np.clip(ml_price, PRICE_FLOOR, PRICE_CEILING)


def compute_recommendation(features: dict, processed_df: pd.DataFrame,
                           forecast_demand_val: float) -> dict:
    """Blend rule-based and ML-based pricing into a final recommendation."""
    rule_result = rule_based_price(features)
    ml_price = ml_based_price(processed_df, forecast_demand_val)

    # Weighted blend
    blended = RULE_WEIGHT * rule_result["recommended_price"] + ML_WEIGHT * ml_price
    blended = round(np.clip(blended, PRICE_FLOOR, PRICE_CEILING))

    # Determine final action
    current = features["current_price"]
    if blended > current * 1.02:
        action = "Increase"
    elif blended < current * 0.98:
        action = "Decrease"
    else:
        action = "Hold"

    # Estimate revenue impact
    old_revenue = current * features["demand_ma_7"]
    # Simple elasticity: 1% price increase → ~0.5% demand decrease
    elasticity = -0.5
    price_change_pct = (blended - current) / current
    new_demand = features["demand_ma_7"] * (1 + elasticity * price_change_pct)
    new_revenue = blended * new_demand
    revenue_impact = ((new_revenue - old_revenue) / old_revenue) * 100 if old_revenue > 0 else 0

    return {
        "current_price": current,
        "recommended_price": blended,
        "action": action,
        "revenue_impact_pct": round(revenue_impact, 1),
        "rule_price": rule_result["recommended_price"],
        "ml_price": round(ml_price),
        "reasons": rule_result["reasons"],
        "adjustment_pct": rule_result["adjustment_pct"],
    }


def scenario_recommendation(features: dict, processed_df: pd.DataFrame,
                            forecast_demand_val: float,
                            demand_change_pct: float = 0.0,
                            comp_price_change_pct: float = 0.0) -> dict:
    """Run a what-if scenario with adjusted demand or competitor prices."""
    modified = features.copy()
    modified["demand_ma_7"] *= (1 + demand_change_pct / 100)
    modified["demand_trend"] *= (1 + demand_change_pct / 100)
    modified["competitor_avg_price"] *= (1 + comp_price_change_pct / 100)
    adj_forecast = forecast_demand_val * (1 + demand_change_pct / 100)

    return compute_recommendation(modified, processed_df, adj_forecast)
