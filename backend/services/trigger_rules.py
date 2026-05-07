"""Trigger Rules Generator — automated pricing condition/action pairs.

generate_triggers(archetype, comp_stats, features) → list of 2–4 rule dicts.

Each rule dict:
    condition   — human-readable string with actual rupee values
    action      — description string
    value       — target price float (rupees)
    priority    — "HIGH" | "MEDIUM" | "LOW"
"""
from typing import List, Dict, Any


def generate_triggers(
    archetype: str,
    comp_stats: Dict[str, Any],
    features: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Build 2–4 trigger rule dicts for automated repricing decisions.

    Universal rules are always included; then 1 archetype-specific rule is appended.
    """
    current_price = float(features["current_price"])
    comp_avg      = float(comp_stats.get("avg_price", current_price))
    comp_p25      = float(comp_stats.get("p25", comp_avg * 0.90))

    rules: List[Dict[str, Any]] = []

    # ── Universal Rule 1 — Competitor undercut defence ───────────────────────
    drop_target = round(comp_p25 * 1.02, 2)
    rules.append({
        "condition": (
            f"competitor_avg < ₹{comp_p25:.0f} "
            f"(25th-percentile competitor price)"
        ),
        "action": (
            f"Drop price to ₹{drop_target:.0f} "
            f"(comp p25 × 1.02) to remain competitive"
        ),
        "value":    drop_target,
        "priority": "HIGH",
    })

    # ── Universal Rule 2 — Low stock + high demand surge ─────────────────────
    surge_target = round(current_price * 1.08, 2)
    rules.append({
        "condition": "stock < 30 AND demand_7d > 40 units/day",
        "action": (
            f"Raise price to ₹{surge_target:.0f} "
            f"(current × 1.08) to capture scarcity premium"
        ),
        "value":    surge_target,
        "priority": "MEDIUM",
    })

    # ── Archetype-specific rule ───────────────────────────────────────────────

    if archetype == "PENETRATION":
        growth_target = round(current_price * 1.05, 2)
        rules.append({
            "condition": "demand_7d_growth > 20% week-over-week",
            "action": (
                f"Raise price to ₹{growth_target:.0f} "
                f"(current × 1.05) — growth validates higher price"
            ),
            "value":    growth_target,
            "priority": "MEDIUM",
        })

    elif archetype == "CLEARANCE":
        markdown_target = round(current_price * 0.85, 2)
        rules.append({
            "condition": "days_on_shelf > 30 AND sell_through < 50%",
            "action": (
                f"Apply markdown to ₹{markdown_target:.0f} "
                f"(current × 0.85) — urgency discount"
            ),
            "value":    markdown_target,
            "priority": "HIGH",
        })

    elif archetype == "PREMIUM":
        premium_target = round(current_price * 1.10, 2)
        comp_high      = round(comp_avg * 1.15, 2)
        rules.append({
            "condition": (
                f"competitor_avg > ₹{comp_high:.0f} "
                f"(competitor avg × 1.15)"
            ),
            "action": (
                f"Raise price to ₹{premium_target:.0f} "
                f"(current × 1.10) — competitors validating premium tier"
            ),
            "value":    premium_target,
            "priority": "LOW",
        })

    elif archetype == "SKIM":
        skim_target = round(current_price * 1.10, 2)
        rules.append({
            "condition": "stock < 20 units",
            "action": (
                f"Raise price to ₹{skim_target:.0f} "
                f"(current × 1.10) — scarcity maximises margin"
            ),
            "value":    skim_target,
            "priority": "HIGH",
        })

    elif archetype == "COMPETITIVE_MATCH":
        match_target = round(comp_avg * 1.02, 2)
        drop_10_pct  = round(comp_avg * 0.90, 2)
        rules.append({
            "condition": (
                f"competitor_avg drops more than 10% "
                f"(below ₹{drop_10_pct:.0f})"
            ),
            "action": (
                f"Match competitor at ₹{match_target:.0f} "
                f"(comp_avg × 1.02)"
            ),
            "value":    match_target,
            "priority": "HIGH",
        })

    else:
        # HOLD — add a gentle floor rule
        hold_floor = round(current_price * 0.95, 2)
        rules.append({
            "condition": "demand_7d drops more than 15% week-over-week",
            "action": (
                f"Review price — consider dropping to ₹{hold_floor:.0f} "
                f"(current × 0.95) to stimulate demand"
            ),
            "value":    hold_floor,
            "priority": "LOW",
        })

    return rules
