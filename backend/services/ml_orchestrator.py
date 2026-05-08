"""
ML Multi-Agent Orchestrator
============================
Coordinated set of 7 lightweight agents producing the unified ML payload
described in the platform blueprint:

  Data Quality       — completeness + freshness scoring
  Demand Forecast    — 7/14/30/90-day demand projections
  Elasticity         — price sensitivity coefficient + price corridor
  Competitor Reaction — probability competitors respond to price moves
  Inventory Risk     — stockout / overstock probabilities
  Customer Segment   — segment counts (loyal / price-sensitive / new)
  Insight Summarizer — converts numbers to human-readable insights

The orchestrator is intentionally fast (<50 ms) because it runs deterministic
math on top of the enriched product object + sales history. It can be
upgraded later to call the heavy ensemble models in services/ — agents are
independent.
"""
from __future__ import annotations

import math
import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pandas as pd


# ── Agent: Data Quality ─────────────────────────────────────────────────────


def agent_data_quality(product: Dict[str, Any], sales_df: Optional[pd.DataFrame]) -> Dict[str, Any]:
    """Score data completeness and freshness."""
    issues: List[str] = []
    score = 1.0

    # Field completeness
    required = ["current_price", "cost_price", "stock_on_hand", "sales_30d", "category"]
    missing = [f for f in required if not product.get(f)]
    if missing:
        score -= 0.1 * len(missing)
        issues.append(f"Missing fields: {', '.join(missing)}")

    # Sales history depth
    if sales_df is None or len(sales_df) == 0:
        score -= 0.4
        issues.append("No sales history available")
    elif len(sales_df) < 30:
        score -= 0.2
        issues.append(f"Sales history shallow ({len(sales_df)}d)")

    # Scrape freshness
    last_scraped = product.get("last_scraped_at")
    fresh = True
    if last_scraped:
        try:
            ts = datetime.fromisoformat(last_scraped.replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0
            if age_hours > 48:
                score -= 0.15
                issues.append(f"Competitor data is {int(age_hours)}h old")
                fresh = False
        except (ValueError, TypeError):
            pass

    score = max(0.0, min(1.0, score))
    return {
        "score": round(score, 3),
        "is_fresh": fresh,
        "issues": issues,
        "history_days": int(len(sales_df)) if sales_df is not None else 0,
    }


# ── Agent: Demand Forecast ──────────────────────────────────────────────────


def agent_demand_forecast(product: Dict[str, Any], sales_df: Optional[pd.DataFrame]) -> Dict[str, Any]:
    """Project demand using sales velocity, seasonality, and trend."""
    sales_30d = product.get("sales_30d", 0)
    seasonality = product.get("seasonality_index", 1.0)

    if sales_df is not None and len(sales_df) >= 14:
        # Use recent 14d velocity for short-horizon forecast
        recent = sales_df.tail(14)
        daily_velocity = recent["units_sold"].mean() if "units_sold" in recent.columns else sales_30d / 30.0
    else:
        daily_velocity = sales_30d / 30.0

    base_7 = daily_velocity * 7 * seasonality
    base_14 = daily_velocity * 14 * seasonality
    base_30 = daily_velocity * 30 * seasonality
    base_90 = daily_velocity * 90 * seasonality * 0.95  # damping for long horizon

    # Trend boost based on demand_trend signal
    trend = product.get("demand_trend", "Stable")
    trend_mult = {
        "Surging": 1.20, "Rising": 1.08, "Stable": 1.00, "Declining": 0.88
    }.get(trend, 1.0)

    return {
        "7d": int(round(base_7 * trend_mult)),
        "14d": int(round(base_14 * trend_mult)),
        "30d": int(round(base_30 * trend_mult)),
        "90d": int(round(base_90 * trend_mult)),
        "daily_velocity": round(daily_velocity, 2),
        "trend_multiplier": round(trend_mult, 2),
        "seasonality_index": round(seasonality, 3),
    }


# ── Agent: Elasticity ───────────────────────────────────────────────────────


def agent_elasticity(product: Dict[str, Any], sales_df: Optional[pd.DataFrame]) -> Dict[str, Any]:
    """Estimate price sensitivity from price/quantity covariation."""
    elasticity = -1.5  # default fallback

    if sales_df is not None and len(sales_df) >= 30 and "price" in sales_df.columns and "units_sold" in sales_df.columns:
        df = sales_df.dropna(subset=["price", "units_sold"]).copy()
        df = df[(df["price"] > 0) & (df["units_sold"] > 0)]
        if len(df) >= 14:
            # Log-log correlation gives elasticity coefficient
            log_p = df["price"].apply(math.log)
            log_q = df["units_sold"].apply(math.log)
            try:
                if log_p.std() > 0:
                    cov = ((log_p - log_p.mean()) * (log_q - log_q.mean())).mean()
                    var = ((log_p - log_p.mean()) ** 2).mean()
                    elasticity = cov / var if var > 0 else -1.5
                    # Clamp to reasonable range
                    elasticity = max(-4.0, min(-0.2, elasticity))
            except (ValueError, ZeroDivisionError):
                pass

    # Price corridor: optimal ≈ current; min/max from elasticity sensitivity
    current = float(product.get("current_price", 0))
    cost = float(product.get("cost_price", 0))
    min_price = max(cost * 1.25, current * 0.92)
    max_price = current * 1.12

    # Optimal: where marginal revenue × elasticity is maximized.
    # For simple case: elastic (<-1) → can lower; inelastic (>-1) → can raise
    if elasticity < -1.5:
        optimal = current * 0.97
    elif elasticity > -1.0:
        optimal = current * 1.05
    else:
        optimal = current

    return {
        "elasticity_score": round(elasticity, 3),
        "interpretation": (
            "Highly elastic" if elasticity < -1.5 else
            "Elastic" if elasticity < -1.0 else
            "Unit elastic" if elasticity < -0.7 else
            "Inelastic"
        ),
        "recommended_price_band": {
            "min": round(min_price, 2),
            "optimal": round(optimal, 2),
            "max": round(max_price, 2),
        },
    }


# ── Agent: Competitor Reaction ──────────────────────────────────────────────


def agent_competitor_reaction(product: Dict[str, Any], comp_df: Optional[pd.DataFrame]) -> Dict[str, Any]:
    """Estimate likelihood competitors respond to a price move."""
    price_index = product.get("price_index", 1.0)
    competitor_avg = product.get("competitor_avg_price", product.get("current_price", 0))

    competitor_count = int(len(comp_df)) if comp_df is not None else 0

    # Reaction probability rises when:
    #   - we are priced significantly below market (we'd undercut them)
    #   - many competitors monitored (more eyeballs)
    base = 0.30
    if price_index < 0.95: base += 0.25
    if price_index < 0.90: base += 0.15
    if competitor_count > 15: base += 0.10
    base = min(0.95, base)

    return {
        "reaction_probability": round(base, 3),
        "competitor_count": competitor_count,
        "price_index": round(float(price_index), 3),
        "competitor_avg_price": round(float(competitor_avg), 2),
        "expected_response_days": int(round(7 + (1 - base) * 14)),  # 7–21d
    }


# ── Agent: Inventory Risk ───────────────────────────────────────────────────


def agent_inventory_risk(product: Dict[str, Any], forecast: Dict[str, Any]) -> Dict[str, Any]:
    """Project stockout / overstock probabilities over 30-day horizon."""
    stock = product.get("stock_on_hand", 0)
    reorder = product.get("reorder_point", 0)
    forecast_30d = forecast.get("30d", 0)
    lead_time = product.get("lead_time_days", 14)

    # Stockout probability: P(demand_during_leadtime > stock)
    leadtime_demand = (forecast_30d / 30.0) * lead_time
    if stock <= 0:
        stockout_prob = 1.0
    elif stock < reorder:
        stockout_prob = 0.50 + min(0.40, (reorder - stock) / max(reorder, 1) * 0.4)
    else:
        # Stock buffer over leadtime demand
        buffer = stock - leadtime_demand
        if buffer < 0: stockout_prob = 0.7
        elif buffer < leadtime_demand * 0.3: stockout_prob = 0.25
        else: stockout_prob = max(0.03, 0.15 - (buffer / max(leadtime_demand, 1)) * 0.05)

    # Overstock probability
    days_of_cover = stock / max(forecast_30d / 30.0, 0.01)
    if days_of_cover > 240: overstock_prob = 0.7
    elif days_of_cover > 180: overstock_prob = 0.4
    elif days_of_cover > 120: overstock_prob = 0.18
    else: overstock_prob = 0.05

    urgency = (
        "Critical" if stockout_prob > 0.5 else
        "Reorder soon" if stockout_prob > 0.25 else
        "Healthy"
    )

    return {
        "stockout_probability": round(min(1.0, stockout_prob), 3),
        "overstock_probability": round(min(1.0, overstock_prob), 3),
        "days_of_cover": round(days_of_cover, 1),
        "leadtime_demand_units": int(round(leadtime_demand)),
        "urgency": urgency,
    }


# ── Agent: Customer Segmentation ────────────────────────────────────────────


def agent_customer_segmentation(product: Dict[str, Any]) -> Dict[str, Any]:
    """Estimate buyer segment mix from rating + price tier."""
    rating = float(product.get("rating", 4.0) or 4.0)
    price = float(product.get("current_price", 0))
    review_count = int(product.get("review_count", 0) or 0)

    # Loyalty correlates with rating and review velocity
    loyal_pct = max(0.10, min(0.40, (rating - 3.5) * 0.35))
    # Price-sensitivity inverse to price tier
    price_sensitive_pct = max(0.15, min(0.55, 0.55 - price / 8000))
    new_pct = max(0.10, 1.0 - loyal_pct - price_sensitive_pct - 0.20)
    occasional_pct = max(0.05, 1.0 - loyal_pct - price_sensitive_pct - new_pct)

    # Normalize
    total = loyal_pct + price_sensitive_pct + new_pct + occasional_pct
    norm = lambda x: round(x / total, 3)

    return {
        "segments": [
            {"name": "Loyal Premium", "share": norm(loyal_pct), "avg_basket": round(price * 1.35)},
            {"name": "Price-Sensitive", "share": norm(price_sensitive_pct), "avg_basket": round(price * 0.85)},
            {"name": "New / Browsing", "share": norm(new_pct), "avg_basket": round(price * 1.05)},
            {"name": "Occasional", "share": norm(occasional_pct), "avg_basket": round(price * 1.10)},
        ],
        "estimated_active_customers": review_count * 8,  # rough heuristic
    }


# ── Agent: Insight Summarizer ───────────────────────────────────────────────


def agent_insight_summarizer(
    product: Dict[str, Any],
    forecast: Dict[str, Any],
    elasticity: Dict[str, Any],
    competitor: Dict[str, Any],
    inv_risk: Dict[str, Any],
) -> List[str]:
    """Produce 3–5 human-readable insights from agent outputs."""
    out: List[str] = []
    name = product.get("name", "This product")

    # Demand insight
    velocity = forecast.get("daily_velocity", 0)
    trend_mult = forecast.get("trend_multiplier", 1.0)
    if trend_mult > 1.05:
        out.append(f"Demand is {int((trend_mult - 1) * 100)}% above baseline — {forecast['7d']} units expected next 7d.")
    elif trend_mult < 0.95:
        out.append(f"Demand softening ({int((1 - trend_mult) * 100)}% below baseline) — consider promo or markdown.")
    else:
        out.append(f"Demand stable at ~{velocity:.1f} units/day.")

    # Elasticity insight
    e = elasticity["elasticity_score"]
    band = elasticity["recommended_price_band"]
    if e < -1.3:
        out.append(f"Highly price-sensitive (elasticity {e}). Lowering price to ₹{band['optimal']:.0f} could lift volume.")
    elif e > -0.8:
        out.append(f"Price-inelastic (elasticity {e}). Room to raise price to ₹{band['max']:.0f}.")
    else:
        out.append(f"Moderate elasticity ({e}). Current price is near optimal.")

    # Competitor insight
    react = competitor["reaction_probability"]
    if react > 0.6:
        out.append(f"High chance competitors respond ({int(react*100)}%) — phase any change over {competitor['expected_response_days']}d.")
    elif competitor["price_index"] < 0.92:
        out.append(f"You're priced {int((1-competitor['price_index'])*100)}% below market — opportunity to raise.")
    elif competitor["price_index"] > 1.08:
        out.append(f"Priced {int((competitor['price_index']-1)*100)}% above market — watch for share erosion.")

    # Inventory insight
    if inv_risk["urgency"] == "Critical":
        out.append(f"Critical stockout risk ({int(inv_risk['stockout_probability']*100)}%) — reorder immediately.")
    elif inv_risk["overstock_probability"] > 0.4:
        out.append(f"Overstock risk ({int(inv_risk['overstock_probability']*100)}%) — {inv_risk['days_of_cover']:.0f}d of cover. Consider clearance.")

    return out[:5]


# ── Recommendation synthesis ────────────────────────────────────────────────


def _recommended_action(
    product: Dict[str, Any],
    elasticity: Dict[str, Any],
    competitor: Dict[str, Any],
    inv_risk: Dict[str, Any],
) -> Dict[str, Any]:
    """Pick a single concrete action with expected impact."""
    current = float(product.get("current_price", 0))
    optimal = elasticity["recommended_price_band"]["optimal"]
    delta_pct = ((optimal - current) / current) * 100 if current > 0 else 0

    # Override: clearance if overstock & price already at max-ish
    if inv_risk["overstock_probability"] > 0.5:
        return {
            "action": "Markdown 8–12%",
            "recommended_price": round(current * 0.90, 2),
            "rationale": "Overstock risk dominates — clear inventory before margin erosion",
            "expected_revenue_change_pct": -3.0,
            "expected_margin_change_pct": -8.0,
        }
    if inv_risk["urgency"] == "Critical":
        return {
            "action": "Hold + reorder",
            "recommended_price": round(current * 1.02, 2),
            "rationale": "Stockout imminent — small price lift while inventory recovers",
            "expected_revenue_change_pct": 1.5,
            "expected_margin_change_pct": 2.0,
        }
    return {
        "action": (
            "Increase price" if delta_pct > 1 else
            "Decrease price" if delta_pct < -1 else
            "Hold price"
        ),
        "recommended_price": round(optimal, 2),
        "rationale": elasticity["interpretation"] + " — competitor reaction probability " +
                     f"{int(competitor['reaction_probability']*100)}%",
        "expected_revenue_change_pct": round(delta_pct * (1 + elasticity["elasticity_score"] * 0.5), 2),
        "expected_margin_change_pct": round(delta_pct * 0.85, 2),
    }


def _confidence_score(data_quality: Dict, agents_succeeded: int, total_agents: int = 7) -> float:
    """Blend data quality with agent success rate."""
    base = (agents_succeeded / total_agents) * 0.5
    base += data_quality["score"] * 0.5
    return round(min(1.0, base), 3)


# ── Public orchestrator ─────────────────────────────────────────────────────


def run_analysis(
    product: Dict[str, Any],
    sales_df: Optional[pd.DataFrame] = None,
    comp_df: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """
    Run all 7 agents and return the unified blueprint payload.

    Each agent is independent — failures degrade gracefully without crashing
    the orchestration.
    """
    agents_run = {}
    agents_succeeded = 0

    def safe(name, fn):
        nonlocal agents_succeeded
        try:
            result = fn()
            agents_succeeded += 1
            agents_run[name] = "ok"
            return result
        except Exception as e:  # noqa: BLE001
            agents_run[name] = f"error: {type(e).__name__}"
            return None

    data_quality = safe("data_quality", lambda: agent_data_quality(product, sales_df)) or {
        "score": 0.5, "is_fresh": False, "issues": ["agent failed"], "history_days": 0
    }
    forecast = safe("demand_forecast", lambda: agent_demand_forecast(product, sales_df)) or {
        "7d": 0, "14d": 0, "30d": 0, "90d": 0, "daily_velocity": 0,
        "trend_multiplier": 1.0, "seasonality_index": 1.0
    }
    elasticity = safe("elasticity", lambda: agent_elasticity(product, sales_df)) or {
        "elasticity_score": -1.5, "interpretation": "Unknown",
        "recommended_price_band": {"min": 0, "optimal": product.get("current_price", 0), "max": 0}
    }
    competitor = safe("competitor_reaction", lambda: agent_competitor_reaction(product, comp_df)) or {
        "reaction_probability": 0.5, "competitor_count": 0, "price_index": 1.0,
        "competitor_avg_price": product.get("current_price", 0), "expected_response_days": 14
    }
    inv_risk = safe("inventory_risk", lambda: agent_inventory_risk(product, forecast)) or {
        "stockout_probability": 0.1, "overstock_probability": 0.1,
        "days_of_cover": 0, "leadtime_demand_units": 0, "urgency": "Unknown"
    }
    segmentation = safe("customer_segmentation", lambda: agent_customer_segmentation(product)) or {
        "segments": [], "estimated_active_customers": 0
    }
    insights = safe("insight_summarizer",
                    lambda: agent_insight_summarizer(product, forecast, elasticity, competitor, inv_risk)
                    ) or []

    recommended = _recommended_action(product, elasticity, competitor, inv_risk)
    confidence = _confidence_score(data_quality, agents_succeeded)

    return {
        "product_id": product.get("id"),
        "agents_run": agents_run,
        "data_quality": data_quality,
        "forecast": {
            "7d":  forecast["7d"],
            "14d": forecast["14d"],
            "30d": forecast["30d"],
            "90d": forecast["90d"],
            "daily_velocity": forecast["daily_velocity"],
            "trend_multiplier": forecast["trend_multiplier"],
        },
        "elasticity_score": elasticity["elasticity_score"],
        "elasticity_interpretation": elasticity["interpretation"],
        "recommended_price_band": elasticity["recommended_price_band"],
        "competitor_response": competitor,
        "inventory_risk": inv_risk,
        "customer_segmentation": segmentation,
        "insights": insights,
        "recommended_action": recommended,
        "confidence_score": confidence,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
