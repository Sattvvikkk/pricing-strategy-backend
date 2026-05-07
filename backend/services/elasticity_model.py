"""
Advanced Elasticity Model — Three-tier elasticity estimation.

Public API
----------
compute_advanced_elasticity(sales_df, product) → dict
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from xgboost import XGBRegressor


def _loglog_elasticity(df: pd.DataFrame) -> float:
    df = df[df["units_sold"] > 0].dropna(subset=["price", "units_sold"])
    if len(df) < 14:
        return -1.5
    log_p = np.log(df["price"].values).reshape(-1, 1)
    log_d = np.log(df["units_sold"].values)
    try:
        lr = LinearRegression().fit(log_p, log_d)
        return float(np.clip(lr.coef_[0], -3.5, -0.1))
    except Exception:
        return -1.5


def _arc_elasticity_by_band(df: pd.DataFrame) -> list:
    df = df.sort_values("price").copy()
    df = df[df["units_sold"] > 0]
    if len(df) < 20:
        return []
    try:
        df["price_bin"] = pd.qcut(df["price"], q=8, duplicates="drop")
        bin_avg = df.groupby("price_bin", observed=True).agg(
            price=("price", "mean"), demand=("units_sold", "mean"),
        ).reset_index(drop=True)
        results = []
        for i in range(1, len(bin_avg)):
            p1, d1 = bin_avg.iloc[i - 1]["price"], bin_avg.iloc[i - 1]["demand"]
            p2, d2 = bin_avg.iloc[i]["price"],     bin_avg.iloc[i]["demand"]
            if p1 <= 0 or d1 <= 0 or abs(p2 - p1) < 0.01:
                continue
            arc_price  = (p2 - p1) / ((p1 + p2) / 2)
            arc_demand = (d2 - d1) / ((d1 + d2) / 2)
            e = arc_demand / arc_price if abs(arc_price) > 1e-6 else -1.5
            results.append({
                "price_midpoint":   round((p1 + p2) / 2),
                "elasticity_local": round(float(np.clip(e, -5.0, 0.0)), 3),
            })
        return results
    except Exception:
        return []


def _xgb_elasticity(df: pd.DataFrame) -> float:
    df = df.sort_values("date").copy()
    df["date"]  = pd.to_datetime(df["date"])
    df["dow"]   = df["date"].dt.dayofweek
    df["lag_1"] = df["units_sold"].shift(1)
    df["ma_7"]  = df["units_sold"].rolling(7, min_periods=1).mean()
    df = df.dropna()
    if len(df) < 20:
        return -1.5
    FEAT = ["price", "dow", "lag_1", "ma_7"]
    X, y = df[FEAT].values, df["units_sold"].values
    try:
        model = XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1,
                             objective="reg:squarederror", random_state=42, verbosity=0)
        model.fit(X, y)
        last = df[FEAT].iloc[-1].copy()
        p0 = last["price"]; delta = p0 * 0.01
        row_lo = last.copy(); row_lo["price"] = p0 - delta
        row_hi = last.copy(); row_hi["price"] = p0 + delta
        d_lo = float(model.predict([row_lo.values])[0])
        d_hi = float(model.predict([row_hi.values])[0])
        d0   = float(model.predict([last.values])[0])
        if d0 <= 0:
            return -1.5
        pct_d = (d_hi - d_lo) / d0
        pct_p = (row_hi["price"] - row_lo["price"]) / p0
        if abs(pct_p) < 1e-8:
            return -1.5
        return float(np.clip(pct_d / pct_p, -3.5, -0.1))
    except Exception:
        return -1.5


def _build_curve(current_price: float, current_demand: float, elasticity: float) -> list:
    rows = []
    for pct in range(-30, 31, 2):
        test_price = current_price * (1 + pct / 100)
        if test_price <= 0:
            continue
        ratio = test_price / current_price
        exp_demand  = max(0.0, current_demand * (ratio ** elasticity))
        exp_revenue = test_price * exp_demand
        rows.append({
            "price":            round(test_price),
            "demand":           round(exp_demand, 1),
            "revenue":          round(exp_revenue),
            "pct_from_current": pct,
        })
    return rows


def _optimal_band(curve: list, threshold_pct: float = 0.95) -> dict:
    if not curve:
        return {"min": 0, "max": 0}
    max_rev = max(r["revenue"] for r in curve)
    if max_rev <= 0:
        return {"min": 0, "max": 0}
    band = [r["price"] for r in curve if r["revenue"] >= max_rev * threshold_pct]
    if not band:
        peak = max(curve, key=lambda r: r["revenue"])
        return {"min": peak["price"], "max": peak["price"]}
    return {"min": min(band), "max": max(band)}


def compute_advanced_elasticity(sales_df: pd.DataFrame, product: dict) -> dict:
    df = sales_df.sort_values("date").copy()

    e1 = _loglog_elasticity(df)
    e2 = _xgb_elasticity(df)
    arc_bands = _arc_elasticity_by_band(df)

    elasticity = round(float(e1 * 0.45 + e2 * 0.55), 4)
    if not (-3.5 <= elasticity <= -0.1):
        elasticity = e1

    current_price  = float(df["price"].iloc[-1]) if not df.empty else float(product.get("price", 799))
    current_demand = float(df["units_sold"].rolling(7, min_periods=1).mean().iloc[-1]) if not df.empty else 30.0
    cost_price     = float(product.get("cost_price", current_price * 0.5))

    curve = _build_curve(current_price, current_demand, elasticity)

    viable = [r for r in curve if r["price"] >= cost_price * 1.15]
    optimal_price = max(viable, key=lambda r: r["revenue"])["price"] if viable else round(current_price)

    band = _optimal_band(curve)
    sensitivity_score = min(100, max(0, int((abs(elasticity) / 3.5) * 100)))

    if sensitivity_score >= 70:
        sensitivity_label = "Highly Elastic"
        interpretation    = "Demand is very sensitive to price. Small drops drive large volume gains."
    elif sensitivity_score >= 40:
        sensitivity_label = "Moderately Elastic"
        interpretation    = "Moderate price sensitivity. Balanced pricing strategy recommended."
    else:
        sensitivity_label = "Inelastic"
        interpretation    = "Demand is relatively insensitive to price. Premium pricing viable."

    tiers_used = ["Log-Log OLS", "XGBoost Finite-Difference"]
    if arc_bands:
        tiers_used.append("Arc Elasticity Bands")

    return {
        "elasticity_coefficient":  elasticity,
        "elasticity_curve":        curve,
        "arc_elasticity_bands":    arc_bands,
        "price_sensitivity_score": sensitivity_score,
        "sensitivity_label":       sensitivity_label,
        "optimal_price_band":      band,
        "optimal_price":           optimal_price,
        "current_price":           round(current_price),
        "cost_price":              round(cost_price),
        "tiers_used":              tiers_used,
        "interpretation":          interpretation,
    }
