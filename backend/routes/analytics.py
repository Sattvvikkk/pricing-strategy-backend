"""Analytics API routes.
Endpoints:
  GET /api/analytics/price-trend?product_id=
  GET /api/analytics/demand-price?product_id=
  GET /api/analytics/revenue?product_id=
  GET /api/analytics/elasticity?product_id=
  GET /api/analytics/competitor-comparison?product_id=
  GET /api/analytics/forecast?product_id=
"""
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory, CompetitorData
from services.product_catalog import get_product
from services.data_processing import process_data
from services.ml_engine import compute_elasticity_curve
from services.forecasting import forecast_demand

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_processed(product_id: str, db: Session) -> pd.DataFrame:
    """Load, join, and feature-engineer data for a product."""
    product = get_product(product_id)

    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)

    comp_q = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    comp_df = pd.read_sql(comp_q.statement, db.bind)

    # Normalise date column on competitor data
    if not comp_df.empty and "scraped_at" in comp_df.columns:
        comp_df["date"] = pd.to_datetime(comp_df["scraped_at"]).dt.strftime("%Y-%m-%d")
    elif comp_df.empty:
        comp_df = pd.DataFrame({
            "date": sales_df["date"].astype(str).unique().tolist(),
            "price": [product["price"] * 1.02] * len(sales_df["date"].unique()),
        })

    sales_df["date"] = pd.to_datetime(sales_df["date"]).dt.strftime("%Y-%m-%d")
    comp_df["date"] = comp_df["date"].astype(str)

    sales_df["stock"] = product["stock"] if product else 300
    sales_df["rating"] = product["rating"] if product else 4.2

    return process_data(sales_df, comp_df), comp_df


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/price-trend")
def price_trend(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """Price vs time with 14-day moving average."""
    processed, _ = _load_processed(product_id, db)
    data = processed[["date", "price", "price_ma_14"]].copy()
    data["date"] = data["date"].astype(str)
    data = data.rename(columns={"price_ma_14": "price_ma_14"})
    return {"data": data.to_dict(orient="records")}


@router.get("/demand-price")
def demand_price(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """Demand vs Price scatter data."""
    processed, _ = _load_processed(product_id, db)
    data = processed[["price", "units_sold"]].copy()
    return {"data": data.to_dict(orient="records")}


@router.get("/revenue")
def revenue(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """Revenue trend with 7-day moving average."""
    processed, _ = _load_processed(product_id, db)
    data = processed[["date", "revenue", "revenue_ma_7"]].copy()
    data["date"] = data["date"].astype(str)
    return {"data": data.to_dict(orient="records")}


@router.get("/elasticity")
def elasticity(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """Price elasticity curve — demand & revenue at various price points."""
    processed, _ = _load_processed(product_id, db)
    curve = compute_elasticity_curve(processed)
    return {"data": curve}


@router.get("/competitor-comparison")
def competitor_comparison(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """Our price vs per-platform competitor prices over time."""
    product = get_product(product_id)

    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)

    comp_q = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    comp_df = pd.read_sql(comp_q.statement, db.bind)

    if sales_df.empty:
        return {"data": []}

    # Normalise dates
    sales_df["date"] = pd.to_datetime(sales_df["date"]).dt.strftime("%Y-%m-%d")

    # Build our daily price series
    our_daily = sales_df.groupby("date")["price"].mean().reset_index()
    our_daily.columns = ["date", "our_price"]

    if comp_df.empty:
        return {"data": our_daily.to_dict(orient="records")}

    if "scraped_at" in comp_df.columns:
        comp_df["date"] = pd.to_datetime(comp_df["scraped_at"]).dt.strftime("%Y-%m-%d")
    comp_df["date"] = comp_df["date"].astype(str)

    # Pivot competitor data by platform
    comp_pivot = comp_df.groupby(["date", "platform"])["price"].mean().unstack("platform").reset_index()

    merged = our_daily.merge(comp_pivot, on="date", how="left")
    merged = merged.sort_values("date")

    # Forward-fill competitor prices for chart continuity
    platform_cols = [c for c in merged.columns if c not in ("date", "our_price")]
    for col in platform_cols:
        merged[col] = merged[col].ffill().bfill()

    return {"data": merged.to_dict(orient="records")}


@router.get("/forecast")
def forecast(
    product_id: str = Query(default="vs-essential-cotton-tee"),
    db: Session = Depends(get_db),
):
    """14-day demand forecast with confidence interval."""
    processed, _ = _load_processed(product_id, db)

    fc = forecast_demand(processed)

    # Actual data — last 30 days
    actual = processed[["date", "units_sold"]].tail(30).copy()
    actual["date"] = actual["date"].astype(str)
    actual_records = [{"date": r["date"], "actual": r["units_sold"]}
                      for r in actual.to_dict(orient="records")]

    # Predicted
    fc["date"] = fc["ds"].dt.strftime("%Y-%m-%d")
    predicted_records = fc[["date", "yhat", "yhat_lower", "yhat_upper"]].to_dict(orient="records")

    return {"actual": actual_records, "predicted": predicted_records}


@router.get("/{product_id}")
def get_analytics(product_id: str, db: Session = Depends(get_db)):
    """Unified endpoint returning all data needed for Analytics page (5 charts)."""
    product = get_product(product_id)
    processed, comp_df = _load_processed(product_id, db)

    # Chart 1: Price Trend (last 90 days)
    price_trend = processed[["date", "price"]].tail(90).copy()
    price_trend["date"] = price_trend["date"].astype(str)

    # Calculate competitor average
    if not comp_df.empty and "date" in comp_df.columns:
        comp_avg = comp_df.groupby("date")["price"].mean().reset_index()
        comp_avg.columns = ["date", "competitor_avg"]
        price_trend = price_trend.merge(comp_avg, on="date", how="left")
        price_trend["competitor_avg"] = price_trend["competitor_avg"].ffill()
    else:
        price_trend["competitor_avg"] = price_trend["price"] * 1.02

    # Replace NaN with None for JSON serialization using fillna
    price_trend = price_trend.fillna(0)

    # Chart 2: Elasticity Curve
    try:
        curve = compute_elasticity_curve(processed)
    except:
        curve = []
    # Replace NaN values in curve
    for item in curve:
        for key, value in item.items():
            if isinstance(value, float):
                if value != value or pd.isna(value):  # NaN check
                    item[key] = 0
    current_price = float(product["price"]) if product else 799
    recommended_price = current_price * 1.05  # Simple recommendation logic

    # Chart 3: Revenue by Day (last 30 days)
    revenue_30 = processed[["date", "revenue"]].tail(30).copy()
    revenue_30["date"] = revenue_30["date"].astype(str)
    avg_revenue = float(revenue_30["revenue"].mean()) if not revenue_30["revenue"].isna().all() else 0
    # Replace NaN with 0
    revenue_30 = revenue_30.fillna(0)

    # Chart 4: Weekly Demand Heatmap (91 days = 13 weeks)
    heatmap_data = processed[["date", "units_sold"]].tail(91).copy()
    heatmap_data["date"] = pd.to_datetime(heatmap_data["date"])
    heatmap_data["day_of_week"] = heatmap_data["date"].dt.dayofweek
    heatmap_data["week"] = (heatmap_data["date"] - heatmap_data["date"].min()).dt.days // 7

    # Create 7x13 grid
    heatmap_grid = []
    for week in range(13):
        for dow in range(7):
            cell_data = heatmap_data[(heatmap_data["week"] == week) & (heatmap_data["day_of_week"] == dow)]
            if not cell_data.empty:
                avg_units = float(cell_data["units_sold"].mean())
                if avg_units != avg_units or pd.isna(avg_units):  # NaN check
                    avg_units = 0
            else:
                avg_units = 0
            heatmap_grid.append({
                "week": week,
                "day_of_week": dow,
                "units": avg_units
            })

    # Chart 5: Competitor Comparison (horizontal bar)
    if not comp_df.empty:
        comp_comparison = comp_df.groupby("platform")["price"].mean().reset_index()
        comp_comparison = comp_comparison.sort_values("price")
        comp_comparison["is_vouge"] = False
        # Add our price
        our_row = {"platform": "Vouge Studio", "price": current_price, "is_vouge": True}
        comp_comparison = pd.concat([comp_comparison, pd.DataFrame([our_row])], ignore_index=True)
        comp_comparison = comp_comparison.sort_values("price")
        comp_comparison = comp_comparison.fillna(0)
        comp_comparison = comp_comparison.to_dict(orient="records")
    else:
        comp_comparison = [{"platform": "Vouge Studio", "price": current_price, "is_vouge": True}]

    return {
        "price_trend": price_trend.to_dict(orient="records"),
        "elasticity": {
            "curve": curve,
            "current_price": current_price,
            "recommended_price": recommended_price
        },
        "revenue": {
            "data": revenue_30.to_dict(orient="records"),
            "average": avg_revenue
        },
        "heatmap": heatmap_grid,
        "competitor_comparison": comp_comparison
    }
