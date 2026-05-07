"""
Demand Forecasting Ensemble
===========================
Combines XGBoost rolling forecast + Prophet + optional LSTM (Keras/TF).
Falls back gracefully when TF is unavailable (Render free-tier safe).

Public API
----------
run_ensemble_forecast(sales_df, periods=14) → dict
"""
import warnings
import numpy as np
import pandas as pd
from datetime import timedelta

warnings.filterwarnings("ignore")

# ── Optional TF / Keras ───────────────────────────────────────────────────────
_TF_AVAILABLE = False
try:
    import tensorflow as tf
    from tensorflow import keras
    _TF_AVAILABLE = True
except Exception:
    pass


# ── XGBoost rolling forecast ──────────────────────────────────────────────────

def _xgb_forecast(sales_df: pd.DataFrame, periods: int) -> pd.DataFrame:
    """Use XGBoost to predict next `periods` days using rolling features."""
    from xgboost import XGBRegressor

    df = sales_df.sort_values("date").reset_index(drop=True).copy()
    df["date"] = pd.to_datetime(df["date"])
    df["dow"]       = df["date"].dt.dayofweek
    mean_demand = df["units_sold"].mean()
    df["lag_1"]     = df["units_sold"].shift(1).bfill().fillna(mean_demand)
    df["lag_7"]     = df["units_sold"].shift(7).bfill().fillna(mean_demand)
    df["lag_14"]    = df["units_sold"].shift(14).bfill().fillna(mean_demand)
    df["ma_7"]      = df["units_sold"].rolling(7, min_periods=1).mean()
    df["ma_14"]     = df["units_sold"].rolling(14, min_periods=1).mean()
    df["price_ma7"] = df["price"].rolling(7, min_periods=1).mean()
    df = df.dropna()

    if df.empty:
        # Fallback — return flat forecast at current demand
        last_date = pd.to_datetime(sales_df["date"].iloc[-1])
        avg = float(sales_df["units_sold"].mean())
        return pd.DataFrame([{
            "date": last_date + timedelta(days=i + 1),
            "xgb": round(avg, 1)
        } for i in range(periods)])

    FEAT = ["price", "dow", "lag_1", "lag_7", "lag_14", "ma_7", "ma_14", "price_ma7"]
    X = df[FEAT].values
    y = df["units_sold"].values

    model = XGBRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.07,
        subsample=0.8, colsample_bytree=0.8,
        objective="reg:squarederror", random_state=42, verbosity=0,
    )
    model.fit(X, y)

    # Rolling predict
    last_row = df.iloc[-1].copy()
    last_price = float(df["price"].iloc[-1])
    last_date  = df["date"].iloc[-1]
    history_units = list(df["units_sold"].values)

    rows = []
    for i in range(1, periods + 1):
        fut_date = last_date + timedelta(days=i)
        dow = fut_date.dayofweek
        n = len(history_units)
        lag1  = history_units[-1]  if n >= 1  else last_row["ma_7"]
        lag7  = history_units[-7]  if n >= 7  else last_row["ma_7"]
        lag14 = history_units[-14] if n >= 14 else last_row["ma_7"]
        ma7   = float(np.mean(history_units[-7:]))  if n >= 7  else lag1
        ma14  = float(np.mean(history_units[-14:])) if n >= 14 else lag1
        feat  = [last_price, dow, lag1, lag7, lag14, ma7, ma14, last_price]
        yhat  = max(0.0, float(model.predict([feat])[0]))
        rows.append({"date": fut_date, "xgb": round(yhat, 1)})
        history_units.append(yhat)

    return pd.DataFrame(rows)


# ── Prophet forecast ──────────────────────────────────────────────────────────

def _prophet_forecast(sales_df: pd.DataFrame, periods: int) -> pd.DataFrame:
    """Thin wrapper around existing prophet logic, returns {date, prophet}."""
    try:
        from prophet import Prophet
        df = sales_df.copy()
        df["ds"] = pd.to_datetime(df["date"])
        df["y"]  = df["units_sold"]
        df["price"] = df["price"].astype(float)
        m = Prophet(yearly_seasonality=False, weekly_seasonality=True,
                    daily_seasonality=False, changepoint_prior_scale=0.05,
                    interval_width=0.80)
        m.add_regressor("price")
        m.fit(df[["ds", "y", "price"]])
        future = m.make_future_dataframe(periods=periods)
        future["price"] = float(df["price"].iloc[-1])
        fc = m.predict(future).tail(periods)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
        fc = fc.rename(columns={"ds": "date", "yhat": "prophet",
                                "yhat_lower": "p_lower", "yhat_upper": "p_upper"})
        for col in ["prophet", "p_lower", "p_upper"]:
            fc[col] = fc[col].clip(lower=0).round(1)
        fc["date"] = fc["date"].dt.normalize()
        return fc.reset_index(drop=True)
    except Exception:
        # Fallback — simple trend
        df = sales_df.sort_values("date").copy()
        last_date = pd.to_datetime(df["date"].iloc[-1])
        avg = float(df["units_sold"].tail(14).mean())
        rows = []
        for i in range(1, periods + 1):
            rows.append({
                "date": last_date + timedelta(days=i),
                "prophet": round(avg, 1),
                "p_lower": round(avg * 0.85, 1),
                "p_upper": round(avg * 1.15, 1),
            })
        return pd.DataFrame(rows)


# ── Optional LSTM ─────────────────────────────────────────────────────────────

def _lstm_forecast(sales_df: pd.DataFrame, periods: int) -> pd.DataFrame | None:
    """Lightweight LSTM. Returns None when TF not available."""
    if not _TF_AVAILABLE:
        return None
    try:
        seq_len = 14
        series = sales_df.sort_values("date")["units_sold"].values.astype(float)
        # Normalize
        mu, sigma = series.mean(), series.std() + 1e-6
        norm = (series - mu) / sigma

        X, y = [], []
        for i in range(len(norm) - seq_len):
            X.append(norm[i:i + seq_len])
            y.append(norm[i + seq_len])
        X = np.array(X)[..., np.newaxis]
        y = np.array(y)

        model = keras.Sequential([
            keras.layers.LSTM(32, input_shape=(seq_len, 1)),
            keras.layers.Dense(1),
        ])
        model.compile(optimizer="adam", loss="mse")
        model.fit(X, y, epochs=20, batch_size=16, verbose=0)

        # Roll forward
        last_seq = norm[-seq_len:].tolist()
        preds = []
        last_date = pd.to_datetime(sales_df["date"].iloc[-1])
        for i in range(periods):
            inp = np.array(last_seq[-seq_len:])[np.newaxis, :, np.newaxis]
            p = float(model.predict(inp, verbose=0)[0][0])
            preds.append(max(0.0, round(p * sigma + mu, 1)))
            last_seq.append(p)

        dates = [last_date + timedelta(days=i + 1) for i in range(periods)]
        return pd.DataFrame({"date": dates, "lstm": preds})
    except Exception:
        return None


# ── Seasonal analysis ─────────────────────────────────────────────────────────

def _seasonal_analysis(sales_df: pd.DataFrame) -> dict:
    """Identify seasonal spikes and low-demand periods from history."""
    df = sales_df.sort_values("date").copy()
    df["date"] = pd.to_datetime(df["date"])
    df["dow"]  = df["date"].dt.dayofweek

    # Spike = days > mean + 1.5σ
    mu, sigma = df["units_sold"].mean(), df["units_sold"].std()
    spike_thresh = mu + 1.5 * sigma
    low_thresh   = mu - 1.0 * sigma

    spikes = df[df["units_sold"] >= spike_thresh].nlargest(3, "units_sold")
    lows   = df[df["units_sold"] <= max(1, low_thresh)].nsmallest(3, "units_sold")

    # Day-of-week averages
    dow_avg = df.groupby("dow")["units_sold"].mean()
    best_dow  = int(dow_avg.idxmax())
    worst_dow = int(dow_avg.idxmin())
    DOW_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    return {
        "seasonal_spikes": [
            {
                "date": str(row["date"].date()),
                "units": int(row["units_sold"]),
                "pct_above_avg": round((row["units_sold"] - mu) / mu * 100, 1),
            }
            for _, row in spikes.iterrows()
        ],
        "low_demand_periods": [
            {
                "date": str(row["date"].date()),
                "units": int(row["units_sold"]),
                "pct_below_avg": round((mu - row["units_sold"]) / mu * 100, 1),
            }
            for _, row in lows.iterrows()
        ],
        "best_day_of_week":  DOW_NAMES[best_dow],
        "worst_day_of_week": DOW_NAMES[worst_dow],
        "avg_daily_demand":  round(float(mu), 1),
        "demand_std":        round(float(sigma), 1),
    }


# ── Master function ───────────────────────────────────────────────────────────

def run_ensemble_forecast(sales_df: pd.DataFrame, periods: int = 14) -> dict:
    """
    Run XGBoost + Prophet (+ optional LSTM) ensemble and return unified forecast.

    Returns
    -------
    {
      "forecast": [{"date", "xgb", "prophet", "lstm" (or null), "ensemble", "lower", "upper"}, ...],
      "seasonal": { seasonal_spikes, low_demand_periods, best_day_of_week, ... },
      "models_used": ["XGBoost", "Prophet"],        # LSTM added if TF available
      "lstm_available": bool,
    }
    """
    xgb_df     = _xgb_forecast(sales_df, periods)
    prophet_df = _prophet_forecast(sales_df, periods)
    lstm_df    = _lstm_forecast(sales_df, periods)

    # Align on date
    merged = xgb_df.set_index("date").join(
        prophet_df.set_index("date")[["prophet", "p_lower", "p_upper"]],
        how="outer",
    )
    if lstm_df is not None:
        merged = merged.join(lstm_df.set_index("date"), how="outer")
    merged = merged.reset_index().sort_values("date")

    rows = []
    for _, r in merged.iterrows():
        xgb_val     = float(r.get("xgb", 0) or 0)
        prophet_val = float(r.get("prophet", 0) or 0)
        lstm_val    = float(r["lstm"]) if lstm_df is not None and not pd.isna(r.get("lstm")) else None

        if lstm_val is not None:
            ensemble = round((xgb_val * 0.40 + prophet_val * 0.35 + lstm_val * 0.25), 1)
        else:
            ensemble = round((xgb_val * 0.55 + prophet_val * 0.45), 1)

        p_lower = float(r.get("p_lower", prophet_val * 0.85) or prophet_val * 0.85)
        p_upper = float(r.get("p_upper", prophet_val * 1.15) or prophet_val * 1.15)
        lower   = round(min(p_lower, ensemble * 0.85), 1)
        upper   = round(max(p_upper, ensemble * 1.15), 1)

        rows.append({
            "date":     str(r["date"].date()) if hasattr(r["date"], "date") else str(r["date"]),
            "xgb":      round(xgb_val, 1),
            "prophet":  round(prophet_val, 1),
            "lstm":     round(lstm_val, 1) if lstm_val is not None else None,
            "ensemble": ensemble,
            "lower":    max(0.0, lower),
            "upper":    upper,
        })

    models_used = ["XGBoost", "Prophet"]
    if lstm_df is not None:
        models_used.append("LSTM")

    seasonal = _seasonal_analysis(sales_df)

    return {
        "forecast":       rows,
        "seasonal":       seasonal,
        "models_used":    models_used,
        "lstm_available": _TF_AVAILABLE,
        "periods":        periods,
    }
