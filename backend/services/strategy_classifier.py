"""Strategy archetype classifier — Part 3.

classify_archetype(features, competitor_stats, elasticity, margin_pct) → str
    Priority order:  CLEARANCE → PENETRATION → PREMIUM → SKIM
                     → COMPETITIVE_MATCH → HOLD

calculate_price_corridor(current_price, cost_price, competitor_stats, volatility) → dict
generate_risk_flags(features, competitor_stats, archetype) → list[dict]

All inputs use keys produced by ml_engine.build_features:
  current_price, cost_price, stock, rating, reviews,
  demand_ma_7, demand_ma_30, price_ma_7, price_ma_30,
  margin_pct, price_std, days_since_peak, competitor_avg_price
"""
from typing import Dict, Any, List


# ── Core classifier ─────────────────────────────────────────────────────────

def classify_archetype(
    features: Dict[str, Any],
    competitor_stats: Dict[str, Any],
    elasticity: float,
    margin_pct: float,
) -> str:
    """
    Classify pricing strategy archetype.

    Evaluation is in strict priority order — the first matching branch wins:

    1. CLEARANCE   – inventory stress: very high stock + demand falling
    2. PENETRATION – growth push: high elasticity + competitor price much higher
    3. PREMIUM     – price authority: low elasticity + strong rating + margin ok
    4. SKIM        – scarcity pricing: low competition + low elasticity + good margin
    5. COMPETITIVE_MATCH – near-parity: within 15 % of competitor avg + moderate elasticity
    6. HOLD        – default stable state
    """
    current_price   = float(features["current_price"])
    stock           = int(features["stock"])
    demand_ma_7     = float(features["demand_ma_7"])
    demand_ma_30    = float(features["demand_ma_30"])
    rating          = float(features["rating"])
    days_since_peak = int(features["days_since_peak"])

    competitor_avg   = float(competitor_stats.get("avg_price", current_price * 1.05))
    competitor_count = int(competitor_stats.get("competitor_count", 4))

    # Derived signals
    demand_trend = (demand_ma_7 - demand_ma_30) / demand_ma_30 if demand_ma_30 > 0 else 0.0
    comp_ratio   = competitor_avg / current_price if current_price > 0 else 1.0

    # ── 1. CLEARANCE ────────────────────────────────────────────────────────
    # High stock AND demand is falling (short-term MA below long-term MA by >10%)
    if stock > 350 and demand_trend < -0.10:
        return "CLEARANCE"

    # Also trigger CLEARANCE if demand peak was long ago + stock is elevated
    if stock > 400 and days_since_peak > 45:
        return "CLEARANCE"

    # ── 2. PENETRATION ──────────────────────────────────────────────────────
    # Elastic product + competitors charge significantly more
    if abs(elasticity) > 1.3 and comp_ratio > 1.20 and demand_trend > -0.05:
        return "PENETRATION"

    # ── 3. PREMIUM ──────────────────────────────────────────────────────────
    # Inelastic + strong rating + healthy margin + already at or above comp avg
    if (abs(elasticity) < 0.8 and rating >= 4.2 and
            margin_pct >= 0.28 and comp_ratio <= 1.10):
        return "PREMIUM"

    # ── 4. SKIM ─────────────────────────────────────────────────────────────
    # Few competitors + inelastic demand + good margin
    if competitor_count <= 3 and abs(elasticity) < 0.9 and margin_pct > 0.30:
        return "SKIM"

    # ── 5. COMPETITIVE_MATCH ────────────────────────────────────────────────
    # Within 15 % of competitor avg and moderate elasticity
    price_gap = abs(current_price - competitor_avg) / competitor_avg
    if price_gap < 0.15 and 0.8 <= abs(elasticity) <= 1.6:
        return "COMPETITIVE_MATCH"

    # ── 6. HOLD ─────────────────────────────────────────────────────────────
    return "HOLD"


# ── Price corridor ───────────────────────────────────────────────────────────

def calculate_price_corridor(
    current_price: float,
    cost_price: float,
    competitor_stats: Dict[str, Any],
    volatility: float,
) -> Dict[str, float]:
    """
    Compute a safe price corridor from cost-based floor and competitor ceiling.

    floor   = max(cost_price × 1.20,  competitor_min × 0.90)
    ceiling = min(current_price × 1.50, competitor_max × 1.15)

    A volatility buffer shrinks the corridor slightly to avoid erratic swings.
    """
    comp_min = float(competitor_stats.get("min_price", current_price * 0.80))
    comp_max = float(competitor_stats.get("max_price", current_price * 1.25))

    floor   = max(cost_price * 1.20, comp_min * 0.90)
    ceiling = min(current_price * 1.50, comp_max * 1.15)

    # Tighten by volatility (higher σ → smaller corridor)
    buffer  = min(0.10, volatility * 0.08)
    floor   = max(floor,   current_price * (1 - buffer))
    ceiling = min(ceiling, current_price * (1 + buffer + 0.15))

    # Sanity: corridor must be at least ₹50 wide
    if ceiling - floor < 50:
        floor   = max(cost_price * 1.15, floor - 25)
        ceiling = floor + 50

    return {"min": round(floor, 2), "max": round(ceiling, 2)}


# ── Risk flags ───────────────────────────────────────────────────────────────

def generate_risk_flags(
    features: Dict[str, Any],
    competitor_stats: Dict[str, Any],
    archetype: str,
) -> List[Dict[str, str]]:
    """Generate risk flags from current product state."""
    flags = []

    current_price  = float(features["current_price"])
    cost_price     = float(features.get("cost_price", current_price * 0.5))
    stock          = int(features["stock"])
    margin_pct     = float(features.get("margin_pct", (current_price - cost_price) / current_price))
    competitor_avg = float(competitor_stats.get("avg_price", current_price))
    demand_ma_7    = float(features.get("demand_ma_7", 20))
    demand_ma_30   = float(features.get("demand_ma_30", demand_ma_7))

    # Thin margin
    if margin_pct < 0.15:
        flags.append({
            "code":     "margin_thin",
            "severity": "high",
            "message":  f"Margin at {margin_pct:.1%} — sustained profitability at risk",
        })

    # Elevated inventory
    if stock > 500:
        flags.append({
            "code":     "high_inventory",
            "severity": "medium",
            "message":  f"High stock ({stock:,} units) may incur holding costs",
        })

    # Competitor undercut
    if competitor_avg < current_price * 0.88:
        undercut_pct = (current_price - competitor_avg) / current_price * 100
        flags.append({
            "code":     "competitor_undercut",
            "severity": "high",
            "message":  f"Competitors are {undercut_pct:.0f}% cheaper (avg ₹{competitor_avg:.0f})",
        })

    # Demand decay
    if demand_ma_30 > 0 and demand_ma_7 < demand_ma_30 * 0.80:
        flags.append({
            "code":     "demand_decay",
            "severity": "medium",
            "message":  "7-day demand is 20%+ below 30-day average — trend is weakening",
        })

    # CLEARANCE with positive margin — safe to markdown
    if archetype == "CLEARANCE" and margin_pct > 0.10:
        flags.append({
            "code":     "markdown_headroom",
            "severity": "info",
            "message":  "Margin headroom exists for a markdown without going below cost",
        })

    return flags