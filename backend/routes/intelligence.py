"""Intelligence API route.

GET /api/intelligence/{product_id}
    Returns 8-signal AI data intelligence bundle per product.
"""
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory, CompetitorData
from services.product_catalog import get_product
from services.ml_engine import build_features
from services.intelligence_engine import compute_all_signals

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence"])


def _load_dataframes(product_id: str, db: Session):
    sales_q  = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)

    comp_q   = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    comp_df  = pd.read_sql(comp_q.statement, db.bind)

    if not sales_df.empty:
        sales_df["date"] = pd.to_datetime(sales_df["date"]).dt.strftime("%Y-%m-%d")

    return sales_df, comp_df


@router.get("/{product_id}")
def get_intelligence(product_id: str, db: Session = Depends(get_db)):
    """Full AI intelligence bundle for a product."""
    product = get_product(product_id)
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    sales_df, comp_df = _load_dataframes(product_id, db)

    # Build rich feature dict
    if not sales_df.empty:
        features = build_features(sales_df, product)
        if not comp_df.empty and "price" in comp_df.columns:
            features["competitor_avg_price"] = float(comp_df["price"].mean())
    else:
        features = {
            "current_price":      product["price"],
            "cost_price":         product["cost_price"],
            "stock":              product["stock"],
            "price_std":          0,
            "competitor_avg_price": product["price"] * 1.02,
        }

    bundle = compute_all_signals(product, sales_df, comp_df, features)
    bundle["product_id"] = product_id
    bundle["product_name"] = product["name"]

    return bundle
