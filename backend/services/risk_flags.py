"""Risk Flags Generator — detects pricing and market risk conditions.

generate_risk_flags(features, comp_stats, archetype) → list of flag dicts.

Each flag dict:
    severity  — "CRITICAL" | "WARNING" | "INFO"
    message   — human-readable description

Checks performed:
    1. Price below cost                 → CRITICAL
    2. Gross margin below 15%           → WARNING
    3. Stock below 15 units             → WARNING
    4. Competitor data older than 7 days → INFO
    5. Elasticity more negative than -2.5 → WARNING
    6. Recommended price > 25% below current → WARNING
"""
from typing import List, Dict, Any
from datetime import datetime, timezone


def generate_risk_flags(
    features: Dict[str, Any],
    comp_stats: Dict[str, Any],
    archetype: str,
) -> List[Dict[str, Any]]:
    """
    Evaluate product state and return a (possibly empty) list of risk flag dicts.
    """
    flags: List[Dict[str, Any]] = []

    current_price      = float(features.get("current_price", 0))
    cost_price         = float(features.get("cost_price", 0))
    stock              = int(features.get("stock", 999))
    elasticity         = float(features.get("elasticity", -1.0))
    recommended_price  = float(features.get("recommended_price", current_price))
    last_scraped_at    = features.get("competitor_last_scraped_at")  # ISO str or None

    # Derived margin on the recommended price
    margin_pct = (
        (recommended_price - cost_price) / recommended_price
        if recommended_price > 0 else 0.0
    )

    # ── 1. Price below cost ──────────────────────────────────────────────────
    if recommended_price < cost_price:
        flags.append({
            "severity": "CRITICAL",
            "message":  (
                "Recommended price is below cost price — "
                "you would lose money on every sale"
            ),
        })

    # ── 2. Margin below 15% ──────────────────────────────────────────────────
    if 0 < margin_pct < 0.15 and recommended_price >= cost_price:
        flags.append({
            "severity": "WARNING",
            "message":  (
                f"Gross margin is {margin_pct:.1%} — "
                "very thin buffer for returns and discounts"
            ),
        })

    # ── 3. Stock critically low ──────────────────────────────────────────────
    if stock < 15:
        flags.append({
            "severity": "WARNING",
            "message":  (
                f"Stock critically low ({stock} units) — "
                "strategy may not complete before stockout"
            ),
        })

    # ── 4. Stale competitor data ─────────────────────────────────────────────
    if last_scraped_at is None:
        # No recorded scrape at all — treat as stale
        flags.append({
            "severity": "INFO",
            "message":  (
                "Competitor data is more than 7 days old — "
                "recommendation uses stale market data"
            ),
        })
    else:
        try:
            if isinstance(last_scraped_at, str):
                scraped_dt = datetime.fromisoformat(last_scraped_at.replace("Z", "+00:00"))
            else:
                scraped_dt = last_scraped_at
            # Make timezone-aware if naive
            if scraped_dt.tzinfo is None:
                scraped_dt = scraped_dt.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - scraped_dt).days
            if age_days >= 7:
                flags.append({
                    "severity": "INFO",
                    "message":  (
                        f"Competitor data is {age_days} days old — "
                        "recommendation uses stale market data"
                    ),
                })
        except Exception:
            pass  # Unparseable timestamp — skip the stale-data flag

    # ── 5. Highly elastic demand ─────────────────────────────────────────────
    if elasticity < -2.5:
        flags.append({
            "severity": "WARNING",
            "message":  (
                f"Demand is highly elastic (elasticity {elasticity:.2f}) — "
                "small price changes will cause large demand swings"
            ),
        })

    # ── 6. Significant price drop ────────────────────────────────────────────
    if current_price > 0:
        drop_pct = (current_price - recommended_price) / current_price
        if drop_pct > 0.25:
            flags.append({
                "severity": "WARNING",
                "message":  (
                    f"Recommendation is a {drop_pct:.0%} price drop — "
                    "consider impact on brand perception"
                ),
            })

    return flags
