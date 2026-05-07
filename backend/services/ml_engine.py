"""ML Engine — XGBoost demand prediction, elasticity estimation, price optimisation.

Public API
----------
build_features(sales_df, product)        → feature dict (all keys the spec requires)
train_demand_model(sales_df)             → XGBRegressor
optimal_price_search(model, features, sales_df) → {recommended_price, confidence, max_daily_revenue}
estimate_elasticity(sales_df)            → negative float in [-3.0, -0.1]

Legacy helpers kept for backward-compat with dashboard / analytics routes:
predict_demand(model, price, ...) → float
compute_elasticity_curve(processed_df)  → list[dict]
"""
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.linear_model import LinearRegression


# ── Internal helpers ──────────────────────────────────────────────────────────

def _make_model_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build the feature matrix used for XGBoost training/inference.

    Columns produced:
      price, dow_0..dow_6 (one-hot), lag_1, lag_7, demand_ma_7
    """
    out = df[["price", "units_sold"]].copy()

    # Day-of-week one-hot (works on both datetime and int columns)
    if pd.api.types.is_datetime64_any_dtype(df["date"]):
        dow = df["date"].dt.dayofweek
    else:
        dow = pd.to_datetime(df["date"]).dt.dayofweek

    for d in range(7):
        out[f"dow_{d}"] = (dow == d).astype(int)

    # Lags & rolling avg
    out["lag_1"]       = out["units_sold"].shift(1)
    out["lag_7"]       = out["units_sold"].shift(7)
    out["demand_ma_7"] = out["units_sold"].rolling(7, min_periods=1).mean()

    return out.dropna()


_FEATURE_COLS = ["price"] + [f"dow_{d}" for d in range(7)] + ["lag_1", "lag_7", "demand_ma_7"]


# ── Core public functions ─────────────────────────────────────────────────────

def build_features(sales_df: pd.DataFrame, product: dict) -> dict:
    """
    Derive a rich feature dict from raw sales history + product catalog dict.

    Keys returned (exactly as spec requires):
      current_price, cost_price, stock, rating, reviews,
      demand_ma_7, demand_ma_30,
      price_ma_7, price_ma_30,
      margin_pct, price_std,
      days_since_peak,
      competitor_avg_price   ← seeded as current_price; caller may override
    """
    df = sales_df.copy()
    df = df.sort_values("date").reset_index(drop=True)

    # Use the most-recent observed price from sales history as the live
    # current price.  Fall back to the catalog price only when sales is empty.
    cost_price = float(product["cost_price"])
    if not df.empty and "price" in df.columns:
        current_price = float(df["price"].iloc[-1])
    else:
        current_price = float(product["price"])

    # Rolling demand averages
    demand_series = df["units_sold"].astype(float)
    demand_ma_7   = float(demand_series.rolling(7,  min_periods=1).mean().iloc[-1])
    demand_ma_30  = float(demand_series.rolling(30, min_periods=1).mean().iloc[-1])

    # Rolling price averages
    price_series = df["price"].astype(float)
    price_ma_7   = float(price_series.rolling(7,  min_periods=1).mean().iloc[-1])
    price_ma_30  = float(price_series.rolling(30, min_periods=1).mean().iloc[-1])
    price_std    = float(price_series.std())

    # Margin
    margin_pct = (current_price - cost_price) / current_price if current_price > 0 else 0.0

    # Days since peak demand
    peak_idx        = int(demand_series.idxmax())
    n_rows          = len(df)
    days_since_peak = n_rows - 1 - peak_idx   # rows from end (≈ days, since daily data)

    return {
        "current_price":       current_price,
        "cost_price":          cost_price,
        "stock":               int(product["stock"]),
        "rating":              float(product["rating"]),
        "reviews":             int(product.get("reviews", 0)),
        "demand_ma_7":         round(demand_ma_7, 2),
        "demand_ma_30":        round(demand_ma_30, 2),
        "price_ma_7":          round(price_ma_7, 2),
        "price_ma_30":         round(price_ma_30, 2),
        "margin_pct":          round(margin_pct, 4),
        "price_std":           round(price_std, 2),
        "days_since_peak":     days_since_peak,
        # Seeded to current price — updated later by strategy route after scraping
        "competitor_avg_price": current_price,
    }


def train_demand_model(sales_df: pd.DataFrame) -> XGBRegressor:
    """
    Train XGBoost regressor to predict daily units_sold.

    Input features: price, one-hot DOW (7 cols), lag_1, lag_7, demand_ma_7.
    Target: units_sold.
    """
    df = sales_df.sort_values("date").reset_index(drop=True)
    feat_df = _make_model_features(df)

    X = feat_df[_FEATURE_COLS].values
    y = feat_df["units_sold"].values

    model = XGBRegressor(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42,
        verbosity=0,
    )
    model.fit(X, y)
    return model


def optimal_price_search(
    model: XGBRegressor,
    features: dict,
    sales_df: pd.DataFrame,
) -> dict:
    """
    Grid-search from (cost_price × 1.2) to (current_price × 1.5) in ₹10 steps.

    For each candidate price, predict daily demand using the model, compute
    daily revenue and daily margin, then pick the revenue-maximising price.

    Confidence (50–95) is based on data quantity and demand stability:
      - More rows → higher base confidence
      - Lower demand CV (coefficient of variation) → higher confidence
    """
    cost_price    = features["cost_price"]
    current_price = features["current_price"]

    floor   = cost_price * 1.2
    ceiling = current_price * 1.5

    # Build a representative inference row using the *last* row of training data
    df = sales_df.sort_values("date").reset_index(drop=True)
    feat_df = _make_model_features(df)

    # Use most-recent row's DOW & lags as fixed context; only price varies
    last_row = feat_df.iloc[-1]
    base_vec = last_row[_FEATURE_COLS].values.copy()   # shape (11,)

    best_price   = current_price
    best_revenue = 0.0
    best_margin  = 0.0

    step = 10.0
    candidate = floor
    while candidate <= ceiling:
        row = base_vec.copy()
        row[0] = candidate   # feature index 0 = price
        demand  = max(0.0, float(model.predict([row])[0]))
        revenue = candidate * demand
        if revenue > best_revenue:
            best_revenue = revenue
            best_price   = candidate
            best_margin  = (candidate - cost_price) * demand
        candidate += step

    # ── Confidence ────────────────────────────────────────────────────────────
    n_rows   = len(feat_df)
    demand_s = feat_df["units_sold"]
    cv       = float(demand_s.std() / demand_s.mean()) if demand_s.mean() > 0 else 1.0

    # More data → +confidence; lower CV → +confidence
    data_score    = min(40, n_rows * 0.5)          # 0–40 (caps at 80 rows)
    stability_score = max(0, 15 - cv * 15)         # 0–15 (0 CV = 15 pts)
    confidence    = round(min(95, max(50, 50 + data_score + stability_score)), 1)

    return {
        "recommended_price":  round(best_price),
        "max_daily_revenue":  round(best_revenue, 2),
        "max_daily_margin":   round(best_margin, 2),
        "confidence":         confidence,
        # Legacy key — kept so existing dashboard route still works
        "optimal_price":      round(best_price),
    }


def estimate_elasticity(sales_df: pd.DataFrame) -> float:
    """
    Estimate price elasticity of demand from day-over-day percentage changes.

    Method: for each consecutive pair of rows compute
        Δ%demand = (demand_t - demand_t-1) / demand_t-1
        Δ%price  = (price_t  - price_t-1 ) / price_t-1
    Elasticity = mean(Δ%demand) / mean(|Δ%price|)

    Falls back to log-log regression as a secondary estimate and averages both.
    Returns a float clamped to [-3.0, -0.1].
    If data is too noisy or too small, returns -1.0.
    """
    df = sales_df.sort_values("date").reset_index(drop=True)
    df = df[df["units_sold"] > 0].copy()

    if len(df) < 14:
        return -1.0

    # ── Method 1: day-over-day ratio ──────────────────────────────────────────
    demand_chg = df["units_sold"].pct_change().dropna()
    price_chg  = df["price"].pct_change().dropna()

    # Only use rows where price actually changed (avoid division-by-zero noise)
    mask = price_chg.abs() > 0.005
    if mask.sum() < 5:
        # Not enough price variation — fall through to log-log
        e1 = None
    else:
        avg_demand_chg = float(demand_chg[mask].mean())
        avg_price_chg  = float(price_chg[mask].mean())
        if abs(avg_price_chg) < 1e-6:
            e1 = None
        else:
            e1 = avg_demand_chg / avg_price_chg
            e1 = max(-3.0, min(-0.1, e1))   # clamp before averaging

    # ── Method 2: log-log OLS regression ─────────────────────────────────────
    log_p = np.log(df["price"].values).reshape(-1, 1)
    log_d = np.log(df["units_sold"].values)
    lr    = LinearRegression().fit(log_p, log_d)
    e2    = float(lr.coef_[0])
    e2    = max(-3.0, min(-0.1, e2))

    # ── Combine ───────────────────────────────────────────────────────────────
    if e1 is None:
        elasticity = e2
    else:
        elasticity = (e1 + e2) / 2.0

    return round(max(-3.0, min(-0.1, elasticity)), 4)


# ── Legacy / compat helpers ───────────────────────────────────────────────────

def predict_demand(
    model: XGBRegressor,
    price: float,
    comp_avg: float,
    stock: int,
    rating: float,
    dow: int,
    is_wknd: int,
    demand_ma: float,
) -> float:
    """
    Predict demand using the OLD 7-feature interface.

    Kept for backward compat with dashboard routes that call this directly.
    Builds a pseudo feature row matching _FEATURE_COLS by injecting price
    and using uniform DOW/lag values derived from demand_ma.
    """
    # Build a row: price, dow one-hot (7 cols), lag_1, lag_7, demand_ma_7
    row = np.zeros(11)
    row[0] = price
    if 0 <= dow < 7:
        row[1 + dow] = 1          # one-hot DOW
    row[8]  = demand_ma           # lag_1 approximation
    row[9]  = demand_ma           # lag_7 approximation
    row[10] = demand_ma           # demand_ma_7
    pred = model.predict([row])[0]
    return max(0.0, float(pred))


def compute_elasticity_curve(processed_df: pd.DataFrame) -> list:
    """
    Generate elasticity curve data points for the Analytics chart.
    Works on a processed_df (output of data_processing.process_data).
    """
    df = processed_df.dropna().copy()
    if len(df) < 30:
        return []

    try:
        elasticity = estimate_elasticity(df)
    except:
        elasticity = -1.5  # Default elasticity if estimation fails
    
    # Handle NaN or invalid elasticity
    if elasticity != elasticity or elasticity == 0 or abs(elasticity) > 5:
        elasticity = -1.5
    
    current_price = float(df["price"].iloc[-1])
    current_demand = float(df["demand_ma_7"].iloc[-1]) if "demand_ma_7" in df.columns else 20.0

    curve = []
    for pct in range(-30, 31, 2):
        test_price = current_price * (1 + pct / 100)
        if test_price <= 0:
            continue
        price_ratio    = test_price / current_price
        exp_demand     = current_demand * (price_ratio ** elasticity)
        exp_revenue    = test_price * exp_demand
        
        # Handle NaN in calculations
        if exp_demand != exp_demand or exp_demand < 0:
            exp_demand = 0
        if exp_revenue != exp_revenue:
            exp_revenue = 0
            
        curve.append({
            "price":   round(test_price),
            "demand":  round(exp_demand, 1),
            "revenue": round(exp_revenue),
        })
    return curve
