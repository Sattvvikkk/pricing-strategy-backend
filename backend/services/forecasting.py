"""Demand forecasting — Prophet with sklearn fallback."""
import warnings, numpy as np, pandas as pd
from config import FORECAST_DAYS
warnings.filterwarnings("ignore")


def forecast_demand(processed_df: pd.DataFrame, periods: int = FORECAST_DAYS) -> pd.DataFrame:
    df = processed_df[["date", "units_sold", "price", "competitor_avg_price"]].copy()
    df = df.rename(columns={"date": "ds", "units_sold": "y"})
    df["ds"] = pd.to_datetime(df["ds"])
    try:
        return _prophet_forecast(df, periods)
    except Exception:
        return _fallback_forecast(df, periods)


def _prophet_forecast(df, periods):
    from prophet import Prophet
    m = Prophet(yearly_seasonality=False, weekly_seasonality=True,
                daily_seasonality=False, changepoint_prior_scale=0.05)
    m.add_regressor("price"); m.add_regressor("competitor_avg_price")
    m.fit(df)
    future = m.make_future_dataframe(periods=periods)
    future["price"] = df["price"].iloc[-1]
    future["competitor_avg_price"] = df["competitor_avg_price"].iloc[-1]
    future.loc[:len(df)-1, "price"] = df["price"].values
    future.loc[:len(df)-1, "competitor_avg_price"] = df["competitor_avg_price"].values
    fc = m.predict(future).tail(periods)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
    for c in ["yhat", "yhat_lower", "yhat_upper"]:
        fc[c] = fc[c].clip(lower=0).round(1)
    return fc.reset_index(drop=True)


def _fallback_forecast(df, periods):
    from sklearn.linear_model import LinearRegression
    y = df["y"].values; x = np.arange(len(y)).reshape(-1, 1)
    lr = LinearRegression().fit(x, y)
    slope, intercept = lr.coef_[0], lr.intercept_
    df2 = df.copy(); df2["dow"] = df2["ds"].dt.dayofweek
    df2["trend"] = lr.predict(x); df2["residual"] = df2["y"] - df2["trend"]
    weekly = df2.groupby("dow")["residual"].mean().to_dict()
    level_adj = df2["y"].tail(14).mean() - df2["trend"].tail(14).mean()
    last = df2["ds"].max()
    dates = pd.date_range(start=last + pd.Timedelta(days=1), periods=periods, freq="D")
    rows = []
    for i, d in enumerate(dates):
        yhat = max(0, slope * (len(y)+i) + intercept + level_adj + weekly.get(d.dayofweek, 0))
        rows.append({"ds": d, "yhat": round(yhat,1),
                      "yhat_lower": round(max(0, yhat*0.85),1), "yhat_upper": round(yhat*1.15,1)})
    return pd.DataFrame(rows)
