"""Analytics API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import pandas as pd

from database import get_db
from models import SalesHistory, CompetitorData
from schemas import AnalyticsResponse
from auth.jwt_handler import get_current_user
from services.data_processing import process_data
from services.ml_engine import compute_elasticity_curve
from services.forecasting import forecast_demand

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def _load(db):
    s = pd.read_sql(db.query(SalesHistory).statement, db.bind)
    c = pd.read_sql(db.query(CompetitorData).statement, db.bind)
    return process_data(s, c)


@router.get("/price-trend")
def price_trend(db: Session = Depends(get_db)):
    p = _load(db)
    data = [{"date": str(r["date"].date()), "price": r["price"],
             "price_ma_14": round(r["price_ma_14"], 1)} for _, r in p.iterrows()]
    return {"data": data}


@router.get("/demand-price")
def demand_vs_price(db: Session = Depends(get_db)):
    p = _load(db)
    data = [{"price": r["price"], "units_sold": r["units_sold"],
             "revenue": r["revenue"], "date": str(r["date"].date())} for _, r in p.iterrows()]
    return {"data": data}


@router.get("/revenue")
def revenue_trend(db: Session = Depends(get_db)):
    p = _load(db)
    data = [{"date": str(r["date"].date()), "revenue": r["revenue"],
             "revenue_ma_7": round(r["revenue_ma_7"], 1)} for _, r in p.iterrows()]
    return {"data": data}


@router.get("/competitor-comparison")
def competitor_comparison(db: Session = Depends(get_db)):
    try:
        s = pd.read_sql(db.query(SalesHistory).statement, db.bind)
        c = pd.read_sql(db.query(CompetitorData).statement, db.bind)

        # Our price by date
        our = s[["date", "price"]].rename(columns={"price": "our_price"})
        # Competitor avg by marketplace and date
        comp_avg = c.groupby(["date", "marketplace"])["price"].mean().reset_index()
        pivot = comp_avg.pivot(index="date", columns="marketplace", values="price").reset_index()
        merged = our.merge(pivot, on="date", how="left").ffill()
        data = merged.to_dict(orient="records")
        return {"data": data}
    except Exception as e:
        return {"data": [], "error": str(e)}


@router.get("/elasticity")
def elasticity(db: Session = Depends(get_db)):
    p = _load(db)
    curve = compute_elasticity_curve(p)
    return {"data": curve}


@router.get("/forecast")
def forecast(db: Session = Depends(get_db)):
    p = _load(db)
    fc = forecast_demand(p)
    # Include last 14 days actual for context
    last14 = p.tail(14)[["date", "units_sold"]].copy()
    actual = [{"date": str(r["date"].date()), "actual": r["units_sold"]} for _, r in last14.iterrows()]
    predicted = [{"date": str(r["ds"].date()) if hasattr(r["ds"], "date") else str(r["ds"]),
                  "yhat": r["yhat"], "yhat_lower": r["yhat_lower"],
                  "yhat_upper": r["yhat_upper"]} for _, r in fc.iterrows()]
    return {"actual": actual, "predicted": predicted}
