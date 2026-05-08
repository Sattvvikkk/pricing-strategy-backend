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

    current_price = float(product["price"])
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
