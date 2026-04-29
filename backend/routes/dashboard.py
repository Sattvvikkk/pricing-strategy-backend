"""Dashboard API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import pandas as pd

from database import get_db
from models import SalesHistory, CompetitorData, Product
from schemas import DashboardResponse, ScenarioRequest, ScenarioResponse
from services.data_processing import process_data, get_latest_features
from services.ml_engine import train_demand_model, optimal_price_search
from services.pricing_engine import compute_recommendation, scenario_recommendation
from services.forecasting import forecast_demand
from services.explainer import generate_explanation
from services.marketplace_aggregator import get_competitor_avg_price

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _load_processed(db: Session):
    sales = pd.read_sql(db.query(SalesHistory).statement, db.bind)
    comp = pd.read_sql(db.query(CompetitorData).statement, db.bind)
    return process_data(sales, comp)


@router.get("", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    processed = _load_processed(db)
    features = get_latest_features(processed)

    # Pin current_price to the product base_price (e.g. ₹799) — not the drifted sim price
    product = db.query(Product).first()
    if product:
        features["current_price"] = float(product.base_price)

    # Override with real-time live scraper data
    live_comp_avg = get_competitor_avg_price()
    features["competitor_avg_price"] = live_comp_avg
    features["price_difference"] = live_comp_avg - features["current_price"]
    features["price_index"] = features["current_price"] / live_comp_avg if live_comp_avg else 1.0

    # ML
    xgb_model = train_demand_model(processed)
    ml_result = optimal_price_search(xgb_model, features, processed)
    rec = compute_recommendation(features, ml_result)

    # Volatility
    vol = float(processed["price"].tail(30).std())

    explanation = generate_explanation(rec, features, vol)

    return {
        "product": {
            "name": product.name, "base_price": product.base_price,
            "cost_price": product.cost_price, "current_price": product.base_price,
            "stock": features["stock"], "rating": features["rating"],
        },
        "kpis": {
            "current_price": features["current_price"],
            "recommended_price": rec["recommended_price"],
            "action": rec["action"],
            "revenue_impact_pct": rec["revenue_impact_pct"],
            "confidence": rec["confidence"],
            "monthly_revenue": float(processed["revenue"].tail(30).sum()),
            "avg_daily_demand": features["demand_ma_7"],
            "price_index": features["price_index"],
            "volatility": round(vol, 1),
            "price_trend": "Upward" if processed["price"].tail(30).diff().mean() > 1 else
                           "Downward" if processed["price"].tail(30).diff().mean() < -1 else "Stable",
        },
        "explanation": explanation,
        "rule_price": rec["rule_price"],
        "ml_price": rec["ml_price"],
    }


@router.post("/scenario", response_model=ScenarioResponse)
def run_scenario(req: ScenarioRequest, db: Session = Depends(get_db)):
    processed = _load_processed(db)
    features = get_latest_features(processed)
    xgb_model = train_demand_model(processed)
    ml_result = optimal_price_search(xgb_model, features, processed)
    sc = scenario_recommendation(features, ml_result,
                                  req.demand_change_pct, req.competitor_price_change_pct)
    return {
        "recommended_price": sc["recommended_price"],
        "action": sc["action"],
        "revenue_impact_pct": sc["revenue_impact_pct"],
    }
