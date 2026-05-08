"""
Strategy Builder — generates multiple candidate pricing strategies
=================================================================
Each strategy is a deterministic price + plan derived from:
  - the enriched product object
  - the ML orchestrator output (forecast, elasticity, competitor, inventory)
  - user-supplied controls (objective, horizon, aggressiveness, etc.)

Each candidate returns a scorecard with expected revenue/margin/units,
risk score, and a confidence score so the UI can rank them.

The 11 strategies in the catalog map directly to the blueprint:
  Cost Plus · Competitor Match · Penetration · Premium · Clearance ·
  Markdown Optimization · Bundle · Psychological · Price Corridor ·
  A/B Test · Stock Liquidation
"""
from __future__ import annotations

from typing import Any, Dict, List


# ── Helpers ──────────────────────────────────────────────────────────────────


def _round_psychological(price: float) -> float:
    """Round to .99 / .49 endings."""
    base = int(price)
    if price - base >= 0.5:
        return float(base) + 0.99
    return float(base) - 0.01 if base > 1 else float(base)


def _expected_units(elasticity: float, base_units: int, price_change_pct: float) -> int:
    """%ΔQ = elasticity × %ΔP."""
    return max(0, int(round(base_units * (1 + (elasticity * price_change_pct) / 100))))


def _scorecard(
    name: str,
    recommended_price: float,
    current_price: float,
    cost_price: float,
    base_units_30d: int,
    elasticity: float,
    risk: float,
    confidence: float,
    drivers: List[str],
    rationale: str,
    horizon_days: int = 30,
) -> Dict[str, Any]:
    """Pack a strategy into the standard scorecard format."""
    delta_pct = ((recommended_price - current_price) / current_price) * 100 if current_price > 0 else 0
    expected_units = _expected_units(elasticity, base_units_30d, delta_pct)
    expected_revenue = expected_units * recommended_price
    expected_margin_pct = ((recommended_price - cost_price) / recommended_price) * 100 if recommended_price > 0 else 0
    base_revenue = current_price * base_units_30d
    revenue_uplift_pct = ((expected_revenue - base_revenue) / base_revenue) * 100 if base_revenue > 0 else 0

    # Scale to horizon
    if horizon_days != 30:
        expected_units = int(round(expected_units * (horizon_days / 30.0)))
        expected_revenue = round(expected_revenue * (horizon_days / 30.0), 2)

    return {
        "name": name,
        "recommended_price": round(recommended_price, 2),
        "price_change_pct": round(delta_pct, 2),
        "expected_units": expected_units,
        "expected_revenue": round(expected_revenue, 2),
        "expected_margin_pct": round(expected_margin_pct, 2),
        "expected_revenue_uplift_pct": round(revenue_uplift_pct, 2),
        "horizon_days": horizon_days,
        "risk_score": round(risk, 2),
        "confidence": round(confidence, 2),
        "drivers": drivers,
        "rationale": rationale,
    }


# ── Strategy definitions ─────────────────────────────────────────────────────


def strategy_cost_plus(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    target_margin = 0.50  # 50% gross margin baseline
    price = p["cost_price"] / (1 - target_margin)
    return _scorecard(
        name="Cost Plus",
        recommended_price=price,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.20,
        confidence=0.78,
        drivers=["Floor cost protection", "Stable margin target"],
        rationale=f"Maintain a {int(target_margin*100)}% gross margin regardless of market noise.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_competitor_match(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    comp_avg = ml["competitor_response"]["competitor_avg_price"]
    return _scorecard(
        name="Competitor Match",
        recommended_price=comp_avg,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.30,
        confidence=0.85,
        drivers=[f"Competitor avg ₹{comp_avg:.0f}", "Match-the-market"],
        rationale="Track the competitor average to defend share without margin erosion.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_penetration(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    aggression = ctx.get("aggressiveness", 0.5)  # 0..1
    discount_pct = 8 + aggression * 12  # 8–20% discount
    price = p["current_price"] * (1 - discount_pct / 100)
    price = max(price, p["cost_price"] * 1.15)  # never below 15% margin floor
    return _scorecard(
        name="Penetration",
        recommended_price=price,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.55,
        confidence=0.72,
        drivers=[f"Drop {discount_pct:.0f}%", "Volume push"],
        rationale="Aggressive discount to grab share. High elasticity required for ROI.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_premium(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    band_max = ml["recommended_price_band"]["max"]
    price = max(band_max, p["current_price"] * 1.08)
    return _scorecard(
        name="Premium",
        recommended_price=price,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.45,
        confidence=0.68,
        drivers=["Price-inelastic segment", "Brand premium positioning"],
        rationale="Lift price toward upper band to maximise margin where demand is sticky.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_clearance(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    overstock = ml["inventory_risk"]["overstock_probability"]
    discount_pct = 15 + overstock * 25  # 15–40%
    price = p["current_price"] * (1 - discount_pct / 100)
    price = max(price, p["cost_price"] * 1.05)
    return _scorecard(
        name="Clearance",
        recommended_price=price,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.25,
        confidence=0.82,
        drivers=[f"{int(overstock*100)}% overstock risk", f"Cut {discount_pct:.0f}%"],
        rationale="Liquidate slow stock before further margin erosion or markdowns.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_markdown_optimization(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    optimal = ml["recommended_price_band"]["optimal"]
    return _scorecard(
        name="Markdown Optimization",
        recommended_price=optimal,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.18,
        confidence=0.88,
        drivers=["ML-optimal price point", f"Elasticity {ml['elasticity_score']:.2f}"],
        rationale="Use the elasticity-derived sweet spot to maximise revenue × margin.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_psychological(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    optimal = ml["recommended_price_band"]["optimal"]
    price = _round_psychological(optimal)
    return _scorecard(
        name="Psychological",
        recommended_price=price,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.20,
        confidence=0.74,
        drivers=["Charm pricing (.99 ending)", "Conversion lift"],
        rationale="Charm pricing typically yields 1–3% conversion lift with no margin loss.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_price_corridor(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    band = ml["recommended_price_band"]
    midpoint = (band["min"] + band["max"]) / 2
    return _scorecard(
        name="Price Corridor Optimizer",
        recommended_price=midpoint,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.15,
        confidence=0.83,
        drivers=[f"Corridor ₹{band['min']:.0f}–₹{band['max']:.0f}", "Midpoint hold"],
        rationale="Stay inside the elasticity-validated corridor; minimal volatility, predictable margin.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_bundle(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    # Bundle = effective price slightly below current, but AOV up
    price = p["current_price"] * 0.95
    return _scorecard(
        name="Bundle Pricing",
        recommended_price=price,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.30,
        confidence=0.70,
        drivers=["Pair with hero SKU", "AOV uplift"],
        rationale="Bundle with a complementary fast-mover — small per-unit discount, larger basket.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_ab_test(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    optimal = ml["recommended_price_band"]["optimal"]
    return _scorecard(
        name="A/B Test",
        recommended_price=optimal,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.10,
        confidence=0.65,
        drivers=["50/50 split traffic", "2-week test window"],
        rationale="Run an A/B test against optimal price; only commit if uplift > 5% with p<0.05.",
        horizon_days=ctx.get("horizon_days", 30),
    )


def strategy_stock_liquidation(p: Dict, ml: Dict, ctx: Dict) -> Dict:
    days_cover = ml["inventory_risk"]["days_of_cover"]
    discount_pct = min(40, max(10, days_cover / 8))
    price = p["current_price"] * (1 - discount_pct / 100)
    price = max(price, p["cost_price"])
    return _scorecard(
        name="Stock Liquidation",
        recommended_price=price,
        current_price=p["current_price"],
        cost_price=p["cost_price"],
        base_units_30d=p.get("sales_30d", 0),
        elasticity=ml["elasticity_score"],
        risk=0.35,
        confidence=0.78,
        drivers=[f"{days_cover:.0f}d of cover", "Free up working capital"],
        rationale="Heavy discount to flush aged inventory and recapture warehouse space.",
        horizon_days=ctx.get("horizon_days", 30),
    )


# ── Public API ───────────────────────────────────────────────────────────────


STRATEGY_FNS = [
    strategy_cost_plus,
    strategy_competitor_match,
    strategy_markdown_optimization,
    strategy_premium,
    strategy_penetration,
    strategy_clearance,
    strategy_psychological,
    strategy_price_corridor,
    strategy_bundle,
    strategy_ab_test,
    strategy_stock_liquidation,
]


def _objective_score(strategy: Dict, objective: str) -> float:
    """Score a strategy 0–100 against the user-selected objective."""
    rev_uplift = strategy["expected_revenue_uplift_pct"]
    margin = strategy["expected_margin_pct"]
    risk = strategy["risk_score"]
    units = strategy["expected_units"]

    if objective == "maximize_revenue":
        return max(0, min(100, 50 + rev_uplift * 2 - risk * 20))
    if objective == "maximize_margin":
        return max(0, min(100, margin * 0.9 + (10 - risk * 30)))
    if objective == "reduce_inventory":
        return max(0, min(100, 30 + units / 50 + (1 - risk) * 15))
    if objective == "win_market_share":
        return max(0, min(100, 30 + units / 80 + rev_uplift))
    return max(0, min(100, 50 + rev_uplift - risk * 30))


def generate_strategies(
    product: Dict[str, Any],
    ml_output: Dict[str, Any],
    objective: str = "maximize_revenue",
    horizon_days: int = 30,
    aggressiveness: float = 0.5,
    top_k: int = 5,
) -> Dict[str, Any]:
    """Generate ranked strategy candidates."""
    ctx = {
        "objective": objective,
        "horizon_days": horizon_days,
        "aggressiveness": aggressiveness,
    }

    candidates: List[Dict] = []
    for fn in STRATEGY_FNS:
        try:
            s = fn(product, ml_output, ctx)
            s["objective_score"] = round(_objective_score(s, objective), 1)
            candidates.append(s)
        except Exception as e:  # noqa: BLE001
            candidates.append({
                "name": fn.__name__.replace("strategy_", "").replace("_", " ").title(),
                "error": f"{type(e).__name__}: {e}",
            })

    # Rank by objective score
    valid = [c for c in candidates if "error" not in c]
    valid.sort(key=lambda c: c["objective_score"], reverse=True)
    top = valid[:top_k]

    return {
        "product_id": product.get("id"),
        "objective": objective,
        "horizon_days": horizon_days,
        "aggressiveness": aggressiveness,
        "strategies": top,
        "all_candidates_count": len(valid),
    }
