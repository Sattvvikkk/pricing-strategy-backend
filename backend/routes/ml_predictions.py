"""
ML Predictions Route
====================
GET /api/ml/predictions?product_id=<id>

Returns unified output from all 5 ML models:
  - Demand Forecasting Ensemble (XGBoost + Prophet + optional LSTM)
  - Advanced Elasticity Model
  - Competitor Reaction Model
  - Inventory Optimization Model
  - Customer Segmentation Model (K-Means + DBSCAN)

Responses are cached in-memory per product_id for 5 minutes.
"""
import time
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory, CompetitorData
from services.product_catalog import get_product
from services.product_enrichment import enrich_product
from services.ml_orchestrator import run_analysis
from services.demand_forecasting_ensemble import run_ensemble_forecast
from services.elasticity_model import compute_advanced_elasticity
from services.competitor_reaction_model import predict_competitor_reactions
from services.inventory_optimization import optimize_inventory
from services.customer_segmentation import segment_customers

router = APIRouter(prefix="/api/ml", tags=["ML Predictions"])

# ── Simple in-memory cache ────────────────────────────────────────────────────
_cache: dict[str, dict] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _get_cached(product_id: str) -> dict | None:
    entry = _cache.get(product_id)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL_SECONDS:
        return entry["data"]
    return None


def _set_cached(product_id: str, data: dict) -> None:
    _cache[product_id] = {"ts": time.time(), "data": data}


# ── Data loading helpers ──────────────────────────────────────────────────────

def _load_sales(product_id: str, db: Session) -> pd.DataFrame:
    q  = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    df = pd.read_sql(q.statement, db.bind)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    return df


def _load_competitors(product_id: str, db: Session) -> pd.DataFrame:
    q  = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    df = pd.read_sql(q.statement, db.bind)
    return df


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/predictions")
def ml_predictions(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    refresh: bool   = Query(default=False),
    db: Session     = Depends(get_db),
):
    """
    Run all 5 ML models and return unified prediction payload.

    Query params
    ------------
    product_id : str  — product slug
    refresh    : bool — force cache bypass (default False)
    """
    if not refresh:
        cached = _get_cached(product_id)
        if cached:
            return {**cached, "cached": True}

    product = get_product(product_id)
    if not product:
        product = {
            "name": "Unknown Product", "brand": "Vouge Studio",
            "price": 799, "cost_price": 400, "stock": 300, "rating": 4.2,
        }

    sales_df = _load_sales(product_id, db)
    comp_df  = _load_competitors(product_id, db)

    # ── Run all models ────────────────────────────────────────────────────────
    demand_forecast = run_ensemble_forecast(sales_df, periods=14)
    elasticity      = compute_advanced_elasticity(sales_df, product)
    competitor      = predict_competitor_reactions(comp_df, product)
    inventory       = optimize_inventory(sales_df, product)
    segmentation    = segment_customers(sales_df, product)

    result = {
        "product_id":      product_id,
        "product_name":    product.get("name", ""),
        "demand_forecast": demand_forecast,
        "elasticity":      elasticity,
        "competitor":      competitor,
        "inventory":       inventory,
        "segmentation":    segmentation,
        "computed_at":     pd.Timestamp.now().isoformat(),
        "cached":          False,
    }

    _set_cached(product_id, result)
    return result


# ── New: Multi-Agent Orchestrator endpoint ───────────────────────────────────

@router.get("/run-analysis")
@router.post("/run-analysis")
def run_multi_agent_analysis(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """
    Run the 7-agent ML orchestrator and return the unified blueprint payload:
      data_quality · forecast · elasticity_score · recommended_price_band
      · competitor_response · inventory_risk · customer_segmentation
      · insights · recommended_action · confidence_score
    """
    base = get_product(product_id)
    if not base:
        return {"error": "Product not found", "product_id": product_id}

    enriched = enrich_product(base)
    sales_df = _load_sales(product_id, db)
    comp_df = _load_competitors(product_id, db)

    return run_analysis(enriched, sales_df=sales_df, comp_df=comp_df)
