"""
Module G — AI Explanation Layer
Generates human-readable explanations for pricing recommendations.
"""


def generate_explanation(recommendation: dict, features: dict,
                         price_metrics: dict) -> str:
    """Build a natural-language paragraph explaining the pricing decision."""
    action = recommendation["action"]
    rec_price = recommendation["recommended_price"]
    current = recommendation["current_price"]
    impact = recommendation["revenue_impact_pct"]
    reasons = recommendation.get("reasons", [])
    trend = features.get("demand_trend", 0)
    comp_avg = features.get("competitor_avg_price", 0)
    stock = features.get("stock", 0)
    stock_cat = features.get("stock_category", "Medium")
    trend_dir = price_metrics.get("trend_direction", "Stable")
    volatility = price_metrics.get("volatility", 0)

    diff = rec_price - current
    diff_abs = abs(diff)

    parts = []

    # Opening line
    if action == "Increase":
        parts.append(
            f"A price increase of ₹{diff_abs:.0f} is recommended "
            f"(₹{current:.0f} → ₹{rec_price:.0f})."
        )
    elif action == "Decrease":
        parts.append(
            f"A price decrease of ₹{diff_abs:.0f} is recommended "
            f"(₹{current:.0f} → ₹{rec_price:.0f})."
        )
    else:
        parts.append(
            f"Holding the current price at ₹{current:.0f} is recommended."
        )

    # Demand context
    if trend > 0.05:
        parts.append(
            f"Demand has been trending upward ({trend*100:+.1f}% over the past week)."
        )
    elif trend < -0.05:
        parts.append(
            f"Demand has been declining ({trend*100:+.1f}% over the past week)."
        )
    else:
        parts.append("Demand has been relatively stable recently.")

    # Competitor context
    price_idx = current / comp_avg if comp_avg > 0 else 1
    if price_idx < 0.95:
        parts.append(
            f"Our price is {(1-price_idx)*100:.0f}% below the competitor average (₹{comp_avg:.0f}), "
            "leaving room for an upward adjustment."
        )
    elif price_idx > 1.05:
        parts.append(
            f"Our price is {(price_idx-1)*100:.0f}% above the competitor average (₹{comp_avg:.0f}), "
            "which may put pressure on sales."
        )
    else:
        parts.append(
            f"Our price is closely aligned with the competitor average (₹{comp_avg:.0f})."
        )

    # Stock context
    if stock_cat == "Low":
        parts.append(
            f"Stock is running low ({stock} units), supporting a higher price point."
        )
    elif stock_cat == "High":
        parts.append(
            f"Stock levels are high ({stock} units), favoring a competitive price to drive volume."
        )

    # Volatility
    if volatility > 30:
        parts.append(
            f"Price volatility has been elevated (σ = ₹{volatility:.0f}); "
            "caution is advised on large adjustments."
        )

    # Revenue impact
    if impact > 0:
        parts.append(f"This change is estimated to improve revenue by {impact:+.1f}%.")
    elif impact < 0:
        parts.append(
            f"This change may reduce revenue by {abs(impact):.1f}%, "
            "but is necessary to maintain competitive positioning."
        )

    # Business reasons
    if reasons:
        parts.append("Key factors: " + "; ".join(reasons) + ".")

    return " ".join(parts)
