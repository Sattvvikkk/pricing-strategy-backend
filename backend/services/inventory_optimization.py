"""
Inventory Optimization Model
=============================
Computes days-of-cover, restock urgency, markdown timing,
clearance pricing, and warehouse balance score.

Public API
----------
optimize_inventory(sales_df, product) → dict
"""
import numpy as np
import pandas as pd


def _days_of_cover(stock: int, avg_daily_demand: float) -> float:
    if avg_daily_demand <= 0:
        return 999.0
    return round(stock / avg_daily_demand, 1)


def _restock_recommendation(doc: float, avg_daily_demand: float, lead_time_days: int = 7) -> dict:
    reorder_point = avg_daily_demand * (lead_time_days + 3)  # safety stock = 3 days
    if doc <= lead_time_days:
        return {
            "action":              "RESTOCK_URGENT",
            "urgency":             "critical",
            "message":             f"Stock will run out in {doc:.0f} days — reorder immediately.",
            "suggested_restock_qty": int(avg_daily_demand * 45),  # 45-day replenishment
            "color":               "red",
        }
    elif doc <= 30:
        return {
            "action":              "RESTOCK_SOON",
            "urgency":             "warning",
            "message":             f"{doc:.0f} days of stock remaining — plan reorder within a week.",
            "suggested_restock_qty": int(avg_daily_demand * 30),
            "color":               "amber",
        }
    elif doc <= 60:
        return {
            "action":              "MONITOR",
            "urgency":             "low",
            "message":             f"{doc:.0f} days of stock. Healthy levels — continue monitoring.",
            "suggested_restock_qty": int(avg_daily_demand * 15),
            "color":               "green",
        }
    else:
        return {
            "action":              "OVERSTOCKED",
            "urgency":             "info",
            "message":             f"{doc:.0f} days of stock. Consider running promotions to clear inventory.",
            "suggested_restock_qty": 0,
            "color":               "blue",
        }


def _markdown_recommendation(
    doc: float,
    demand_trend: str,
    elasticity: float,
    current_price: float,
    cost_price: float,
) -> dict:
    """Recommend markdown strategy based on overstock + trend."""
    min_price = cost_price * 1.10  # minimum 10% margin

    if doc <= 60 or demand_trend == "rising":
        return {
            "action":                 "HOLD_PRICE",
            "message":                "No markdown needed. Demand is healthy.",
            "suggested_discount_pct": 0,
            "markdown_price":         current_price,
            "target_clearance_days":  None,
        }
    elif doc > 90 and demand_trend in ("falling", "stable"):
        # Use elasticity to find discount that 2x demand
        # Q_new = Q_old * (P_new/P_old)^elasticity
        # We want Q_new = 2 * Q_old → (P_new/P_old)^e = 2
        if elasticity < 0:
            target_ratio = 2 ** (1 / elasticity)  # P_new / P_old
            markdown_price = max(min_price, current_price * target_ratio)
        else:
            markdown_price = current_price * 0.85

        discount_pct = round((1 - markdown_price / current_price) * 100, 1)
        clearance_days = round(doc / 2)

        action = "MARKDOWN_NOW" if doc > 120 else "MARKDOWN_SOON"
        return {
            "action":                 action,
            "message":                f"Overstock detected ({doc:.0f} days cover). Markdown to clear.",
            "suggested_discount_pct": max(5, discount_pct),
            "markdown_price":         round(markdown_price, 2),
            "target_clearance_days":  clearance_days,
        }
    else:
        return {
            "action":                 "MONITOR",
            "message":                "Monitor inventory. No immediate action required.",
            "suggested_discount_pct": 0,
            "markdown_price":         current_price,
            "target_clearance_days":  None,
        }


def _clearance_price(
    cost_price: float,
    current_price: float,
    current_demand: float,
    elasticity: float,
    target_units: float,
    deadline_days: int = 30,
) -> dict:
    """
    Find minimum price that sells `target_units` within `deadline_days`.
    Uses power-law demand: Q2 = Q1 * (P2/P1)^e
    """
    min_price = cost_price * 1.05  # absolute floor = 5% above cost
    if current_demand <= 0 or elasticity >= 0:
        return {"price": round(min_price, 2), "achievable": False}

    needed_daily = target_units / deadline_days
    if needed_daily <= current_demand:
        return {"price": round(current_price, 2), "achievable": True}

    # Solve: needed_daily = current_demand * (P2/current_price)^elasticity
    # (P2/P1)^e = needed_daily / current_demand
    # P2/P1 = (ratio)^(1/e)
    ratio = needed_daily / current_demand
    try:
        price_ratio = ratio ** (1 / elasticity)
        clearance   = current_price * price_ratio
        achievable  = clearance >= min_price
        clearance   = max(min_price, clearance)
    except Exception:
        clearance  = min_price
        achievable = False

    return {"price": round(clearance, 2), "achievable": achievable}


def _inventory_health_score(doc: float, demand_trend: str, stock: int) -> int:
    """0-100 health score. 100 = perfectly healthy inventory levels."""
    # Optimal DoC = 30-60 days
    if 30 <= doc <= 60:
        doc_score = 100
    elif doc < 30:
        doc_score = int(doc / 30 * 100)
    else:
        # Penalty for excess: 60-90 = 80, 90-120 = 60, 120+ = 40
        doc_score = max(40, 100 - int((doc - 60) / 2))

    trend_bonus = {"rising": 10, "stable": 0, "falling": -15}.get(demand_trend, 0)
    return min(100, max(0, doc_score + trend_bonus))


def optimize_inventory(sales_df: pd.DataFrame, product: dict) -> dict:
    """
    Full inventory optimization analysis.

    Returns
    -------
    {
      "days_of_cover", "avg_daily_demand",
      "restock_recommendation", "markdown_recommendation",
      "clearance_price", "inventory_health_score",
      "demand_trend", "stock"
    }
    """
    df = sales_df.sort_values("date").copy()
    if df.empty:
        avg_daily = 30.0
    else:
        avg_daily = float(df["units_sold"].tail(30).mean())

    stock        = int(product.get("stock", 300))
    current_price = float(product.get("price", 799))
    cost_price    = float(product.get("cost_price", current_price * 0.5))

    # Elasticity (simple loglog estimate)
    elasticity = -1.5
    if len(df) >= 14:
        try:
            from sklearn.linear_model import LinearRegression
            import numpy as _np
            log_p = _np.log(df["price"].values).reshape(-1, 1)
            log_d = _np.log(df["units_sold"].clip(lower=1).values)
            lr = LinearRegression().fit(log_p, log_d)
            elasticity = float(_np.clip(lr.coef_[0], -3.5, -0.1))
        except Exception:
            pass

    # Demand trend
    if len(df) >= 14:
        ma7  = float(df["units_sold"].tail(7).mean())
        ma30 = float(df["units_sold"].tail(30).mean())
        if ma7 > ma30 * 1.05:
            demand_trend = "rising"
        elif ma7 < ma30 * 0.95:
            demand_trend = "falling"
        else:
            demand_trend = "stable"
    else:
        demand_trend = "stable"

    doc     = _days_of_cover(stock, avg_daily)
    restock = _restock_recommendation(doc, avg_daily)
    markdown = _markdown_recommendation(doc, demand_trend, elasticity, current_price, cost_price)

    clearance = _clearance_price(
        cost_price=cost_price,
        current_price=current_price,
        current_demand=avg_daily,
        elasticity=elasticity,
        target_units=stock * 0.80,   # sell 80% of stock
        deadline_days=30,
    )

    health = _inventory_health_score(doc, demand_trend, stock)

    return {
        "days_of_cover":          doc,
        "avg_daily_demand":       round(avg_daily, 1),
        "stock":                  stock,
        "demand_trend":           demand_trend,
        "elasticity":             elasticity,
        "restock_recommendation": restock,
        "markdown_recommendation": markdown,
        "clearance_price":        clearance,
        "inventory_health_score": health,
    }
