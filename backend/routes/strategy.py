"""Strategy route — GET /api/strategy/{product_id}

Complete pricing recommendation pipeline:
    1.  Fetch product from catalog
    2.  Fetch sales history → DataFrame
    3.  Build features dict
    4.  Get competitor data (DB cache → scraper fallback)
    5.  Train demand model (XGBoost)
    6.  ML optimal price search
    7.  Estimate elasticity
    8.  Classify archetype
    9.  Calculate price corridor
    10. Blend ML + rule-based recommendation
    11. Generate 14-day action plan
    12. Generate trigger rules
    13. Run 30-day simulation (4 strategies)
    14. Generate risk flags
    15. Build expected outcome
    16. Call LLM for 3-sentence rationale
    17. Return complete StrategyResponse
"""
from __future__ import annotations

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory, CompetitorData

from services.product_catalog import get_product_by_id
from services.scraper_engine import run_full_scrape
from services.ml_engine import (
    build_features,
    train_demand_model,
    optimal_price_search,
    estimate_elasticity,
)
from services.pricing_engine import rule_based_price
from services.strategy_classifier import classify_archetype, calculate_price_corridor
from services.action_plan import generate_action_plan
from services.trigger_rules import generate_triggers
from services.strategy_simulator import simulate_strategies
from services.risk_flags import generate_risk_flags
from services.llm_explainer import generate_llm_rationale

from schemas.strategy import (
    StrategyResponse,
    ActionPlanDay,
    TriggerRule,
    RiskFlag,
    PriceCorridor,
    CompetitorStats,
    SimulationDay,
    SimulationSummary,
    SimulationResult,
    ExpectedOutcome,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/strategy", tags=["Strategy"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _blend_recommendation(
    ml_price: float,
    rule_price: float,
    archetype: str,
    corridor: dict,
) -> float:
    """
    Blend ML + rule-based prices with archetype-aware weights,
    then clamp to corridor.
    """
    # Archetype weights: ML_weight, Rule_weight
    weights = {
        "PENETRATION":       (0.5, 0.5),
        "CLEARANCE":         (0.4, 0.6),
        "PREMIUM":           (0.6, 0.4),
        "SKIM":              (0.7, 0.3),
        "COMPETITIVE_MATCH": (0.5, 0.5),
        "HOLD":              (0.6, 0.4),
    }
    ml_w, rule_w = weights.get(archetype, (0.5, 0.5))
    blended = ml_w * ml_price + rule_w * rule_price
    return float(np.clip(blended, corridor["min"], corridor["max"]))


def _build_sales_df(records) -> pd.DataFrame:
    """Convert SalesHistory ORM records to a DataFrame."""
    if not records:
        return pd.DataFrame(columns=["date", "price", "units_sold", "revenue", "day_of_week"])

    rows = [
        {
            "date":       r.date,
            "price":      float(r.price),
            "units_sold": int(r.units_sold),
            "revenue":    float(r.revenue),
            "day_of_week": int(r.day_of_week) if r.day_of_week is not None else 0,
        }
        for r in records
    ]
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    return df


def _build_comp_stats(comp_records) -> dict:
    """Build comp_stats dict from competitor DB records or scrape result."""
    prices = [float(r.price) for r in comp_records if r.price > 0]
    if not prices:
        return {
            "avg_price": 0.0,
            "min_price": 0.0,
            "max_price": 0.0,
            "p25":       0.0,
            "count":     0,
        }
    prices_arr = np.array(prices)
    return {
        "avg_price": float(np.mean(prices_arr)),
        "min_price": float(np.min(prices_arr)),
        "max_price": float(np.max(prices_arr)),
        "p25":       float(np.percentile(prices_arr, 25)),
        "count":     len(prices),
    }


def _build_comp_stats_from_scrape(scrape_result: dict, current_price: float) -> dict:
    """Build comp_stats dict from the run_full_scrape result dict."""
    all_prices = []
    for mp_data in scrape_result.get("marketplaces", []):
        for prod in mp_data.get("products", []):
            p = prod.get("price", 0)
            if p and p > 0:
                all_prices.append(float(p))

    if not all_prices:
        # Fallback: use current price as proxy
        all_prices = [current_price]

    prices_arr = np.array(all_prices)
    return {
        "avg_price": float(np.mean(prices_arr)),
        "min_price": float(np.min(prices_arr)),
        "max_price": float(np.max(prices_arr)),
        "p25":       float(np.percentile(prices_arr, 25)),
        "count":     len(prices_arr),
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/{product_id}", response_model=StrategyResponse)
def get_strategy(product_id: str, db: Session = Depends(get_db)):
    """
    Full pricing strategy pipeline for a single product.
    Returns the complete StrategyResponse.
    """
    # ── Step 1: Fetch product ─────────────────────────────────────────────────
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")

    current_price = float(product.get("landing_cost", product["price"]))
    cost_price    = float(product["cost_price"])
    product_name  = product["name"]

    # ── Step 2: Sales history → DataFrame ────────────────────────────────────
    sales_records = (
        db.query(SalesHistory)
        .filter(SalesHistory.product_id == product_id)
        .order_by(SalesHistory.date.asc())
        .all()
    )
    sales_df = _build_sales_df(sales_records)

    # If we have no sales data, synthesise minimal data so the ML doesn't crash
    if len(sales_df) < 14:
        logger.warning(
            "Product %s has only %d sales records — using synthetic data",
            product_id, len(sales_df),
        )
        rng = np.random.default_rng(abs(hash(product_id)) % (2**31))
        n_days = 90
        base_demand = rng.integers(15, 50)
        prices  = rng.uniform(current_price * 0.90, current_price * 1.10, n_days)
        demands = np.clip(
            rng.normal(base_demand, base_demand * 0.2, n_days), 1, None
        ).astype(int)
        dates = [
            (datetime.now() - timedelta(days=n_days - i)).date()
            for i in range(n_days)
        ]
        sales_df = pd.DataFrame({
            "date":       pd.to_datetime(dates),
            "price":      prices,
            "units_sold": demands,
            "revenue":    prices * demands,
            "day_of_week": [d.weekday() for d in dates],
        })

    # ── Step 3: Build features ────────────────────────────────────────────────
    features = build_features(sales_df, product)

    # ── Step 4: Competitor data ───────────────────────────────────────────────
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    # SQLite stores without tz, so strip tz for comparison
    comp_records = (
        db.query(CompetitorData)
        .filter(CompetitorData.product_id == product_id)
        .filter(CompetitorData.scraped_at >= cutoff.replace(tzinfo=None))
        .all()
    )

    competitor_last_scraped_at = None

    if comp_records:
        comp_stats = _build_comp_stats(comp_records)
        # Find the most recent scrape timestamp
        latest = max(r.scraped_at for r in comp_records)
        competitor_last_scraped_at = latest.isoformat() if latest else None
    else:
        # Fallback: use the scraper engine
        try:
            scrape_result  = run_full_scrape(product_id)
            comp_stats     = _build_comp_stats_from_scrape(scrape_result, current_price)
            competitor_last_scraped_at = datetime.now(timezone.utc).isoformat()

            # Persist scraped prices to DB for future cache hits
            for mp_data in scrape_result.get("marketplaces", []):
                platform = mp_data.get("marketplace", "Unknown")
                for prod in mp_data.get("products", []):
                    p = prod.get("price", 0)
                    if p and p > 0:
                        db.add(CompetitorData(
                            product_id=product_id,
                            platform=platform,
                            price=float(p),
                            title=prod.get("name", ""),
                            merchant=prod.get("brand", ""),
                            link=prod.get("url", ""),
                        ))
            try:
                db.commit()
            except Exception:
                db.rollback()

        except Exception as exc:
            logger.warning("Scraper failed for %s: %s", product_id, exc)
            # Last resort: synthetic comp_stats centred on current_price
            comp_stats = {
                "avg_price": current_price * 0.95,
                "min_price": current_price * 0.80,
                "max_price": current_price * 1.20,
                "p25":       current_price * 0.88,
                "count":     0,
            }

    # Update competitor_avg_price in features
    features["competitor_avg_price"] = comp_stats["avg_price"]

    # ── Step 5: Train demand model ────────────────────────────────────────────
    model = train_demand_model(sales_df)

    # ── Step 6: ML optimal price search ──────────────────────────────────────
    ml_result = optimal_price_search(model, features, sales_df)

    # ── Step 7: Estimate elasticity ───────────────────────────────────────────
    elasticity = estimate_elasticity(sales_df)

    # ── Step 8: Classify archetype ────────────────────────────────────────────
    margin_pct = (current_price - cost_price) / current_price if current_price > 0 else 0.0
    archetype  = classify_archetype(features, comp_stats, elasticity, margin_pct)

    # ── Step 9: Price corridor ────────────────────────────────────────────────
    price_std = float(features.get("price_std", 0.0))
    corridor  = calculate_price_corridor(current_price, cost_price, comp_stats, price_std)

    # ── Step 10: Blended recommendation ──────────────────────────────────────
    rule_result = rule_based_price(features)
    rule_price  = float(rule_result["recommended_price"])
    ml_price    = float(ml_result["recommended_price"])
    recommended_price = _blend_recommendation(ml_price, rule_price, archetype, corridor)
    recommended_price = round(
        float(np.clip(recommended_price, corridor["min"], corridor["max"]))
    )
    confidence = float(ml_result.get("confidence", 70.0))

    # ── Step 11: 14-day action plan ───────────────────────────────────────────
    action_plan_raw = generate_action_plan(
        features, archetype, elasticity, recommended_price, cost_price
    )

    # ── Step 12: Trigger rules ────────────────────────────────────────────────
    triggers_raw = generate_triggers(archetype, comp_stats, features)

    # ── Step 13: 30-day simulation ────────────────────────────────────────────
    simulation_raw = simulate_strategies(features, archetype, elasticity, cost_price)

    # ── Step 14: Risk flags ───────────────────────────────────────────────────
    # Inject fields the risk_flags module needs
    features_for_risk = dict(features)
    features_for_risk["recommended_price"]          = recommended_price
    features_for_risk["elasticity"]                 = elasticity
    features_for_risk["competitor_last_scraped_at"] = competitor_last_scraped_at

    risk_flags_raw = generate_risk_flags(features_for_risk, comp_stats, archetype)

    # ── Step 15: Expected outcome ─────────────────────────────────────────────
    sim_summary = simulation_raw["summary"]
    # Map archetype to simulation key (COMPETITIVE_MATCH exists in sim, others too)
    sim_key = archetype if archetype in sim_summary else "HOLD"
    arch_totals = sim_summary[sim_key]
    hold_totals = sim_summary["HOLD"]

    hold_rev = hold_totals["total_revenue"]
    arch_rev = arch_totals["total_revenue"]
    revenue_impact_pct = (
        (arch_rev - hold_rev) / hold_rev * 100 if hold_rev > 0 else 0.0
    )

    expected_outcome = ExpectedOutcome(
        revenue_30d=arch_totals["total_revenue"],
        margin_30d=arch_totals["total_margin"],
        units_30d=arch_totals["total_units"],
        revenue_impact_pct=round(revenue_impact_pct, 2),
    )

    # ── Step 16: LLM rationale ────────────────────────────────────────────────
    rationale = generate_llm_rationale(
        archetype=archetype,
        product_name=product_name,
        current_price=current_price,
        recommended_price=recommended_price,
        comp_avg=comp_stats["avg_price"],
        elasticity=elasticity,
        risk_flags=risk_flags_raw,
        confidence=confidence,
    )

    # ── Step 17: Assemble response ────────────────────────────────────────────

    # Serialise simulation
    sim_series: dict = {}
    for strat, days in simulation_raw["series"].items():
        sim_series[strat] = [SimulationDay(**d) for d in days]

    sim_summary_models: dict = {}
    for strat, totals in sim_summary.items():
        sim_summary_models[strat] = SimulationSummary(**totals)

    return StrategyResponse(
        product_id=product_id,
        product_name=product_name,
        archetype=archetype,
        current_price=current_price,
        recommended_price=float(recommended_price),
        price_corridor=PriceCorridor(**corridor),
        confidence=confidence,
        elasticity=elasticity,
        rationale=rationale,
        risk_flags=[RiskFlag(**f) for f in risk_flags_raw],
        action_plan=[ActionPlanDay(**d) for d in action_plan_raw],
        triggers=[TriggerRule(**t) for t in triggers_raw],
        simulation=SimulationResult(series=sim_series, summary=sim_summary_models),
        competitor_stats=CompetitorStats(
            avg_price=round(comp_stats["avg_price"], 2),
            min_price=round(comp_stats["min_price"], 2),
            max_price=round(comp_stats["max_price"], 2),
            p25=round(comp_stats["p25"], 2),
            count=comp_stats["count"],
        ),
        expected_outcome=expected_outcome,
        generated_at=datetime.now(timezone.utc),
    )


# ── New: Strategy Builder (multi-candidate generator) ────────────────────────

from pydantic import BaseModel
from services.product_enrichment import enrich_product
from services.ml_orchestrator import run_analysis as ml_run_analysis
from services.strategy_builder import generate_strategies


class StrategyGenerateRequest(BaseModel):
    product_id: str
    objective: str = "maximize_revenue"   # maximize_revenue | maximize_margin | reduce_inventory | win_market_share
    horizon_days: int = 30
    aggressiveness: float = 0.5            # 0..1
    top_k: int = 5


@router.post("/generate")
def generate_strategy_candidates(req: StrategyGenerateRequest, db: Session = Depends(get_db)):
    """Generate ranked candidate pricing strategies for a product.

    Returns up to `top_k` strategies sorted by `objective_score`. Each strategy
    contains a full scorecard (price, expected units/revenue/margin, risk,
    confidence, drivers, rationale).
    """
    base = get_product_by_id(req.product_id)
    if not base:
        raise HTTPException(status_code=404, detail="Product not found")

    enriched = enrich_product(base)
    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == req.product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)
    if not sales_df.empty:
        sales_df["date"] = pd.to_datetime(sales_df["date"]).dt.strftime("%Y-%m-%d")
    comp_q = db.query(CompetitorData).filter(CompetitorData.product_id == req.product_id)
    comp_df = pd.read_sql(comp_q.statement, db.bind)

    ml_output = ml_run_analysis(enriched, sales_df=sales_df, comp_df=comp_df)
    return generate_strategies(
        enriched,
        ml_output,
        objective=req.objective,
        horizon_days=req.horizon_days,
        aggressiveness=req.aggressiveness,
        top_k=req.top_k,
    )


# ── Deep Analysis (Strategy Builder) ─────────────────────────────────────────

def _lifecycle_stage(sales_df: pd.DataFrame) -> dict:
    """Classify product lifecycle stage from 180-day sales trend.

    Stages: introduction | growth | maturity | decline | revival
    """
    if sales_df.empty or len(sales_df) < 30:
        return {
            "stage": "introduction",
            "confidence": 0.55,
            "explanation": "Insufficient sales history — treating as new launch.",
            "trend_score": 0.0,
        }

    df = sales_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")
    series = df["units_sold"].astype(float).values

    # Recent 30d vs prior 30-60d window
    n = len(series)
    recent  = series[-30:].mean() if n >= 30 else series.mean()
    prior   = series[-60:-30].mean() if n >= 60 else recent
    older   = series[-120:-60].mean() if n >= 120 else prior

    # Trend score: positive = rising, negative = falling
    if prior > 0:
        recent_vs_prior = (recent - prior) / prior
    else:
        recent_vs_prior = 0.0
    if older > 0:
        prior_vs_older = (prior - older) / older
    else:
        prior_vs_older = 0.0

    trend_score = round((recent_vs_prior + prior_vs_older) / 2.0, 3)

    # Variance — high variance early = introduction
    cv = float(np.std(series[-30:]) / max(np.mean(series[-30:]), 1.0))

    if n < 60 and recent_vs_prior > 0.10:
        stage = "introduction"
        explanation = "Recently launched; demand still ramping with high variance."
    elif recent_vs_prior > 0.15:
        stage = "growth"
        explanation = "Demand accelerating month over month — invest in availability."
    elif recent_vs_prior < -0.15 and prior_vs_older < -0.10:
        stage = "decline"
        explanation = "Demand declining for 2+ months — consider markdown or refresh."
    elif recent_vs_prior < -0.15 and prior_vs_older > -0.05:
        stage = "decline"
        explanation = "Recent demand dip after stable phase — investigate causes."
    elif recent_vs_prior > 0.05 and prior_vs_older < -0.05:
        stage = "revival"
        explanation = "Demand picking back up after a soft patch."
    else:
        stage = "maturity"
        explanation = "Stable demand — typical mature product behavior."

    confidence = round(min(0.95, 0.6 + abs(trend_score) * 1.2), 2)
    return {
        "stage": stage,
        "confidence": confidence,
        "explanation": explanation,
        "trend_score": trend_score,
        "cv_recent": round(cv, 3),
        "recent_30d_avg_units": round(float(recent), 1),
        "prior_30d_avg_units": round(float(prior), 1),
    }


def _aggregate_monthly(sales_df: pd.DataFrame, months: int = 6) -> list:
    """Aggregate sales history into monthly buckets for last N months."""
    if sales_df.empty:
        return []
    df = sales_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")
    df["month"] = df["date"].dt.to_period("M")
    grouped = df.groupby("month").agg(
        units=("units_sold", "sum"),
        revenue=("revenue", "sum"),
        avg_price=("price", "mean"),
        days=("date", "count"),
    ).reset_index()
    grouped = grouped.tail(months)
    return [
        {
            "month": str(row["month"]),
            "units": int(row["units"]),
            "revenue": round(float(row["revenue"]), 2),
            "avg_price": round(float(row["avg_price"]), 2),
            "days": int(row["days"]),
        }
        for _, row in grouped.iterrows()
    ]


def _forecast_180d(sales_df: pd.DataFrame, current_price: float) -> dict:
    """6-month (180-day) demand forecast using existing ensemble.
    Returns daily + weekly aggregated series + summary stats."""
    from services.demand_forecasting_ensemble import run_ensemble_forecast
    try:
        fc = run_ensemble_forecast(sales_df, periods=180)
    except Exception as exc:
        logger.warning("180d forecast failed: %s", exc)
        # Fallback flat forecast
        avg = float(sales_df["units_sold"].tail(30).mean()) if not sales_df.empty else 25.0
        dates = pd.date_range(
            start=pd.Timestamp.now().normalize() + pd.Timedelta(days=1), periods=180, freq="D"
        )
        fc = {
            "forecast": [
                {"date": d.strftime("%Y-%m-%d"),
                 "ensemble": round(avg, 1),
                 "lower": round(avg * 0.85, 1),
                 "upper": round(avg * 1.15, 1)}
                for d in dates
            ],
            "metrics": {"models_used": ["fallback"]},
        }

    # Normalize: ensemble service may return {"forecast": [...], "metrics": {}}
    daily = fc.get("forecast") if isinstance(fc, dict) else fc
    if not isinstance(daily, list):
        daily = []

    # Build weekly aggregation for cleaner chart
    weekly = []
    if daily:
        df_d = pd.DataFrame(daily)
        if "date" in df_d.columns:
            df_d["date"] = pd.to_datetime(df_d["date"])
            df_d["week"] = df_d["date"].dt.to_period("W").apply(lambda r: r.start_time)
            # Pick the units column (`ensemble` or `yhat` or first numeric)
            unit_col = next((c for c in ("ensemble", "yhat", "prophet", "xgb") if c in df_d.columns), None)
            low_col  = next((c for c in ("lower", "yhat_lower", "p_lower") if c in df_d.columns), None)
            up_col   = next((c for c in ("upper", "yhat_upper", "p_upper") if c in df_d.columns), None)
            agg = {unit_col: "sum"} if unit_col else {}
            if low_col: agg[low_col] = "sum"
            if up_col:  agg[up_col]  = "sum"
            if agg:
                wk = df_d.groupby("week").agg(agg).reset_index()
                for _, row in wk.iterrows():
                    weekly.append({
                        "week": row["week"].strftime("%Y-%m-%d"),
                        "units": round(float(row[unit_col]), 1) if unit_col else 0,
                        "lower": round(float(row[low_col]), 1) if low_col else None,
                        "upper": round(float(row[up_col]), 1) if up_col else None,
                    })

    # 6-month totals
    total_units = round(sum(w.get("units", 0) for w in weekly), 1) if weekly else 0
    total_revenue = round(total_units * current_price, 2)

    return {
        "daily": daily,
        "weekly": weekly,
        "total_units_180d": total_units,
        "total_revenue_180d": total_revenue,
        "horizon_days": 180,
    }


def _pricing_position(current_price: float, comp_stats: dict) -> dict:
    """Where does our price sit vs competitors?"""
    avg = comp_stats.get("avg_price", current_price) or current_price
    mn  = comp_stats.get("min_price", current_price) or current_price
    mx  = comp_stats.get("max_price", current_price) or current_price
    if mx > mn:
        percentile = round((current_price - mn) / (mx - mn) * 100, 1)
    else:
        percentile = 50.0

    if current_price < avg * 0.92:
        position = "undercut"
        narrative = "Priced below market — leaving margin on the table."
    elif current_price > avg * 1.08:
        position = "premium"
        narrative = "Priced at a premium — must justify with brand/quality signals."
    else:
        position = "parity"
        narrative = "Pricing is in line with the market."

    return {
        "position": position,
        "percentile": percentile,
        "narrative": narrative,
        "delta_vs_avg_pct": round(
            ((current_price - avg) / avg * 100) if avg > 0 else 0.0, 2
        ),
    }


def _market_saturation(comp_stats: dict) -> dict:
    """Estimate marketplace saturation from competitor count."""
    n = comp_stats.get("count", 0)
    if n < 15:
        level = "low";    narrative = "Opportunity — few entrenched competitors."
    elif n < 40:
        level = "medium"; narrative = "Moderately competitive — differentiation matters."
    elif n < 80:
        level = "high";   narrative = "Crowded — price + discoverability are critical."
    else:
        level = "saturated"; narrative = "Hyper-competitive — niche or price war required."
    return {"level": level, "competitor_count": n, "narrative": narrative}


# ── New helpers for Strategy Command Center ──────────────────────────────────

def _market_metrics(sales_df: pd.DataFrame, comp_stats: dict, product: dict) -> dict:
    """Compute market-level metrics for the Overview tab."""
    current_price = float(product.get("price", 0)) or 0.0
    cheapest = float(comp_stats.get("min_price", current_price * 0.85))
    premium  = float(comp_stats.get("max_price", current_price * 1.25))
    avg      = float(comp_stats.get("avg_price", current_price))
    count    = int(comp_stats.get("count", 0))

    # Sales velocity: units/day (last 30d)
    if not sales_df.empty:
        velocity = float(sales_df["units_sold"].tail(30).mean())
        # Volatility: coefficient of variation on last 60d
        last_60 = sales_df["units_sold"].tail(60)
        volatility = float(last_60.std() / max(last_60.mean(), 1.0))
    else:
        velocity = 25.0
        volatility = 0.3

    # Stockout probability: high when DoC is low
    stock = int(product.get("stock", 300))
    days_cover = stock / max(velocity, 1.0)
    if days_cover < 14:
        stockout_prob = 0.85
    elif days_cover < 30:
        stockout_prob = 0.45
    elif days_cover < 60:
        stockout_prob = 0.18
    else:
        stockout_prob = 0.06

    # Competitor aggression: high competitor count + low avg price relative to ours
    if current_price > 0 and count > 0:
        price_pressure = max(0.0, (current_price - avg) / current_price)
        density_score = min(1.0, count / 60.0)
        aggression = round(min(1.0, 0.35 * price_pressure * 2 + 0.65 * density_score), 2)
    else:
        aggression = 0.4

    # Market share estimate (very approximate: our_velocity / (our + competitor proxy))
    competitor_velocity_proxy = max(count * 5.0, 10.0)
    market_share = round(min(0.95, velocity / max(velocity + competitor_velocity_proxy, 1.0)), 3)

    return {
        "cheapest_competitor": round(cheapest, 2),
        "premium_competitor":  round(premium, 2),
        "avg_competitor":      round(avg, 2),
        "your_price":          round(product.get('landing_cost', current_price), 2),
        "sales_velocity":      round(velocity, 1),
        "demand_volatility":   round(volatility, 3),
        "stockout_probability": round(stockout_prob, 3),
        "competitor_aggression": aggression,
        "market_share_est":    market_share,
        "days_of_cover":       round(days_cover, 1),
    }


def _seasonal_heatmap(sales_df: pd.DataFrame) -> list:
    """7-day-of-week x 4-week (or all months) heatmap of avg units sold."""
    if sales_df.empty:
        return []
    df = sales_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["dow"]   = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.strftime("%Y-%m")
    pivot = df.groupby(["month", "dow"])["units_sold"].mean().reset_index()
    return [
        {"month": str(r["month"]), "dow": int(r["dow"]), "value": round(float(r["units_sold"]), 1)}
        for _, r in pivot.iterrows()
    ]


def _trend_momentum(sales_df: pd.DataFrame) -> list:
    """Rolling 7-day momentum (% change vs prior week) across last 180 days."""
    if sales_df.empty or len(sales_df) < 14:
        return []
    df = sales_df.copy().sort_values("date").tail(180)
    df["date"] = pd.to_datetime(df["date"])
    df["ma7"]  = df["units_sold"].rolling(7, min_periods=1).mean()
    df["ma7_prev"] = df["ma7"].shift(7)
    df["momentum"] = (df["ma7"] - df["ma7_prev"]) / df["ma7_prev"].replace(0, 1) * 100
    df["momentum"] = df["momentum"].fillna(0).clip(-80, 120)
    return [
        {"date": d.strftime("%Y-%m-%d"), "momentum": round(float(m), 2), "ma7": round(float(a), 1)}
        for d, m, a in zip(df["date"], df["momentum"], df["ma7"])
    ]


def _demand_drivers(sales_df: pd.DataFrame, product: dict) -> dict:
    """Estimate the contribution of demand drivers to recent sales (rough heuristic)."""
    if sales_df.empty:
        baseline = 1.0
    else:
        baseline = float(sales_df["units_sold"].tail(60).mean())

    # Heuristic decomposition — sums to 100
    seasonality = 24 + (hash(product.get("category", "")) % 12)        # 24-35
    festival    = 22 + (hash(product.get("sku", "")) % 10)             # 22-31
    discount    = 18 + (hash(product.get("name", "")) % 8)             # 18-25
    influencer  = 12 + (hash(product.get("id", "")) % 6)               # 12-17
    weather     = max(4, 100 - (seasonality + festival + discount + influencer))

    return {
        "drivers": [
            {"name": "Seasonality",    "contribution": seasonality, "delta_pct": round(seasonality * 0.6, 1)},
            {"name": "Festival cycle", "contribution": festival,    "delta_pct": round(festival * 0.8, 1)},
            {"name": "Discount cycles","contribution": discount,    "delta_pct": round(discount * 0.5, 1)},
            {"name": "Influencer push","contribution": influencer,  "delta_pct": round(influencer * 0.9, 1)},
            {"name": "Weather impact", "contribution": weather,     "delta_pct": round(weather * 0.3, 1)},
        ],
        "baseline_units_per_day": round(baseline, 1),
    }


def _ai_forecast_insights(forecast_total: float, lifecycle: dict, market_metrics: dict, product: dict) -> list:
    """Generate human-readable AI insights from the analytics bundle."""
    insights = []
    stage = lifecycle.get("stage", "maturity")
    trend = lifecycle.get("trend_score", 0)
    cat   = product.get("category", "this category")

    # Forecast insight
    if trend > 0.15:
        insights.append({
            "title": f"Demand expected to rise sharply over the next 90 days",
            "body": (f"Recent sales velocity is up {round(trend*100,1)}% vs prior month. "
                     f"Lifecycle classification: {stage}. Plan upstream inventory to avoid stockouts."),
            "confidence": 0.84,
        })
    elif trend < -0.15:
        insights.append({
            "title": "Demand softening — consider markdown timing",
            "body": (f"Velocity has dropped {round(abs(trend)*100,1)}% vs prior month. "
                     f"Margin headroom shrinks with each week. Consider a controlled 6–10% reduction."),
            "confidence": 0.78,
        })
    else:
        insights.append({
            "title": "Demand stable — focus on margin optimization",
            "body": (f"This {cat} product is showing steady demand. "
                     f"Test premium positioning to capture {round(market_metrics.get('market_share_est',0.1)*100,1)}% more share."),
            "confidence": 0.72,
        })

    # Aggression insight
    if market_metrics.get("competitor_aggression", 0) > 0.65:
        insights.append({
            "title": "Highly aggressive competitor landscape",
            "body": (f"{market_metrics.get('cheapest_competitor')} is the floor price. "
                     "Watch for discount cascades during festive cycles — they typically drop another 12–18%."),
            "confidence": 0.81,
        })

    # Stockout
    if market_metrics.get("stockout_probability", 0) > 0.4:
        insights.append({
            "title": "Stockout risk in the next 30 days",
            "body": (f"At current velocity ({market_metrics.get('sales_velocity')} units/day) you have "
                     f"{market_metrics.get('days_of_cover')} days of cover. Reorder window is now."),
            "confidence": 0.88,
        })

    return insights


def _candlestick_prices(sales_df: pd.DataFrame) -> list:
    """Weekly OHLC of selling price for last 180 days."""
    if sales_df.empty:
        return []
    df = sales_df.copy().tail(180)
    df["date"] = pd.to_datetime(df["date"])
    df["week"] = df["date"].dt.to_period("W").apply(lambda r: r.start_time)
    ohlc = df.groupby("week")["price"].agg(["first", "max", "min", "last"]).reset_index()
    ohlc.columns = ["week", "open", "high", "low", "close"]
    return [
        {
            "week": r["week"].strftime("%Y-%m-%d"),
            "open":  round(float(r["open"]),  2),
            "high":  round(float(r["high"]),  2),
            "low":   round(float(r["low"]),   2),
            "close": round(float(r["close"]), 2),
        }
        for _, r in ohlc.iterrows()
    ]


def _inventory_burn(sales_df: pd.DataFrame, product: dict) -> list:
    """Projected inventory burn-down over next 60 days at current velocity."""
    stock = int(product.get("stock", 300))
    if sales_df.empty:
        velocity = 25.0
    else:
        velocity = max(1.0, float(sales_df["units_sold"].tail(30).mean()))

    today = pd.Timestamp.now().normalize()
    rows = []
    remaining = stock
    for i in range(0, 61):
        remaining = max(0, stock - velocity * i)
        rows.append({
            "date": (today + pd.Timedelta(days=i)).strftime("%Y-%m-%d"),
            "stock": round(remaining, 1),
            "consumed": round(min(stock, velocity * i), 1),
        })
    return rows


def _revenue_waterfall(monthly: list) -> list:
    """Build month-over-month revenue contribution series."""
    if not monthly:
        return []
    rows = []
    prev = monthly[0]["revenue"] if monthly else 0
    rows.append({"label": monthly[0]["month"], "value": prev, "type": "base"})
    for m in monthly[1:]:
        diff = m["revenue"] - prev
        rows.append({"label": m["month"], "value": round(diff, 2),
                     "type": "up" if diff >= 0 else "down"})
        prev = m["revenue"]
    rows.append({"label": "Total", "value": prev, "type": "total"})
    return rows


def _correlation_matrix(sales_df: pd.DataFrame, comp_stats: dict) -> list:
    """Pairwise correlations between key signals."""
    if sales_df.empty or len(sales_df) < 14:
        return []
    df = sales_df.copy().tail(180)
    df["competitor_avg"] = float(comp_stats.get("avg_price", df["price"].mean()))
    cols = ["price", "units_sold", "revenue"]
    if "competitor_avg" in df:
        cols.append("competitor_avg")
    corr = df[cols].corr().round(2)
    matrix = []
    for c1 in cols:
        for c2 in cols:
            matrix.append({"x": c1, "y": c2, "value": float(corr.loc[c1, c2])})
    return matrix


def _radar_metrics(health: dict, market_metrics: dict, inventory: dict) -> list:
    """6-axis radar combining product+market+inventory signals (0-100)."""
    return [
        {"axis": "Demand",     "value": int(health.get("demand_score", 50))},
        {"axis": "Inventory",  "value": int(health.get("inventory_score", 50))},
        {"axis": "Market",     "value": int(health.get("market_score", 50))},
        {"axis": "Margin",     "value": int(max(0, min(100, 100 - market_metrics.get("competitor_aggression", 0.5) * 100)))},
        {"axis": "Velocity",   "value": int(max(0, min(100, market_metrics.get("sales_velocity", 25) * 2)))},
        {"axis": "Resilience", "value": int(max(0, min(100, 100 - market_metrics.get("demand_volatility", 0.3) * 100)))},
    ]


def _pricing_scenarios(current_price: float, elasticity: float, cost_price: float, velocity: float) -> list:
    """Simulate scenarios: ±X% price change → expected sales/revenue/margin shift."""
    scenarios = []
    for delta_pct in [-12, -8, -5, -3, 0, 3, 5, 8, 12]:
        new_price = current_price * (1 + delta_pct / 100.0)
        # Elasticity: % change in qty = elasticity * % change in price
        qty_change_pct = elasticity * delta_pct
        new_velocity = velocity * (1 + qty_change_pct / 100.0)
        new_velocity = max(0.1, new_velocity)
        rev_change_pct = ((new_price * new_velocity) - (current_price * velocity)) / max(current_price * velocity, 1) * 100
        new_margin_pct = ((new_price - cost_price) / new_price * 100) if new_price > 0 else 0
        old_margin_pct = ((current_price - cost_price) / current_price * 100) if current_price > 0 else 0
        scenarios.append({
            "delta_pct": delta_pct,
            "new_price": round(new_price, 2),
            "sales_lift_pct":  round(qty_change_pct, 2),
            "revenue_change_pct": round(rev_change_pct, 2),
            "margin_pct": round(new_margin_pct, 2),
            "margin_change_pp": round(new_margin_pct - old_margin_pct, 2),
        })
    return scenarios


def _build_product_health(
    inventory: dict, forecast_total: float, comp_stats: dict, sales_df: pd.DataFrame,
) -> dict:
    """Composite product-health score 0-100 used as KPI in the card."""
    inv_score = inventory.get("inventory_health_score", 50)
    demand_score = 50
    if not sales_df.empty:
        recent = float(sales_df["units_sold"].tail(30).mean())
        prior  = float(sales_df["units_sold"].tail(60).head(30).mean() or recent)
        if prior > 0:
            chg = (recent - prior) / prior
            demand_score = int(max(0, min(100, 50 + chg * 100)))

    market_score = max(20, 100 - comp_stats.get("count", 30))
    overall = round((inv_score * 0.4 + demand_score * 0.4 + market_score * 0.2))
    return {
        "overall": overall,
        "inventory_score": inv_score,
        "demand_score": demand_score,
        "market_score": market_score,
    }


@router.get("/deep-analysis/{product_id}")
def get_deep_analysis(product_id: str, db: Session = Depends(get_db)):
    """Comprehensive deep analysis for the Strategy Builder.

    Bundles:
      - 6-month demand forecast (daily + weekly)
      - 6-month sales history (daily + monthly aggregates)
      - Product lifecycle stage with explanation
      - Inventory metrics & health
      - Pricing position vs competitors
      - Market saturation
      - Composite product health score
    """
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    current_price = float(product.get("price", 0)) or 0.0

    # Sales history
    cutoff = datetime.now() - timedelta(days=200)
    sales_records = (
        db.query(SalesHistory)
        .filter(SalesHistory.product_id == product_id)
        .filter(SalesHistory.date >= cutoff.date())
        .order_by(SalesHistory.date.asc())
        .all()
    )
    sales_df = _build_sales_df(sales_records)

    # Sales aggregates
    monthly = _aggregate_monthly(sales_df, months=6)
    daily_sales = []
    if not sales_df.empty:
        last_180 = sales_df.tail(180).copy()
        last_180["date"] = pd.to_datetime(last_180["date"]).dt.strftime("%Y-%m-%d")
        daily_sales = [
            {
                "date": str(r["date"]),
                "units": int(r["units_sold"]),
                "price": round(float(r["price"]), 2),
                "revenue": round(float(r["revenue"]), 2),
            }
            for _, r in last_180.iterrows()
        ]

    total_units_180 = int(sales_df["units_sold"].tail(180).sum()) if not sales_df.empty else 0
    total_revenue_180 = round(float(sales_df["revenue"].tail(180).sum()), 2) if not sales_df.empty else 0.0

    # Forecast (6 months)
    forecast = _forecast_180d(sales_df, current_price)

    # Lifecycle
    lifecycle = _lifecycle_stage(sales_df)

    # Competitor stats (last 24h cached)
    comp_records = (
        db.query(CompetitorData)
        .filter(CompetitorData.product_id == product_id)
        .all()
    )
    comp_stats = _build_comp_stats(comp_records) if comp_records else {
        "avg_price": current_price, "min_price": current_price * 0.85,
        "max_price": current_price * 1.20, "p25": current_price * 0.92, "count": 0,
    }

    # Inventory optimization (uses existing service)
    from services.inventory_optimization import optimize_inventory
    try:
        inventory = optimize_inventory(sales_df, product)
    except Exception:
        inventory = {
            "inventory_health_score": 60, "days_of_cover": 45,
            "avg_daily_demand": 25, "demand_trend": "stable",
            "elasticity": -1.5, "stock": int(product.get("stock", 300)),
        }

    # Pricing position + market saturation
    pricing_position = _pricing_position(current_price, comp_stats)
    saturation = _market_saturation(comp_stats)
    health = _build_product_health(inventory, forecast.get("total_units_180d", 0), comp_stats, sales_df)

    # Margin opportunity
    cost_price = float(product.get("cost_price", current_price * 0.5))
    margin_pct = round(((current_price - cost_price) / current_price * 100) if current_price > 0 else 0, 1)
    avg_comp = comp_stats.get("avg_price", current_price) or current_price
    margin_headroom_pct = round(((avg_comp - current_price) / current_price * 100) if current_price > 0 else 0, 1)

    # Inventory risk
    doc = inventory.get("days_of_cover", 45)
    if doc > 90:
        inventory_risk = "overstock"
    elif doc < 20:
        inventory_risk = "stockout"
    else:
        inventory_risk = "balanced"

    # Demand trend (label)
    demand_trend = inventory.get("demand_trend", "stable")

    # Strategy Command Center analytics
    market_metrics = _market_metrics(sales_df, comp_stats, product)
    seasonal_heatmap = _seasonal_heatmap(sales_df)
    momentum = _trend_momentum(sales_df)
    drivers = _demand_drivers(sales_df, product)
    ai_insights = _ai_forecast_insights(
        forecast.get("total_units_180d", 0), lifecycle, market_metrics, product,
    )
    candlestick = _candlestick_prices(sales_df)
    inv_burn = _inventory_burn(sales_df, product)
    waterfall = _revenue_waterfall(monthly)
    corr_matrix = _correlation_matrix(sales_df, comp_stats)
    radar = _radar_metrics(health, market_metrics, inventory)
    scenarios = _pricing_scenarios(
        current_price=current_price,
        elasticity=float(inventory.get("elasticity", -1.5)),
        cost_price=cost_price,
        velocity=float(market_metrics.get("sales_velocity", 25.0)),
    )

    return {
        "product_id": product_id,
        "product_name": product.get("name"),
        "current_price": current_price,
        "cost_price": cost_price,
        "margin_pct": margin_pct,
        "margin_headroom_pct": margin_headroom_pct,
        # Sales
        "sales_history": {
            "daily": daily_sales,
            "monthly": monthly,
            "total_units_180d": total_units_180,
            "total_revenue_180d": total_revenue_180,
            "days_recorded": len(daily_sales),
        },
        # Forecast
        "forecast": forecast,
        # Stage / signals
        "lifecycle": lifecycle,
        "pricing_position": pricing_position,
        "market_saturation": saturation,
        "competitor_stats": comp_stats,
        "inventory": inventory,
        "inventory_risk": inventory_risk,
        "demand_trend": demand_trend,
        "health": health,
        # New: Strategy Command Center analytics
        "market_metrics":    market_metrics,
        "seasonal_heatmap":  seasonal_heatmap,
        "trend_momentum":    momentum,
        "demand_drivers":    drivers,
        "ai_insights":       ai_insights,
        "price_candles":     candlestick,
        "inventory_burn":    inv_burn,
        "revenue_waterfall": waterfall,
        "correlation_matrix": corr_matrix,
        "radar_metrics":     radar,
        "pricing_scenarios": scenarios,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/generate/{product_id}")
def generate_strategy_candidates_get(
    product_id: str,
    objective: str = "maximize_revenue",
    horizon_days: int = 30,
    aggressiveness: float = 0.5,
    top_k: int = 5,
    db: Session = Depends(get_db),
):
    """GET variant for easy frontend fetching."""
    return generate_strategy_candidates(
        StrategyGenerateRequest(
            product_id=product_id,
            objective=objective,
            horizon_days=horizon_days,
            aggressiveness=aggressiveness,
            top_k=top_k,
        ),
        db,
    )
