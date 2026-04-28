"""Data processing — feature engineering pipeline."""
import numpy as np
import pandas as pd


def process_data(sales_df: pd.DataFrame, competitor_df: pd.DataFrame) -> pd.DataFrame:
    sales = sales_df.copy()
    comp = competitor_df.copy()

    for col in ["id"]:
        if col in sales.columns:
            sales = sales.drop(columns=[col])
        if col in comp.columns:
            comp = comp.drop(columns=[col])

    if "competitor_avg_price" in sales.columns:
        sales = sales.drop(columns=["competitor_avg_price"])

    comp_avg = comp.groupby("date")["price"].mean().reset_index().rename(
        columns={"price": "competitor_avg_price"})

    df = sales.merge(comp_avg, on="date", how="left")
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df["competitor_avg_price"] = df["competitor_avg_price"].ffill().bfill()

    df["price_difference"] = df["competitor_avg_price"] - df["price"]
    df["demand_ma_7"] = df["units_sold"].rolling(7, min_periods=1).mean()
    df["demand_ma_14"] = df["units_sold"].rolling(14, min_periods=1).mean()
    df["demand_trend"] = df["demand_ma_7"].pct_change(periods=7).fillna(0)
    df["price_ma_7"] = df["price"].rolling(7, min_periods=1).mean()
    df["price_ma_14"] = df["price"].rolling(14, min_periods=1).mean()
    df["revenue_ma_7"] = df["revenue"].rolling(7, min_periods=1).mean()
    df["day_of_week"] = df["date"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["stock_category"] = pd.cut(df["stock"], bins=[-1, 100, 350, float("inf")],
                                   labels=["Low", "Medium", "High"])
    df["price_index"] = df["price"] / df["competitor_avg_price"]
    return df


def get_latest_features(processed_df: pd.DataFrame) -> dict:
    row = processed_df.iloc[-1]
    return {
        "date": str(row["date"].date()) if hasattr(row["date"], "date") else str(row["date"]),
        "current_price": float(row["price"]),
        "units_sold": int(row["units_sold"]),
        "competitor_avg_price": float(row["competitor_avg_price"]),
        "price_difference": float(row["price_difference"]),
        "demand_trend": float(row["demand_trend"]),
        "demand_ma_7": float(row["demand_ma_7"]),
        "stock": int(row["stock"]),
        "stock_category": str(row["stock_category"]),
        "rating": float(row["rating"]),
        "revenue": float(row["revenue"]),
        "revenue_ma_7": float(row["revenue_ma_7"]),
        "price_index": float(row["price_index"]),
        "is_weekend": int(row["is_weekend"]),
    }
