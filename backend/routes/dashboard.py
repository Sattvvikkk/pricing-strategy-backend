"""Dashboard API routes.
Endpoints:
  GET  /api/dashboard?product_id=<id>
  POST /api/dashboard/scenario?product_id=<id>
"""
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import SalesHistory, CompetitorData
from services.product_catalog import DEFAULT_PRODUCTS, get_product
from services.data_processing import process_data, get_latest_features
from services.ml_engine import (
    build_features, train_demand_model, optimal_price_search,
    estimate_elasticity,
)
from services.pricing_engine import compute_recommendation, scenario_recommendation
from services.strategy_classifier import (
    classify_archetype, calculate_price_corridor, generate_risk_flags,
)
from services.forecasting import forecast_demand
from services.explainer import generate_explanation

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


class ScenarioRequest(BaseModel):
    demand_change_pct: float = 0.0
    competitor_price_change_pct: float = 0.0


def _load_sales_comp(product_id: str, product: dict, db: Session):
    """Load and normalise sales + competitor DataFrames from the DB."""
    sales_q  = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)

    if sales_df.empty:
        raise HTTPException(404, "No sales data found for this product")

    comp_q  = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    comp_df = pd.read_sql(comp_q.statement, db.bind)

    # Normalise date columns
    sales_df["date"] = pd.to_datetime(sales_df["date"]).dt.strftime("%Y-%m-%d")

    if comp_df.empty:
        comp_df = pd.DataFrame({
            "date":  sales_df["date"].unique().tolist(),
            "price": [product["price"] * 1.02] * len(sales_df["date"].unique()),
        })
    else:
        if "scraped_at" in comp_df.columns:
            comp_df["date"] = pd.to_datetime(comp_df["scraped_at"]).dt.strftime("%Y-%m-%d")
        elif "date" in comp_df.columns:
            comp_df["date"] = pd.to_datetime(comp_df["date"]).dt.strftime("%Y-%m-%d")

    comp_df["date"] = comp_df["date"].astype(str)

    # Inject catalog fields not stored in SalesHistory
    sales_df["stock"]  = product["stock"]
    sales_df["rating"] = product["rating"]

    return sales_df, comp_df


def _build_dashboard_bundle(product_id: str, db: Session) -> dict:
    """Core logic: load data, run ML pipeline, return full dashboard bundle."""
    product = get_product(product_id)
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    sales_df, comp_df = _load_sales_comp(product_id, product, db)

    # ── Feature engineering (legacy processed_df for forecast) ───────────────
    processed = process_data(sales_df, comp_df)

    # ── New-style features from build_features ────────────────────────────────
    features = build_features(sales_df, product)

    # Enrich competitor_avg_price from DB data
    if not comp_df.empty and "price" in comp_df.columns:
        features["competitor_avg_price"] = float(comp_df["price"].mean())

    # ── ML pipeline ──────────────────────────────────────────────────────────
    model      = train_demand_model(sales_df)
    ml_result  = optimal_price_search(model, features, sales_df)
    elasticity = estimate_elasticity(sales_df)

    # Pass elasticity into features so pricing_engine can use it
    features["elasticity"] = elasticity

    # ── Strategy classification ───────────────────────────────────────────────
    margin_pct = float(features["margin_pct"])
    comp_stats = {
        "avg_price":        features["competitor_avg_price"],
        "min_price":        float(comp_df["price"].min()) if "price" in comp_df else features["competitor_avg_price"] * 0.85,
        "max_price":        float(comp_df["price"].max()) if "price" in comp_df else features["competitor_avg_price"] * 1.15,
        "competitor_count": int(comp_df["platform"].nunique()) if "platform" in comp_df.columns else 4,
    }

    archetype      = classify_archetype(features, comp_stats, elasticity, margin_pct)
    volatility     = round(float(sales_df["price"].std()), 2)
    price_corridor = calculate_price_corridor(
        features["current_price"], features["cost_price"], comp_stats, volatility,
    )
    risk_flags     = generate_risk_flags(features, comp_stats, archetype)

    # ── Pricing recommendation ────────────────────────────────────────────────
    rec = compute_recommendation(features, ml_result)

    # ── Extra KPIs ────────────────────────────────────────────────────────────
    monthly_revenue  = round(float(processed["revenue"].tail(30).sum()), 2)
    avg_daily_demand = round(float(processed["units_sold"].tail(30).mean()), 1)
    price_index      = round(
        float(features["current_price"] / features["competitor_avg_price"])
        if features["competitor_avg_price"] > 0 else 1.0, 2
    )
    demand_trend_label = (
        "Rising"  if features["demand_ma_7"] > features["demand_ma_30"] * 1.03 else
        "Falling" if features["demand_ma_7"] < features["demand_ma_30"] * 0.97 else
        "Stable"
    )

    explanation = generate_explanation(rec, features, volatility, archetype)

    return {
        "product": {
            "name":          product["name"],
            "brand":         product["brand"],
            "base_price":    product["price"],
            "cost_price":    product["cost_price"],
            "current_price": features["current_price"],
            "stock":         product["stock"],
            "rating":        product["rating"],
        },
        "kpis": {
            "current_price":      rec["current_price"],
            "recommended_price":  rec["recommended_price"],
            "action":             rec["action"],
            "revenue_impact_pct": rec["revenue_impact_pct"],
            "confidence":         rec["confidence"],
            "monthly_revenue":    monthly_revenue,
            "avg_daily_demand":   avg_daily_demand,
            "price_index":        price_index,
            "volatility":         volatility,
            "price_trend":        demand_trend_label,
        },
        "ml": {
            "elasticity":         round(elasticity, 4),
            "archetype":          archetype,
            "price_corridor":     price_corridor,
            "ml_price":           rec["ml_price"],
            "rule_price":         rec["rule_price"],
            "max_daily_revenue":  ml_result.get("max_daily_revenue", 0),
        },
        "risk_flags":  risk_flags,
        "explanation": explanation,
        # Legacy keys kept for backward-compat with old Dashboard.jsx renders
        "rule_price": rec["rule_price"],
        "ml_price":   rec["ml_price"],
    }


@router.get("")
def get_dashboard(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """Return full dashboard bundle for a product."""
    return _build_dashboard_bundle(product_id, db)


@router.post("/scenario")
def run_scenario(
    req: ScenarioRequest,
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """Run a what-if scenario and return adjusted recommendation."""
    product = get_product(product_id)
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    sales_df, comp_df = _load_sales_comp(product_id, product, db)

    features   = build_features(sales_df, product)
    if not comp_df.empty and "price" in comp_df.columns:
        features["competitor_avg_price"] = float(comp_df["price"].mean())

    model     = train_demand_model(sales_df)
    ml_result = optimal_price_search(model, features, sales_df)

    scenario = scenario_recommendation(
        features, ml_result,
        demand_change_pct=req.demand_change_pct,
        comp_change_pct=req.competitor_price_change_pct,
    )

    return {
        "recommended_price":  scenario["recommended_price"],
        "action":             scenario["action"],
        "revenue_impact_pct": scenario["revenue_impact_pct"],
    }
