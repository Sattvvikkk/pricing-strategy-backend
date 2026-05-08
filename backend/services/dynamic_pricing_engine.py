"""
Dynamic Pricing Engine — final decision layer.

Takes the full intelligence stack (enriched product + ML orchestrator output +
strategy candidates) and produces ONE concrete price recommendation with:

  - Guardrails enforced (never below cost, brand ceiling, max delta, etc.)
  - Reason codes
  - Confidence score
  - Expected revenue/margin uplift
  - Approval flag (auto-applied vs needs review)
  - Audit log entry written for every decision
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional


# ── Defaults ────────────────────────────────────────────────────────────────


DEFAULT_CONSTRAINTS = {
    "min_margin_pct": 25.0,            # never go below this gross margin
    "max_price_change_pct": 12.0,      # cap single-step move
    "brand_ceiling_pct": 35.0,         # cap markup over MRP-implied ceiling
    "respect_min_price": True,         # never below product.min_price
    "respect_max_price": True,         # never above product.max_price
    "auto_apply_threshold_pct": 4.0,   # changes <= this auto-apply
    "min_confidence_for_auto": 0.75,
    "clearance_mode": False,           # if True, allow below-min for liquidation
}


@dataclass
class GuardrailResult:
    name: str
    passed: bool
    detail: str

    def to_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "passed": self.passed, "detail": self.detail}


@dataclass
class EngineDecision:
    product_id: str
    current_price: float
    recommended_price: float
    delta: float
    delta_pct: float
    reason_codes: List[str]
    confidence_score: float
    expected_revenue_uplift_pct: float
    expected_margin_uplift_pct: float
    guardrails: List[GuardrailResult]
    approval_required: bool
    auto_applied: bool
    rollout: Dict[str, Any]
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "product_id": self.product_id,
            "current_price": round(self.current_price, 2),
            "recommended_price": round(self.recommended_price, 2),
            "delta": round(self.delta, 2),
            "delta_pct": round(self.delta_pct, 2),
            "reason_codes": self.reason_codes,
            "confidence_score": round(self.confidence_score, 3),
            "expected_revenue_uplift_pct": round(self.expected_revenue_uplift_pct, 2),
            "expected_margin_uplift_pct": round(self.expected_margin_uplift_pct, 2),
            "guardrails": [g.to_dict() for g in self.guardrails],
            "approval_required": self.approval_required,
            "auto_applied": self.auto_applied,
            "rollout": self.rollout,
            "timestamp": self.timestamp,
        }


# ── In-memory audit log (thread-safe) ───────────────────────────────────────


_audit_lock = Lock()
_audit_log: List[Dict[str, Any]] = []
_AUDIT_MAX_SIZE = 500


def _record_audit(entry: Dict[str, Any]) -> None:
    with _audit_lock:
        _audit_log.append(entry)
        if len(_audit_log) > _AUDIT_MAX_SIZE:
            _audit_log[:] = _audit_log[-_AUDIT_MAX_SIZE:]


def get_audit_log(product_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    with _audit_lock:
        items = list(_audit_log)
    if product_id:
        items = [a for a in items if a.get("product_id") == product_id]
    return items[-limit:][::-1]   # newest first


# ── Guardrails ──────────────────────────────────────────────────────────────


def _evaluate_guardrails(
    product: Dict[str, Any],
    candidate_price: float,
    constraints: Dict[str, Any],
) -> List[GuardrailResult]:
    out: List[GuardrailResult] = []

    cost = float(product.get("cost_price", 0))
    current = float(product.get("current_price", 0))
    min_price = float(product.get("min_price", 0))
    max_price = float(product.get("max_price", 0))

    # 1. Margin floor
    margin_pct = ((candidate_price - cost) / candidate_price) * 100 if candidate_price > 0 else 0
    floor = constraints.get("min_margin_pct", 25.0)
    if constraints.get("clearance_mode"):
        floor = min(floor, 5.0)
    out.append(GuardrailResult(
        name="margin_floor",
        passed=margin_pct >= floor,
        detail=f"Margin {margin_pct:.1f}% vs floor {floor:.1f}%",
    ))

    # 2. Max single-step change
    delta_pct = abs(((candidate_price - current) / current) * 100) if current > 0 else 0
    cap = constraints.get("max_price_change_pct", 12.0)
    out.append(GuardrailResult(
        name="max_step_change",
        passed=delta_pct <= cap,
        detail=f"Move {delta_pct:.1f}% vs cap {cap:.1f}%",
    ))

    # 3. Min price floor (catalog-defined)
    if constraints.get("respect_min_price", True) and min_price > 0:
        out.append(GuardrailResult(
            name="min_price_floor",
            passed=candidate_price >= min_price or constraints.get("clearance_mode", False),
            detail=f"₹{candidate_price:.0f} vs catalog min ₹{min_price:.0f}",
        ))

    # 4. Max price ceiling (catalog-defined)
    if constraints.get("respect_max_price", True) and max_price > 0:
        out.append(GuardrailResult(
            name="max_price_ceiling",
            passed=candidate_price <= max_price,
            detail=f"₹{candidate_price:.0f} vs catalog max ₹{max_price:.0f}",
        ))

    # 5. Never below cost (hard rule, even in clearance unless explicitly allowed)
    out.append(GuardrailResult(
        name="above_cost",
        passed=candidate_price > cost,
        detail=f"₹{candidate_price:.0f} vs cost ₹{cost:.0f}",
    ))

    # 6. Low-stock protection (don't slash price when stock is critical)
    stock = int(product.get("stock_on_hand", 0))
    reorder = int(product.get("reorder_point", 0))
    if stock < reorder and candidate_price < current:
        out.append(GuardrailResult(
            name="low_stock_protection",
            passed=False,
            detail=f"Stock {stock} below reorder {reorder} — discount blocked",
        ))
    else:
        out.append(GuardrailResult(
            name="low_stock_protection",
            passed=True,
            detail="OK",
        ))

    return out


def _enforce_guardrails(candidate_price: float, product: Dict, constraints: Dict) -> float:
    """Adjust the candidate price to satisfy all guardrails (clamp)."""
    cost = float(product.get("cost_price", 0))
    current = float(product.get("current_price", 0))
    min_p = float(product.get("min_price", cost * 1.25))
    max_p = float(product.get("max_price", current * 1.5))

    # Above cost (always)
    candidate_price = max(candidate_price, cost * 1.05)

    # Margin floor
    floor = constraints.get("min_margin_pct", 25.0)
    if constraints.get("clearance_mode"):
        floor = min(floor, 5.0)
    margin_floor_price = cost / (1 - floor / 100) if floor < 100 else cost * 2
    candidate_price = max(candidate_price, margin_floor_price)

    # Catalog floors
    if constraints.get("respect_min_price", True) and not constraints.get("clearance_mode"):
        candidate_price = max(candidate_price, min_p)
    if constraints.get("respect_max_price", True):
        candidate_price = min(candidate_price, max_p)

    # Max step change
    cap = constraints.get("max_price_change_pct", 12.0)
    if current > 0:
        candidate_price = max(min(candidate_price, current * (1 + cap / 100)),
                              current * (1 - cap / 100))

    # Low-stock: no discount
    stock = int(product.get("stock_on_hand", 0))
    reorder = int(product.get("reorder_point", 0))
    if stock < reorder:
        candidate_price = max(candidate_price, current)

    return round(candidate_price, 2)


# ── Decision logic ──────────────────────────────────────────────────────────


def _derive_target_price(product: Dict, ml_output: Dict) -> tuple[float, List[str]]:
    """Pick a target price from ML signals + reason codes explaining why."""
    reasons: List[str] = []

    band = ml_output.get("recommended_price_band") or {}
    rec = ml_output.get("recommended_action") or {}
    inv_risk = ml_output.get("inventory_risk") or {}
    comp = ml_output.get("competitor_response") or {}
    elasticity = ml_output.get("elasticity_score", -1.5)
    current = float(product.get("current_price", 0))

    # Start from ML recommended action's price if available
    target = rec.get("recommended_price") or band.get("optimal") or current

    # Reason codes
    if inv_risk.get("urgency") == "Critical":
        reasons.append("Stockout imminent — protective price hold/lift")
    if inv_risk.get("overstock_probability", 0) > 0.4:
        reasons.append("Overstock risk — markdown to liquidate")
    if comp.get("price_index", 1) < 0.95:
        reasons.append(f"Priced {int((1 - comp['price_index']) * 100)}% below market — room to lift")
    elif comp.get("price_index", 1) > 1.08:
        reasons.append(f"Priced {int((comp['price_index'] - 1) * 100)}% above market — share at risk")
    if elasticity < -1.5:
        reasons.append(f"Elastic demand ({elasticity:.2f}) — price moves drive volume")
    elif elasticity > -0.8:
        reasons.append(f"Inelastic demand ({elasticity:.2f}) — pricing power available")

    if not reasons:
        reasons.append("Holding optimal price band — no significant signal")

    return float(target), reasons


def _rollout_plan(delta_pct: float, constraints: Dict) -> Dict[str, Any]:
    """Suggest a rollout based on the size of the move."""
    abs_delta = abs(delta_pct)
    if abs_delta == 0:
        return {"phase": "Hold", "schedule": "No change needed"}
    if abs_delta < 3:
        return {"phase": "Single-step", "schedule": "Apply immediately, monitor 7d"}
    if abs_delta < 7:
        return {"phase": "Two-step", "schedule": "Apply 50% now, remaining in 7d"}
    return {"phase": "Phased", "schedule": "Apply 33% now, 33% in 7d, 34% in 14d"}


def optimize(
    product: Dict[str, Any],
    ml_output: Dict[str, Any],
    constraints: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Main entry — returns a single dynamic pricing decision."""
    cons = {**DEFAULT_CONSTRAINTS, **(constraints or {})}
    current = float(product.get("current_price", 0))
    cost = float(product.get("cost_price", 0))
    sales_30d = int(product.get("sales_30d", 0))

    # 1. Pick target from ML
    target, reasons = _derive_target_price(product, ml_output)

    # 2. Enforce guardrails (clamp into legal range)
    final_price = _enforce_guardrails(target, product, cons)

    # 3. Evaluate which guardrails the FINAL price satisfies (post-clamp)
    guardrails = _evaluate_guardrails(product, final_price, cons)
    all_passed = all(g.passed for g in guardrails)

    delta = final_price - current
    delta_pct = (delta / current) * 100 if current > 0 else 0

    # 4. Expected impact (elasticity-driven)
    elasticity = ml_output.get("elasticity_score", -1.5)
    demand_mult = 1 + (elasticity * delta_pct) / 100
    new_demand = max(0, sales_30d * demand_mult)
    new_revenue = new_demand * final_price
    base_revenue = sales_30d * current
    revenue_uplift = ((new_revenue - base_revenue) / base_revenue * 100) if base_revenue > 0 else 0

    new_margin_pct = ((final_price - cost) / final_price) * 100 if final_price > 0 else 0
    base_margin_pct = ((current - cost) / current) * 100 if current > 0 else 0
    margin_uplift = new_margin_pct - base_margin_pct

    # 5. Confidence — blend ML confidence + guardrail compliance
    ml_confidence = ml_output.get("confidence_score", 0.7)
    confidence = ml_confidence * (1.0 if all_passed else 0.7)

    # 6. Auto-apply or require approval
    auto_apply_threshold = cons.get("auto_apply_threshold_pct", 4.0)
    min_conf = cons.get("min_confidence_for_auto", 0.75)
    auto_apply = (
        all_passed
        and abs(delta_pct) <= auto_apply_threshold
        and confidence >= min_conf
    )
    approval_required = not auto_apply

    decision = EngineDecision(
        product_id=product.get("id", ""),
        current_price=current,
        recommended_price=final_price,
        delta=delta,
        delta_pct=delta_pct,
        reason_codes=reasons,
        confidence_score=confidence,
        expected_revenue_uplift_pct=revenue_uplift,
        expected_margin_uplift_pct=margin_uplift,
        guardrails=guardrails,
        approval_required=approval_required,
        auto_applied=auto_apply,
        rollout=_rollout_plan(delta_pct, cons),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    # 7. Write audit log
    audit = decision.to_dict()
    audit["constraints_applied"] = cons
    _record_audit(audit)

    return decision.to_dict()


def apply_override(
    product: Dict[str, Any],
    new_price: float,
    actor: str = "user",
    note: str = "",
) -> Dict[str, Any]:
    """Manual override — records to audit log."""
    current = float(product.get("current_price", 0))
    delta = new_price - current
    delta_pct = (delta / current) * 100 if current > 0 else 0

    entry = {
        "type": "manual_override",
        "product_id": product.get("id"),
        "actor": actor,
        "note": note,
        "current_price": round(current, 2),
        "recommended_price": round(new_price, 2),
        "delta": round(delta, 2),
        "delta_pct": round(delta_pct, 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "auto_applied": False,
        "approval_required": True,
    }
    _record_audit(entry)
    return entry
