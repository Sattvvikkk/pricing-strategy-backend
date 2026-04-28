"""AI Explanation layer — generates human-readable pricing narratives."""


def generate_explanation(rec: dict, features: dict, volatility: float = 0) -> str:
    action = rec["action"]
    rec_price = rec["recommended_price"]
    current = rec["current_price"]
    impact = rec["revenue_impact_pct"]
    reasons = rec.get("reasons", [])
    trend = features.get("demand_trend", 0)
    comp_avg = features.get("competitor_avg_price", 0)
    stock = features.get("stock", 0)
    stock_cat = features.get("stock_category", "Medium")
    confidence = rec.get("confidence", 70)

    diff = abs(rec_price - current)
    parts = []

    if action == "Increase":
        parts.append(f"A price increase of \u20b9{diff:.0f} is recommended (\u20b9{current:.0f} \u2192 \u20b9{rec_price:.0f}).")
    elif action == "Decrease":
        parts.append(f"A price decrease of \u20b9{diff:.0f} is recommended (\u20b9{current:.0f} \u2192 \u20b9{rec_price:.0f}).")
    else:
        parts.append(f"Holding the current price at \u20b9{current:.0f} is recommended.")

    if trend > 0.05:
        parts.append(f"Demand has been trending upward ({trend*100:+.1f}% over the past week).")
    elif trend < -0.05:
        parts.append(f"Demand has been declining ({trend*100:+.1f}% over the past week).")
    else:
        parts.append("Demand has been relatively stable recently.")

    pi = current / comp_avg if comp_avg > 0 else 1
    if pi < 0.95:
        parts.append(f"Our price is {(1-pi)*100:.0f}% below the competitor average (\u20b9{comp_avg:.0f}), leaving room for upward adjustment.")
    elif pi > 1.05:
        parts.append(f"Our price is {(pi-1)*100:.0f}% above the competitor average (\u20b9{comp_avg:.0f}), which may pressure sales.")
    else:
        parts.append(f"Our price is aligned with competitor average (\u20b9{comp_avg:.0f}).")

    if stock_cat == "Low":
        parts.append(f"Low stock ({stock} units) supports a higher price.")
    elif stock_cat == "High":
        parts.append(f"High stock ({stock} units) favors competitive pricing.")

    if impact > 0:
        parts.append(f"Expected revenue impact: {impact:+.1f}%.")
    elif impact < 0:
        parts.append(f"Revenue may decrease by {abs(impact):.1f}%, but is necessary for competitive positioning.")

    parts.append(f"Confidence: {confidence:.0f}%.")

    if reasons:
        parts.append("Key factors: " + "; ".join(reasons) + ".")

    return " ".join(parts)
