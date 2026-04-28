"""Marketplace API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import pandas as pd

from database import get_db
from models import CompetitorData, Product
from schemas import MarketplaceResponse, MarketplacePrice
from auth.jwt_handler import get_current_user
from services.marketplace_aggregator import get_all_prices

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])


@router.get("/prices", response_model=MarketplaceResponse)
def get_marketplace_prices(db: Session = Depends(get_db)):
    prices = get_all_prices()
    product = db.query(Product).first()
    return {
        "prices": [MarketplacePrice(**p) for p in prices],
        "our_price": product.current_price if product else 799,
    }


@router.post("/refresh")
def refresh_prices(db: Session = Depends(get_db)):
    prices = get_all_prices()
    return {"status": "refreshed", "count": len(prices), "prices": prices}


@router.get("/comparison")
def marketplace_comparison(db: Session = Depends(get_db)):
    comp = pd.read_sql(db.query(CompetitorData).statement, db.bind)
    summary = comp.groupby("marketplace").agg(
        avg_price=("price", "mean"),
        min_price=("price", "min"),
        max_price=("price", "max"),
        avg_rating=("rating", "mean"),
        brands=("brand", "nunique"),
    ).round(1).reset_index()
    return {"data": summary.to_dict(orient="records")}
