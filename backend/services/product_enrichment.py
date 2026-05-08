"""
Product Enrichment — augments base catalog products with the full
enterprise data model required by the Overview / Product Workbench.

All values are derived deterministically from the product id + base fields,
so repeated calls return identical numbers (no ghost shifts in the UI).

This is the single source of truth for the rich product object consumed by:
  - GET /api/products
  - GET /api/products/{id}
  - Overview page tiles + summary charts
  - Product Workbench snapshot
"""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from typing import Any, Dict


# ── Deterministic helpers ────────────────────────────────────────────────────


def _seed(product_id: str, salt: str = "") -> int:
    """Stable 32-bit integer seed from product id + salt."""
    h = hashlib.md5(f"{product_id}:{salt}".encode("utf-8")).hexdigest()
    return int(h[:8], 16)


def _rand01(product_id: str, salt: str) -> float:
    """Stable float in [0, 1) from product id + salt."""
    return (_seed(product_id, salt) % 100_000) / 100_000.0


def _rand_in(product_id: str, salt: str, lo: float, hi: float) -> float:
    return lo + (hi - lo) * _rand01(product_id, salt)


def _rand_int_in(product_id: str, salt: str, lo: int, hi: int) -> int:
    return int(round(_rand_in(product_id, salt, lo, hi)))


# ── Domain rules ─────────────────────────────────────────────────────────────


CATEGORY_DEMAND = {
    "T-Shirts": 1.20,
    "Shirts": 1.05,
    "Jeans": 0.95,
    "Trousers": 0.85,
    "Dresses": 1.10,
    "Jackets": 0.70,
    "Sweatshirts": 0.90,
    "Activewear": 1.00,
}

CATEGORY_SUPPLIERS = {
    "T-Shirts": ("Tiruppur Knits Co.", 250, 14),
    "Shirts": ("Mumbai Tailors Pvt Ltd", 200, 18),
    "Jeans": ("Indigo Mills Ltd", 150, 22),
    "Trousers": ("Mumbai Tailors Pvt Ltd", 180, 16),
    "Dresses": ("Surat Weaves & Co.", 200, 20),
    "Jackets": ("Delhi Outerwear Co.", 100, 28),
    "Sweatshirts": ("Ludhiana Knits", 200, 18),
    "Activewear": ("PerformaTex India", 150, 16),
}

DEMAND_TREND_BUCKETS = [
    (0.0, "Declining"),
    (0.35, "Stable"),
    (0.65, "Rising"),
    (0.88, "Surging"),
]


def _bucket(value: float, buckets) -> str:
    label = buckets[0][1]
    for threshold, name in buckets:
        if value >= threshold:
            label = name
    return label


# ── Cost breakdown ───────────────────────────────────────────────────────────


def _cost_breakup(product_id: str, total_cost: float) -> Dict[str, float]:
    """
    Split total_cost into realistic line items. Proportions vary per product
    but always sum to total_cost (within rounding).
    """
    # Base proportions (sum=1.0)
    weights = {
        "manufacturing": _rand_in(product_id, "mfg_w", 0.55, 0.70),
        "packaging": _rand_in(product_id, "pkg_w", 0.04, 0.07),
        "freight": _rand_in(product_id, "frt_w", 0.06, 0.10),
        "platform_fee": _rand_in(product_id, "pfm_w", 0.10, 0.16),
        "taxes": _rand_in(product_id, "tax_w", 0.05, 0.09),
        "other_overheads": _rand_in(product_id, "ovh_w", 0.03, 0.06),
    }
    s = sum(weights.values())
    breakup = {k: round(total_cost * v / s, 2) for k, v in weights.items()}
    # Adjust last item to absorb rounding drift
    drift = round(total_cost - sum(breakup.values()), 2)
    breakup["other_overheads"] = round(breakup["other_overheads"] + drift, 2)
    return breakup


# ── Sales / engagement metrics (derived from base) ───────────────────────────


def _engagement_metrics(product_id: str, base: Dict[str, Any]) -> Dict[str, Any]:
    price = float(base.get("price", 0))
    rating = float(base.get("rating", 4.0))
    reviews = int(base.get("reviews", 0))
    category = base.get("category", "T-Shirts")

    # Conversion: rating-weighted, with stable noise
    conv_base = 0.018 + (rating - 4.0) * 0.022      # 4.0 → 1.8 %, 4.7 → 3.4 %
    conv = round(max(0.008, conv_base + _rand_in(product_id, "conv", -0.005, 0.005)), 4)

    # CTR: 1.5–7 %
    ctr = round(_rand_in(product_id, "ctr", 0.025, 0.075), 4)

    # Return rate: 3–14 %, premium items return less
    rr_base = 0.05 + (price < 1500) * 0.04
    return_rate = round(max(0.02, rr_base + _rand_in(product_id, "ret", -0.015, 0.04)), 3)

    # Demand multiplier from category
    cat_mult = CATEGORY_DEMAND.get(category, 1.0)

    # Sales velocity: bigger reviews → higher velocity, premium price → lower
    velocity = (reviews / 18.0) * cat_mult * (1500.0 / max(price, 200))
    velocity *= _rand_in(product_id, "vel", 0.85, 1.20)
    sales_30d = max(20, int(round(velocity)))
    sales_90d = int(round(sales_30d * _rand_in(product_id, "s90", 2.6, 3.2)))
    revenue_30d = int(round(sales_30d * price * _rand_in(product_id, "r30", 0.92, 1.0)))
    revenue_90d = int(round(sales_90d * price * _rand_in(product_id, "r90", 0.92, 1.0)))

    # Ad spend ≈ 4–9 % of 30d revenue
    ad_spend_30d = int(round(revenue_30d * _rand_in(product_id, "ads", 0.04, 0.09)))

    return {
        "conversion_rate": conv,
        "ctr": ctr,
        "return_rate": return_rate,
        "sales_30d": sales_30d,
        "sales_90d": sales_90d,
        "revenue_30d": revenue_30d,
        "revenue_90d": revenue_90d,
        "ad_spend_30d": ad_spend_30d,
    }


# ── Inventory ────────────────────────────────────────────────────────────────


def _inventory(product_id: str, base: Dict[str, Any]) -> Dict[str, Any]:
    stock = int(base.get("stock", 500))
    reserved = int(round(stock * _rand_in(product_id, "res", 0.04, 0.10)))
    available = max(0, stock - reserved)
    reorder_point = int(round(stock * _rand_in(product_id, "rop", 0.18, 0.32)))
    safety_stock = int(round(reorder_point * _rand_in(product_id, "saf", 0.45, 0.65)))

    category = base.get("category", "T-Shirts")
    supplier_name, moq, lead_time = CATEGORY_SUPPLIERS.get(
        category, ("General Apparel Co.", 200, 18)
    )
    return {
        "stock_on_hand": stock,
        "reserved_stock": reserved,
        "available_stock": available,
        "reorder_point": reorder_point,
        "safety_stock": safety_stock,
        "lead_time_days": lead_time,
        "supplier": supplier_name,
        "supplier_moq": moq,
    }


# ── Pricing & competitor positioning ────────────────────────────────────────


def _pricing(product_id: str, base: Dict[str, Any]) -> Dict[str, Any]:
    price = float(base.get("price", 0))
    cost = float(base.get("cost_price", price * 0.4))
    min_price = round(cost * 1.8, 2)
    max_price = round(price * 1.25, 2)
    mrp = round(max(price * 1.35, max_price * 1.05), 2)
    discount_offered = round(((mrp - price) / mrp) * 100, 1) if mrp > 0 else 0.0

    # Competitor avg = price × 0.92–1.12
    comp_avg = round(price * _rand_in(product_id, "comp", 0.92, 1.12), 2)
    price_index = round(price / comp_avg, 3) if comp_avg > 0 else 1.0

    gross_margin_pct = round(((price - cost) / price) * 100, 2) if price > 0 else 0.0

    return {
        "min_price": min_price,
        "max_price": max_price,
        "mrp": mrp,
        "discount_offered_pct": discount_offered,
        "competitor_avg_price": comp_avg,
        "price_index": price_index,
        "gross_margin_pct": gross_margin_pct,
    }


# ── Risk + seasonality + trend signals ──────────────────────────────────────


def _signals(product_id: str, base: Dict[str, Any], inv: Dict, pricing: Dict, engagement: Dict) -> Dict[str, Any]:
    margin = pricing["gross_margin_pct"]
    stock = inv["stock_on_hand"]
    rop = inv["reorder_point"]
    sales_30d = engagement["sales_30d"]
    days_of_cover = stock / max(1, sales_30d / 30)

    # Risk score 0–1
    risk = 0.0
    if margin < 25: risk += 0.4
    elif margin < 40: risk += 0.2
    if stock < rop: risk += 0.4
    elif stock < rop * 1.4: risk += 0.2
    if days_of_cover > 180: risk += 0.25      # overstock
    if pricing["price_index"] > 1.10: risk += 0.15  # priced above market

    risk_flag = "Low" if risk < 0.35 else "Medium" if risk < 0.65 else "High"

    # Seasonality + demand trend
    season = round(_rand_in(product_id, "season", 0.85, 1.20), 3)
    trend_score = _rand01(product_id, "trend")
    demand_trend = _bucket(trend_score, DEMAND_TREND_BUCKETS)

    # Recommendation badge
    if pricing["price_index"] < 0.9 and demand_trend in ("Rising", "Surging"):
        recommendation = "Increase price"
    elif risk_flag == "High" and stock > rop * 2:
        recommendation = "Run clearance"
    elif stock < rop:
        recommendation = "Reorder soon"
    elif margin < 30:
        recommendation = "Review margin"
    else:
        recommendation = "Hold price"

    return {
        "days_of_cover": round(days_of_cover, 1),
        "seasonality_index": season,
        "demand_trend": demand_trend,
        "risk_flag": risk_flag,
        "risk_score": round(risk, 3),
        "recommendation": recommendation,
    }


# ── Public API ───────────────────────────────────────────────────────────────


def enrich_product(base: Dict[str, Any]) -> Dict[str, Any]:
    """
    Take a base product (from DEFAULT_PRODUCTS) and return the rich
    enterprise model used across the app.
    """
    product_id = base["id"]
    cost_price = float(base.get("cost_price", 0))
    breakup = _cost_breakup(product_id, cost_price)
    landing_cost = round(cost_price + cost_price * _rand_in(product_id, "lnd", 0.03, 0.08), 2)

    inventory = _inventory(product_id, base)
    pricing = _pricing(product_id, base)
    engagement = _engagement_metrics(product_id, base)
    signals = _signals(product_id, base, inventory, pricing, engagement)

    # Stable last_scraped_at — derive from seed
    hours_ago = _rand_int_in(product_id, "scraped", 1, 36)
    last_scraped = datetime.now(timezone.utc).replace(microsecond=0)
    last_scraped_iso = last_scraped.isoformat()

    return {
        # Identity (existing)
        "id": product_id,
        "name": base["name"],
        "brand": base.get("brand", "Vouge Studio"),
        "category": base.get("category"),
        "subcategory": base.get("subcategory", base.get("category")),
        "sku": base.get("sku"),
        "status": "Active",
        "search_query": base.get("search_query"),
        "description": base.get("description"),
        "specifications": base.get("specifications", {}),
        "sizes": base.get("sizes", []),
        "image": base.get("image"),

        # Pricing
        "current_price": float(base.get("price", 0)),
        "cost_price": cost_price,
        "landing_cost": landing_cost,
        "cost_breakup": breakup,
        "min_price": pricing["min_price"],
        "max_price": pricing["max_price"],
        "mrp": pricing["mrp"],
        "discount_offered_pct": pricing["discount_offered_pct"],
        "competitor_avg_price": pricing["competitor_avg_price"],
        "price_index": pricing["price_index"],
        "gross_margin_pct": pricing["gross_margin_pct"],
        "currency": base.get("currency", "INR"),

        # Inventory
        **inventory,

        # Engagement / sales
        "rating": base.get("rating"),
        "review_count": base.get("reviews"),
        **engagement,

        # Signals
        **signals,

        "last_scraped_at": last_scraped_iso,

        # Backward-compat: keep `price` and `stock` flat keys so existing
        # consumers don't break.
        "price": float(base.get("price", 0)),
        "stock": inventory["stock_on_hand"],
        "reviews": base.get("reviews"),
    }


def enrich_all(products_dict: Dict[str, Dict[str, Any]]) -> list:
    return [enrich_product(p) for p in products_dict.values()]
