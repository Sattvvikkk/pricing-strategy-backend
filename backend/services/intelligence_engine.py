"""AI Data Intelligence Layer — 8 signal categories per product.

Public API
----------
compute_all_signals(product, sales_df, comp_df)  → dict with 8 signal blocks
Each signal block: { score, status, headline, metrics, insights, recommendations, sparkline }
"""
import math
from datetime import date, datetime, timedelta
from typing import Dict, Any, List

import numpy as np
import pandas as pd


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clamp(val: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, val))


def _status(score: float) -> str:
    if score >= 72:
        return "GOOD"
    if score >= 45:
        return "WARN"
    return "RISK"


def _sparkline(series: pd.Series, n: int = 14) -> List[float]:
    """Return last n values as a rounded list."""
    s = series.dropna().tail(n).tolist()
    return [round(float(v), 2) for v in s]


# ── Indian festival calendar (approximate) ────────────────────────────────────

_FESTIVALS = [
    # (month, day_start, day_end, name, multiplier)
    (1,  14, 15, "Makar Sankranti", 1.12),
    (2,  14, 14, "Valentine's Day",  1.20),
    (3,  25, 30, "Holi Week",        1.18),
    (4,   9, 15, "Baisakhi / Eid",   1.10),
    (8,  15, 20, "Independence Day", 1.15),
    (9,   1, 15, "Navratri / Durga", 1.22),
    (10,  1, 31, "Festive Season",   1.35),   # Dussehra + Diwali
    (11,  1, 15, "Diwali Week",      1.40),
    (12, 20, 31, "Christmas / NYE",  1.25),
]


def _seasonal_multiplier(dt: date) -> float:
    for m, ds, de, name, mul in _FESTIVALS:
        if dt.month == m and ds <= dt.day <= de:
            return mul
    return 1.0


# ── 1. Pricing ─────────────────────────────────────────────────────────────────

def compute_pricing_intelligence(features: dict, comp_df: pd.DataFrame) -> dict:
    current_price = float(features.get("current_price", 799))
    cost_price    = float(features.get("cost_price", 350))

    if comp_df.empty or "price" not in comp_df.columns:
        comp_avg = current_price * 1.02
        comp_min = current_price * 0.90
        comp_max = current_price * 1.15
        platforms = 0
    else:
        comp_avg  = float(comp_df["price"].mean())
        comp_min  = float(comp_df["price"].min())
        comp_max  = float(comp_df["price"].max())
        platforms = int(comp_df["platform"].nunique()) if "platform" in comp_df.columns else 1

    price_index    = current_price / comp_avg if comp_avg > 0 else 1.0
    undercut_pct   = max(0, (comp_avg - current_price) / comp_avg * 100)
    margin_pct     = (current_price - cost_price) / current_price * 100 if current_price > 0 else 0
    volatility_pen = min(20, float(features.get("price_std", 0)) / current_price * 100)

    score = _clamp(100 - undercut_pct * 1.5 - volatility_pen)

    sparkline_prices = []
    if not comp_df.empty and "price" in comp_df.columns:
        sparkline_prices = _sparkline(comp_df["price"].reset_index(drop=True))

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": (
            f"₹{current_price:.0f} vs market avg ₹{comp_avg:.0f} "
            f"({'below' if price_index < 1 else 'above'} market by "
            f"{abs(1 - price_index) * 100:.1f}%)"
        ),
        "metrics": {
            "current_price":  round(current_price),
            "competitor_avg": round(comp_avg),
            "comp_min":       round(comp_min),
            "comp_max":       round(comp_max),
            "price_index":    round(price_index, 3),
            "undercut_pct":   round(undercut_pct, 1),
            "margin_pct":     round(margin_pct, 1),
            "platforms_tracked": platforms,
        },
        "insights": [
            f"Price index {price_index:.2f} — {'premium vs' if price_index > 1.05 else 'competitive with' if price_index > 0.95 else 'below'} market",
            f"Margin at {margin_pct:.1f}% ({('healthy' if margin_pct > 30 else 'thin' if margin_pct < 15 else 'moderate')})",
            f"Tracking {platforms} competitor platform(s)",
        ],
        "recommendations": [
            "Reduce price by 5% to improve conversion" if price_index > 1.10 else
            "Hold price — near-parity with competitors" if 0.92 < price_index <= 1.10 else
            "Consider raising price to capture margin",
        ],
        "sparkline": sparkline_prices,
    }


# ── 2. Demand ─────────────────────────────────────────────────────────────────

def compute_demand_intelligence(sales_df: pd.DataFrame) -> dict:
    if sales_df.empty:
        return {
            "score": 50, "status": "WARN", "headline": "Insufficient demand data",
            "metrics": {}, "insights": [], "recommendations": ["Seed sales data to enable demand analysis"],
            "sparkline": [],
        }

    df = sales_df.sort_values("date").copy()
    units = df["units_sold"].astype(float)
    ma7   = float(units.rolling(7,  min_periods=1).mean().iloc[-1])
    ma30  = float(units.rolling(30, min_periods=1).mean().iloc[-1])
    ma90  = float(units.rolling(90, min_periods=1).mean().iloc[-1])

    trend_7_30  = (ma7 - ma30)  / ma30  * 100 if ma30  > 0 else 0
    trend_30_90 = (ma30 - ma90) / ma90  * 100 if ma90  > 0 else 0
    peak_units  = float(units.max())
    velocity    = float(units.diff().tail(7).mean())

    # Score: strong short-term momentum = high score
    score = _clamp(60 + trend_7_30 * 1.2 + trend_30_90 * 0.5)

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": (
            f"7-day avg {ma7:.1f} units/day — "
            f"{'rising' if trend_7_30 > 3 else 'falling' if trend_7_30 < -3 else 'stable'} "
            f"vs 30-day avg"
        ),
        "metrics": {
            "demand_ma7":     round(ma7, 1),
            "demand_ma30":    round(ma30, 1),
            "demand_ma90":    round(ma90, 1),
            "trend_7_30_pct": round(trend_7_30, 1),
            "trend_30_90_pct": round(trend_30_90, 1),
            "peak_units":     round(peak_units),
            "velocity_7d":    round(velocity, 2),
        },
        "insights": [
            f"Short-term trend: {trend_7_30:+.1f}% vs 30-day baseline",
            f"Medium-term trend: {trend_30_90:+.1f}% vs 90-day baseline",
            f"Daily velocity (7d avg delta): {velocity:+.2f} units/day",
        ],
        "recommendations": [
            "Capitalize on rising demand — consider slight price increase" if trend_7_30 > 10 else
            "Demand softening — run promotion or increase visibility" if trend_7_30 < -10 else
            "Demand stable — maintain current price point",
        ],
        "sparkline": _sparkline(units, 21),
    }


# ── 3. Sales ──────────────────────────────────────────────────────────────────

def compute_sales_intelligence(sales_df: pd.DataFrame, product: dict) -> dict:
    if sales_df.empty:
        return {
            "score": 50, "status": "WARN", "headline": "No sales data",
            "metrics": {}, "insights": [], "recommendations": ["Record sales transactions"],
            "sparkline": [],
        }

    df = sales_df.sort_values("date").copy()
    rev = df["revenue"].astype(float)

    rev30    = float(rev.tail(30).sum())
    rev7     = float(rev.tail(7).sum())
    rev7_prev = float(rev.iloc[-14:-7]["revenue"].sum()) if len(df) >= 14 else rev7
    mom_pct  = (rev7 - rev7_prev) / rev7_prev * 100 if rev7_prev > 0 else 0

    stock    = int(product.get("stock", 300))
    price    = float(product.get("price", 799))
    units30  = float(df["units_sold"].tail(30).sum())

    # Sell-through rate: units sold in 30d vs total stock exposure
    sell_through = units30 / (stock + units30) * 100 if (stock + units30) > 0 else 0

    # Conversion proxy: revenue per price-point (demand efficiency)
    conv_proxy = float(df["units_sold"].tail(30).mean()) / max(price / 100, 1) if price > 0 else 0

    score = _clamp(40 + sell_through * 0.4 + mom_pct * 0.5 + min(20, conv_proxy))

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": f"₹{rev30:,.0f} revenue (30d) · {sell_through:.1f}% sell-through · {mom_pct:+.1f}% WoW",
        "metrics": {
            "revenue_30d":    round(rev30),
            "revenue_7d":     round(rev7),
            "wow_momentum":   round(mom_pct, 1),
            "sell_through":   round(sell_through, 1),
            "units_sold_30d": round(units30),
            "avg_daily_rev":  round(rev30 / 30, 0),
        },
        "insights": [
            f"30-day revenue: ₹{rev30:,.0f}",
            f"Week-on-week momentum: {mom_pct:+.1f}%",
            f"Sell-through rate: {sell_through:.1f}% (ideal >60%)",
        ],
        "recommendations": [
            "Revenue accelerating — good time to test higher price" if mom_pct > 15 else
            "Revenue declining — investigate demand or competitive positioning" if mom_pct < -15 else
            "Revenue stable — optimize for margin",
        ],
        "sparkline": _sparkline(rev, 14),
    }


# ── 4. Market ─────────────────────────────────────────────────────────────────

def compute_market_intelligence(comp_df: pd.DataFrame, sales_df: pd.DataFrame) -> dict:
    if comp_df.empty:
        return {
            "score": 55, "status": "WARN", "headline": "No competitor data — run scraper",
            "metrics": {}, "insights": ["Run the Scraper to fetch real competitor prices"],
            "recommendations": ["Use the Scraper page to collect competitor data"],
            "sparkline": [],
        }

    prices   = comp_df["price"].astype(float)
    avg_p    = float(prices.mean())
    std_p    = float(prices.std()) if len(prices) > 1 else 0
    cv       = std_p / avg_p * 100 if avg_p > 0 else 0   # coefficient of variation
    n_comp   = int(comp_df["platform"].nunique()) if "platform" in comp_df.columns else 1

    # Market concentration: fewer competitors = better for us
    conc_score = max(0, 30 - n_comp * 5)
    # Price stability: low CV = stable market
    stab_score = max(0, 40 - cv * 0.8)
    # Coverage: more platforms tracked = better intelligence
    cov_score  = min(30, n_comp * 7)

    score = _clamp(conc_score + stab_score + cov_score)

    # Recent price movement
    if "scraped_at" in comp_df.columns:
        comp_df = comp_df.copy()
        comp_df["scraped_at"] = pd.to_datetime(comp_df["scraped_at"])
        recent   = comp_df.sort_values("scraped_at").tail(10)["price"].mean()
        older    = comp_df.sort_values("scraped_at").head(10)["price"].mean()
        mkt_move = (recent - older) / older * 100 if older > 0 else 0
    else:
        mkt_move = 0

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": (
            f"{n_comp} marketplace(s) tracked · market avg ₹{avg_p:.0f} · "
            f"volatility {cv:.1f}%"
        ),
        "metrics": {
            "competitor_count":    n_comp,
            "market_avg_price":    round(avg_p),
            "market_price_std":    round(std_p, 1),
            "market_volatility_cv": round(cv, 1),
            "market_movement_pct": round(mkt_move, 1),
        },
        "insights": [
            f"Market price range: ₹{prices.min():.0f} – ₹{prices.max():.0f}",
            f"Price volatility (CV): {cv:.1f}% ({'high' if cv > 15 else 'moderate' if cv > 8 else 'low'})",
            f"Market trend: {mkt_move:+.1f}% since first scrape",
        ],
        "recommendations": [
            "High market volatility — monitor prices daily" if cv > 15 else
            "Stable market — weekly monitoring sufficient",
        ],
        "sparkline": _sparkline(prices.reset_index(drop=True), 14),
    }


# ── 5. Inventory ──────────────────────────────────────────────────────────────

def compute_inventory_intelligence(product: dict, sales_df: pd.DataFrame) -> dict:
    stock        = int(product.get("stock", 300))
    cost_price   = float(product.get("cost_price", 350))
    holding_rate = 0.20   # 20% annual holding cost

    if sales_df.empty:
        daily_rate    = 10.0
        days_to_zero  = stock / daily_rate if daily_rate > 0 else 999
        aging_score   = 50
    else:
        daily_rate   = float(sales_df["units_sold"].tail(30).mean())
        days_to_zero = stock / daily_rate if daily_rate > 0 else 999
        aging_score  = _clamp(100 - max(0, (days_to_zero - 30) / 3))

    hold_cost_mo = stock * cost_price * holding_rate / 12
    reorder_flag = days_to_zero < 14
    overstock    = days_to_zero > 90

    score = _clamp(aging_score - (30 if overstock else 0) - (10 if reorder_flag else 0))

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": (
            f"{stock:,} units · {days_to_zero:.0f} days to stockout · "
            f"₹{hold_cost_mo:,.0f}/mo holding cost"
        ),
        "metrics": {
            "current_stock":     stock,
            "daily_burn_rate":   round(daily_rate, 1),
            "days_to_stockout":  round(days_to_zero, 0),
            "holding_cost_mo":   round(hold_cost_mo),
            "reorder_alert":     reorder_flag,
            "overstock_alert":   overstock,
        },
        "insights": [
            f"At {daily_rate:.1f} units/day, stock lasts ~{days_to_zero:.0f} days",
            f"Monthly holding cost estimate: ₹{hold_cost_mo:,.0f}",
            "⚠️ REORDER ALERT: <14 days of stock remaining!" if reorder_flag else
            "📦 Overstock: >90 days of stock — consider markdown" if overstock else
            "✅ Stock levels healthy",
        ],
        "recommendations": [
            "Reorder immediately — stock critically low" if reorder_flag else
            "Run markdown campaign to clear excess inventory" if overstock else
            "Maintain current replenishment schedule",
        ],
        "sparkline": [],
    }


# ── 6. Sentiment ──────────────────────────────────────────────────────────────

def compute_sentiment_intelligence(product: dict) -> dict:
    rating  = float(product.get("rating", 4.0))
    reviews = int(product.get("reviews", 0))

    # NPS proxy: rating → NPS-like score
    # 5.0 = 100, 4.5 = 85, 4.0 = 70, 3.5 = 50, 3.0 = 30
    nps_proxy   = max(0, (rating - 1) / 4 * 100)
    review_bonus = min(10, math.log1p(reviews) * 2)
    score       = _clamp(nps_proxy * 0.85 + review_bonus)

    sentiment_label = (
        "Excellent" if rating >= 4.5 else
        "Good"      if rating >= 4.0 else
        "Average"   if rating >= 3.5 else
        "Poor"
    )

    # Estimate positive/neutral/negative split from rating
    pos_pct  = round(max(0, (rating - 3) / 2 * 100))
    neg_pct  = round(max(0, (5 - rating) / 4 * 30))
    neut_pct = max(0, 100 - pos_pct - neg_pct)

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": f"{rating:.1f}★ from {reviews:,} reviews — {sentiment_label}",
        "metrics": {
            "rating":          rating,
            "review_count":    reviews,
            "nps_proxy":       round(nps_proxy),
            "positive_pct":    pos_pct,
            "neutral_pct":     neut_pct,
            "negative_pct":    neg_pct,
            "sentiment_label": sentiment_label,
        },
        "insights": [
            f"Rating {rating:.1f}/5 corresponds to ~{nps_proxy:.0f} NPS proxy",
            f"Estimated sentiment split: {pos_pct}% positive / {neut_pct}% neutral / {neg_pct}% negative",
            f"Review volume: {reviews:,} ({'strong' if reviews > 500 else 'growing' if reviews > 100 else 'limited'} social proof)",
        ],
        "recommendations": [
            "Leverage premium sentiment — justify higher price point" if rating >= 4.5 else
            "Address negative reviews to protect conversion rate" if rating < 3.8 else
            "Maintain quality standards to sustain positive sentiment",
        ],
        "sparkline": [round(rating, 1)] * 7,   # static for now; would be time-series in prod
    }


# ── 7. Advertising ────────────────────────────────────────────────────────────

def compute_advertising_intelligence(sales_df: pd.DataFrame, product: dict) -> dict:
    cost_price   = float(product.get("cost_price", 350))
    current_price = float(product.get("price", 799))

    if sales_df.empty:
        return {
            "score": 50, "status": "WARN", "headline": "Insufficient data for ROAS estimation",
            "metrics": {}, "insights": [], "recommendations": ["Record sales to enable ad analytics"],
            "sparkline": [],
        }

    df      = sales_df.sort_values("date").copy()
    rev30   = float(df["revenue"].tail(30).sum())
    units30 = float(df["units_sold"].tail(30).sum())

    # Estimated ad spend proxy: assume 15% of revenue
    ad_spend_proxy  = rev30 * 0.15
    roas_proxy      = rev30 / ad_spend_proxy if ad_spend_proxy > 0 else 0
    gross_margin    = (current_price - cost_price) / current_price
    mer_proxy       = rev30 * gross_margin / ad_spend_proxy if ad_spend_proxy > 0 else 0
    cac_proxy       = ad_spend_proxy / units30 if units30 > 0 else 0
    payback_days    = cac_proxy / (current_price * gross_margin / 30) if (current_price * gross_margin) > 0 else 0

    score = _clamp(mer_proxy * 20)   # MER 5x = score 100

    roas_series = (df["revenue"] * 0.85).reset_index(drop=True)

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": (
            f"Est. ROAS {roas_proxy:.1f}x · CAC ₹{cac_proxy:.0f} · "
            f"MER {mer_proxy:.1f}x (15% spend assumption)"
        ),
        "metrics": {
            "est_roas":          round(roas_proxy, 2),
            "est_mer":           round(mer_proxy, 2),
            "est_cac":           round(cac_proxy),
            "payback_days":      round(payback_days),
            "ad_spend_30d_est":  round(ad_spend_proxy),
            "gross_margin_pct":  round(gross_margin * 100, 1),
        },
        "insights": [
            "⚠️ ROAS estimated using 15% revenue ad-spend proxy — connect ad platform for actuals",
            f"Estimated CAC: ₹{cac_proxy:.0f} — {'excellent' if cac_proxy < cost_price * 0.3 else 'acceptable' if cac_proxy < cost_price * 0.5 else 'high'}",
            f"Payback period: ~{payback_days:.0f} days",
        ],
        "recommendations": [
            "Scale ad budget — MER above 3x threshold" if mer_proxy > 3 else
            "Optimize creative / targeting — MER below breakeven" if mer_proxy < 1.5 else
            "Maintain current ad spend — MER in acceptable range",
        ],
        "sparkline": _sparkline(roas_series, 14),
    }


# ── 8. Seasonality ────────────────────────────────────────────────────────────

def compute_seasonality_intelligence(sales_df: pd.DataFrame) -> dict:
    today     = date.today()
    today_mul = _seasonal_multiplier(today)

    # Find next festival
    next_event = None
    next_days  = 999
    for m, ds, de, name, mul in _FESTIVALS:
        ev_date = date(today.year if date(today.year, m, ds) >= today else today.year + 1, m, ds)
        delta   = (ev_date - today).days
        if 0 <= delta < next_days:
            next_days  = delta
            next_event = name

    # Week-of-year index from sales history
    if not sales_df.empty:
        df = sales_df.sort_values("date").copy()
        df["date"] = pd.to_datetime(df["date"])
        df["week"] = df["date"].dt.isocalendar().week.astype(int)
        woy_avg    = df.groupby("week")["units_sold"].mean()
        cur_week   = today.isocalendar()[1]
        cur_woy    = float(woy_avg.get(cur_week, woy_avg.mean()))
        global_avg = float(woy_avg.mean())
        seasonal_index = cur_woy / global_avg if global_avg > 0 else 1.0
        sparkline_data = _sparkline(df["units_sold"], 28)
    else:
        seasonal_index = today_mul
        sparkline_data = []

    in_season = today_mul > 1.10
    score     = _clamp(50 + (today_mul - 1) * 200 + (30 if in_season else 0) - (10 if next_days > 60 else 0))

    return {
        "score":  round(score),
        "status": _status(score),
        "headline": (
            f"Seasonal index {seasonal_index:.2f}x · "
            f"{'🎉 IN SEASON: ' + _festivals_today(today) if in_season else f'Next: {next_event} in {next_days}d'}"
        ),
        "metrics": {
            "seasonal_multiplier": round(today_mul, 2),
            "seasonal_index":      round(seasonal_index, 2),
            "next_festival":       next_event,
            "days_to_festival":    next_days,
            "in_peak_season":      in_season,
            "week_of_year":        today.isocalendar()[1],
        },
        "insights": [
            f"Current seasonal demand multiplier: {today_mul:.2f}x",
            f"Week {today.isocalendar()[1]} historical index: {seasonal_index:.2f}x vs annual avg",
            f"Next major event: {next_event} in {next_days} days" if next_event else "No upcoming festivals tracked",
        ],
        "recommendations": [
            f"Peak season active — increase price by up to {(today_mul - 1) * 100:.0f}% or run promotions" if in_season else
            f"Prepare inventory and pricing for {next_event} ({next_days} days away)" if next_days < 21 else
            "Off-season — focus on clearing inventory and efficiency",
        ],
        "sparkline": sparkline_data,
    }


def _festivals_today(dt: date) -> str:
    for m, ds, de, name, _ in _FESTIVALS:
        if dt.month == m and ds <= dt.day <= de:
            return name
    return ""


# ── Master function ───────────────────────────────────────────────────────────

def compute_all_signals(
    product: dict,
    sales_df: pd.DataFrame,
    comp_df: pd.DataFrame,
    features=None,
) -> dict:
    """Compute all 8 intelligence signals and overall health score."""
    if features is None:
        features = {
            "current_price":  product.get("price", 799),
            "cost_price":     product.get("cost_price", 350),
            "stock":          product.get("stock", 300),
            "price_std":      float(sales_df["price"].std()) if not sales_df.empty else 0,
        }

    signals = {
        "pricing":     compute_pricing_intelligence(features, comp_df),
        "demand":      compute_demand_intelligence(sales_df),
        "sales":       compute_sales_intelligence(sales_df, product),
        "market":      compute_market_intelligence(comp_df, sales_df),
        "inventory":   compute_inventory_intelligence(product, sales_df),
        "sentiment":   compute_sentiment_intelligence(product),
        "advertising": compute_advertising_intelligence(sales_df, product),
        "seasonality": compute_seasonality_intelligence(sales_df),
    }

    scores = [s["score"] for s in signals.values()]
    health = round(sum(scores) / len(scores))

    return {
        "overall_health_score": health,
        "health_status":        _status(health),
        "signals":              signals,
        "generated_at":         datetime.utcnow().isoformat() + "Z",
    }
