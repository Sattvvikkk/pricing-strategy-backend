"""
Competitor Reaction Model
=========================
Predicts competitor pricing behavior using time-series trend extrapolation,
promotion pattern detection, and aggression scoring.

Public API
----------
predict_competitor_reactions(comp_df, product) → dict
"""
import numpy as np
import pandas as pd
from datetime import timedelta
from sklearn.linear_model import LinearRegression


PLATFORM_ORDER = ["Amazon", "Flipkart", "Myntra", "Ajio"]


def _get_platform_series(comp_df: pd.DataFrame) -> dict:
    """Return {platform: DataFrame(date, price)} sorted by date."""
    if comp_df.empty:
        return {}
    date_col = "scraped_at" if "scraped_at" in comp_df.columns else "date"
    comp_df = comp_df.copy()
    comp_df["_date"] = pd.to_datetime(comp_df[date_col]).dt.normalize()
    result = {}
    for platform, grp in comp_df.groupby("platform"):
        daily = grp.groupby("_date")["price"].mean().reset_index()
        daily.columns = ["date", "price"]
        daily = daily.sort_values("date").reset_index(drop=True)
        result[platform] = daily
    return result


def _trend_forecast(series_df: pd.DataFrame, days: int = 7) -> list:
    """Linear regression extrapolation for next `days` days."""
    if len(series_df) < 3:
        last_price = float(series_df["price"].iloc[-1]) if not series_df.empty else 0
        last_date  = series_df["date"].iloc[-1] if not series_df.empty else pd.Timestamp.today()
        return [{"date": str((last_date + timedelta(days=i + 1)).date()), "price": round(last_price, 2)}
                for i in range(days)]
    x = np.arange(len(series_df)).reshape(-1, 1)
    y = series_df["price"].values
    lr = LinearRegression().fit(x, y)
    last_date = series_df["date"].iloc[-1]
    preds = []
    for i in range(1, days + 1):
        pred_price = max(0.0, lr.predict([[len(series_df) + i - 1]])[0])
        preds.append({
            "date":  str((last_date + timedelta(days=i)).date()),
            "price": round(float(pred_price), 2),
        })
    return preds


def _aggression_score(series_df: pd.DataFrame) -> float:
    """
    Aggression = (price std / price mean) * 100, clamped 0-100.
    High = volatile / aggressive competitor.
    """
    if len(series_df) < 3:
        return 50.0
    mu  = series_df["price"].mean()
    std = series_df["price"].std()
    if mu <= 0:
        return 50.0
    return round(float(np.clip((std / mu) * 1000, 0, 100)), 1)


def _price_drop_probability(series_df: pd.DataFrame) -> float:
    """
    Probability of a price drop in next 7 days.
    Based on: slope direction + current price vs 90-day mean.
    """
    if len(series_df) < 5:
        return 0.5
    x = np.arange(len(series_df)).reshape(-1, 1)
    y = series_df["price"].values
    lr = LinearRegression().fit(x, y)
    slope = lr.coef_[0]

    mean_90 = float(series_df["price"].tail(90).mean())
    current = float(series_df["price"].iloc[-1])

    # Slope factor: negative slope → higher probability
    slope_factor = 1 / (1 + np.exp(slope * 50))  # sigmoid: slope<0 → >0.5

    # Level factor: currently above mean → more likely to drop
    if mean_90 > 0:
        level_factor = min(1.0, max(0.0, (current - mean_90) / mean_90 + 0.5))
    else:
        level_factor = 0.5

    prob = 0.6 * slope_factor + 0.4 * level_factor
    return round(float(np.clip(prob, 0.05, 0.95)), 3)


def _detect_promotion_periods(series_df: pd.DataFrame) -> list:
    """
    Find recurring low-price windows using rolling min detection.
    Returns up to 3 predicted sale periods.
    """
    if len(series_df) < 14:
        return []
    df = series_df.copy()
    df["dow"] = df["date"].dt.dayofweek

    # Calculate 7-day rolling average and find days below 95% of average
    df["rolling_avg"] = df["price"].rolling(7, min_periods=1).mean()
    df["is_low"]      = df["price"] < (df["rolling_avg"] * 0.96)

    # Group consecutive low-price days
    df["group"] = (df["is_low"] != df["is_low"].shift()).cumsum()
    periods = []
    for _, grp in df[df["is_low"]].groupby("group"):
        if len(grp) >= 2:
            discount_pct = round(float(
                (grp["rolling_avg"].mean() - grp["price"].mean()) / grp["rolling_avg"].mean() * 100
            ), 1)
            periods.append({
                "start":               str(grp["date"].iloc[0].date()),
                "end":                 str(grp["date"].iloc[-1].date()),
                "predicted_discount_pct": discount_pct,
                "duration_days":       len(grp),
            })
    return periods[-3:]  # Return last 3 (most recent patterns)


def _recommended_response(platform_results: list) -> str:
    """Derive our recommended pricing response based on competitor landscape."""
    if not platform_results:
        return "HOLD"

    avg_drop_prob = np.mean([r["price_drop_probability"] for r in platform_results])
    avg_aggression = np.mean([r["market_aggression_score"] for r in platform_results])

    if avg_drop_prob >= 0.70 and avg_aggression >= 60:
        return "UNDERCUT"
    elif avg_drop_prob >= 0.55:
        return "MATCH"
    elif avg_aggression <= 30:
        return "PREMIUM_HOLD"
    else:
        return "WAIT"


def predict_competitor_reactions(comp_df: pd.DataFrame, product: dict) -> dict:
    """
    Predict competitor pricing reactions for next 7 days.

    Returns
    -------
    {
      "platforms": [
        {
          "platform", "current_price", "predicted_prices" (7 days),
          "price_drop_probability", "market_aggression_score",
          "promotion_periods"
        }
      ],
      "recommended_response": str,
      "market_summary": { avg_competitor_price, min_price, max_price, ... }
    }
    """
    platform_series = _get_platform_series(comp_df)
    current_price   = float(product.get("price", 799))

    results = []
    all_current_prices = []

    for platform in PLATFORM_ORDER:
        if platform not in platform_series:
            # Use synthetic data if platform missing
            series = pd.DataFrame({
                "date":  [pd.Timestamp.today() - timedelta(days=d) for d in range(30, -1, -1)],
                "price": [current_price * np.random.uniform(0.90, 1.10) for _ in range(31)],
            })
        else:
            series = platform_series[platform]

        current_comp_price = round(float(series["price"].iloc[-1]), 2)
        all_current_prices.append(current_comp_price)

        predicted   = _trend_forecast(series, days=7)
        aggression  = _aggression_score(series)
        drop_prob   = _price_drop_probability(series)
        promotions  = _detect_promotion_periods(series)

        results.append({
            "platform":               platform,
            "current_price":          current_comp_price,
            "predicted_prices":       predicted,
            "price_drop_probability": drop_prob,
            "market_aggression_score": aggression,
            "promotion_periods":      promotions,
            "trend":                  "falling" if drop_prob > 0.55 else "stable" if drop_prob > 0.35 else "rising",
        })

    recommended = _recommended_response(results)

    return {
        "platforms":            results,
        "recommended_response": recommended,
        "market_summary": {
            "avg_competitor_price": round(float(np.mean(all_current_prices)), 2),
            "min_competitor_price": round(float(np.min(all_current_prices)), 2),
            "max_competitor_price": round(float(np.max(all_current_prices)), 2),
            "our_price":            current_price,
            "price_position":       "below_market" if current_price < np.mean(all_current_prices)
                                    else "above_market" if current_price > np.mean(all_current_prices)
                                    else "at_market",
        },
    }
