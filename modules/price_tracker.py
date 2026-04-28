"""
Module F — Price Fluctuation Tracker
Tracks historical price changes and computes volatility/trend metrics.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


def compute_price_metrics(processed_df: pd.DataFrame,
                          window: int = 30) -> dict:
    """Compute volatility and trend over the last `window` days."""
    prices = processed_df["price"].values
    recent = prices[-window:] if len(prices) >= window else prices

    volatility = float(np.std(recent))
    mean_price = float(np.mean(recent))
    min_price = float(np.min(recent))
    max_price = float(np.max(recent))

    # Linear trend slope
    x = np.arange(len(recent)).reshape(-1, 1)
    lr = LinearRegression().fit(x, recent)
    trend_slope = float(lr.coef_[0])
    if trend_slope > 1:
        trend_dir = "Upward"
    elif trend_slope < -1:
        trend_dir = "Downward"
    else:
        trend_dir = "Stable"

    return {
        "volatility": round(volatility, 2),
        "mean_price": round(mean_price, 2),
        "min_price": round(min_price, 2),
        "max_price": round(max_price, 2),
        "trend_slope": round(trend_slope, 3),
        "trend_direction": trend_dir,
        "window_days": window,
    }


def compute_daily_volatility(processed_df: pd.DataFrame,
                             window: int = 14) -> pd.DataFrame:
    """Return a rolling volatility series for charting."""
    df = processed_df[["date", "price"]].copy()
    df["rolling_std"] = df["price"].rolling(window, min_periods=1).std()
    return df
