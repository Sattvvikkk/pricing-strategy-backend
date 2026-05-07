"""AI Explanation layer — generates human-readable pricing narratives.

generate_explanation(rec, features, volatility, archetype) → str

Accepts:
  rec       – output of pricing_engine.compute_recommendation
  features  – output of ml_engine.build_features (or get_latest_features)
  volatility – price standard deviation (float)
  archetype  – strategy archetype label from strategy_classifier (str)
"""

_ARCHETYPE_INTROS = {
    "CLEARANCE":          "A **clearance pricing strategy** is recommended to clear elevated inventory.",
    "PENETRATION":        "A **penetration pricing strategy** is recommended to capture market share.",
    "PREMIUM":            "A **premium pricing strategy** is recommended to maximise margin authority.",
    "SKIM":               "A **price-skimming strategy** is recommended given limited competition.",
    "COMPETITIVE_MATCH":  "A **competitive-match strategy** is recommended to hold market position.",
    "HOLD":               "Maintaining the current price is recommended — conditions are balanced.",
}

_ACTION_PHRASES = {
    "Increase": lambda d, cur, rec: f"A price increase of ₹{d:.0f} (₹{cur:.0f} → ₹{rec:.0f}) is advised.",
    "Decrease": lambda d, cur, rec: f"A price reduction of ₹{d:.0f} (₹{cur:.0f} → ₹{rec:.0f}) is advised.",
    "Hold":     lambda d, cur, rec: f"Holding the current price at ₹{cur:.0f} is advised.",
}


def generate_explanation(
    rec: dict,
    features: dict,
    volatility: float = 0,
    archetype: str = "HOLD",
) -> str:
    """
    Build a multi-sentence pricing narrative from ML outputs.

    Sentence order:
      1. Archetype framing
      2. Price action
      3. Demand signal
      4. Competitor positioning
      5. Stock signal
      6. Revenue / impact outlook
      7. Confidence footer
    """
    action    = rec["action"]
    rec_price = float(rec["recommended_price"])
    current   = float(rec["current_price"])
    impact    = float(rec.get("revenue_impact_pct", 0))
    confidence = float(rec.get("confidence", 70))

    # Feature signals
    demand_ma_7  = float(features.get("demand_ma_7", 20))
    demand_ma_30 = float(features.get("demand_ma_30", demand_ma_7))
    comp_avg     = float(features.get("competitor_avg_price", current))
    stock        = int(features.get("stock", 300))
    elasticity   = float(features.get("elasticity", -1.0))

    parts = []

    # 1. Archetype framing
    intro = _ARCHETYPE_INTROS.get(archetype, "A pricing adjustment is recommended.")
    parts.append(intro)

    # 2. Price action
    diff = abs(rec_price - current)
    action_fn = _ACTION_PHRASES.get(action, _ACTION_PHRASES["Hold"])
    parts.append(action_fn(diff, current, rec_price))

    # 3. Demand signal
    demand_trend = (demand_ma_7 - demand_ma_30) / demand_ma_30 if demand_ma_30 > 0 else 0.0
    if demand_trend > 0.05:
        parts.append(f"Short-term demand is trending up ({demand_trend*100:+.1f}% vs 30-day avg).")
    elif demand_trend < -0.05:
        parts.append(f"Short-term demand is weakening ({demand_trend*100:+.1f}% vs 30-day avg).")
    else:
        parts.append("Demand is stable relative to the 30-day average.")

    # 4. Competitor positioning
    if comp_avg > 0:
        pi = current / comp_avg
        if pi < 0.93:
            headroom = (1 - pi) * 100
            parts.append(
                f"Our price is {headroom:.0f}% below the competitor average (₹{comp_avg:.0f}), "
                f"leaving upward headroom."
            )
        elif pi > 1.07:
            premium = (pi - 1) * 100
            parts.append(
                f"Our price is {premium:.0f}% above the competitor average (₹{comp_avg:.0f}), "
                f"which may suppress demand."
            )
        else:
            parts.append(f"Our price is well-aligned with the competitor average (₹{comp_avg:.0f}).")

    # 5. Stock signal
    if stock < 100:
        parts.append(f"Stock is low ({stock} units) — a higher price helps preserve supply.")
    elif stock > 400:
        parts.append(f"Inventory is elevated ({stock:,} units) — competitive pricing aids sell-through.")

    # 6. Elasticity + revenue impact
    if abs(elasticity) > 1.2:
        parts.append(
            f"Demand is highly elastic (ε = {elasticity:.2f}) — small price moves "
            f"meaningfully shift volume."
        )
    elif abs(elasticity) < 0.8:
        parts.append(
            f"Demand is relatively inelastic (ε = {elasticity:.2f}) — price can be "
            f"moved without large volume loss."
        )

    if impact > 0:
        parts.append(f"Projected revenue impact: {impact:+.1f}%.")
    elif impact < 0:
        parts.append(
            f"Revenue may soften by {abs(impact):.1f}%, but is warranted for "
            f"competitive repositioning."
        )

    # 7. Confidence footer
    parts.append(f"Model confidence: {confidence:.0f}%.")

    return " ".join(parts)
