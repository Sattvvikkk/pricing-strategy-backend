"""
Module D — Demand Forecasting
Uses Prophet (with scikit-learn fallback) to predict future demand.
"""
import warnings
import numpy as np
import pandas as pd
from config import FORECAST_DAYS

warnings.filterwarnings("ignore")


def forecast_demand(processed_df: pd.DataFrame,
                    periods: int = FORECAST_DAYS) -> pd.DataFrame:
    df = processed_df[["date", "units_sold", "price", "competitor_avg_price"]].copy()
    df = df.rename(columns={"date": "ds", "units_sold": "y"})
    df["ds"] = pd.to_datetime(df["ds"])
    try:
        return _prophet_forecast(df, periods)
    except Exception:
        return _fallback_forecast(df, periods)


def _prophet_forecast(df, periods):
    from prophet import Prophet
    model = Prophet(yearly_seasonality=False, weekly_seasonality=True,
                    daily_seasonality=False, changepoint_prior_scale=0.05)
    model.add_regressor("price")
    model.add_regressor("competitor_avg_price")
    model.fit(df)
    future = model.make_future_dataframe(periods=periods)
    future["price"] = df["price"].iloc[-1]
    future["competitor_avg_price"] = df["competitor_avg_price"].iloc[-1]
    future.loc[:len(df)-1, "price"] = df["price"].values
    future.loc[:len(df)-1, "competitor_avg_price"] = df["competitor_avg_price"].values
    forecast = model.predict(future)
    result = forecast.tail(periods)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
    result["yhat"] = result["yhat"].clip(lower=0).round(1)
    result["yhat_lower"] = result["yhat_lower"].clip(lower=0).round(1)
    result["yhat_upper"] = result["yhat_upper"].clip(lower=0).round(1)
    return result.reset_index(drop=True)


def _fallback_forecast(df, periods):
    from sklearn.linear_model import LinearRegression
    y = df["y"].values
    x = np.arange(len(y)).reshape(-1, 1)
    lr = LinearRegression().fit(x, y)
    slope, intercept = lr.coef_[0], lr.intercept_
    df2 = df.copy()
    df2["dow"] = df2["ds"].dt.dayofweek
    df2["trend"] = lr.predict(x)
    df2["residual"] = df2["y"] - df2["trend"]
    weekly = df2.groupby("dow")["residual"].mean().to_dict()
    recent_mean = df2["y"].tail(14).mean()
    trend_mean = df2["trend"].tail(14).mean()
    level_adj = recent_mean - trend_mean
    last_date = df2["ds"].max()
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1),
                                 periods=periods, freq="D")
    rows = []
    for i, date in enumerate(future_dates):
        t = len(y) + i
        yhat = max(0, slope * t + intercept + level_adj + weekly.get(date.dayofweek, 0))
        rows.append({"ds": date, "yhat": round(yhat, 1),
                      "yhat_lower": round(max(0, yhat * 0.85), 1),
                      "yhat_upper": round(yhat * 1.15, 1)})
    return pd.DataFrame(rows)
