"""ML Engine — XGBoost demand prediction + elasticity-based price optimization."""
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.linear_model import LinearRegression
from config import PRICE_FLOOR, PRICE_CEILING


def train_demand_model(processed_df: pd.DataFrame) -> XGBRegressor:
    """Train XGBoost to predict units_sold from features."""
    df = processed_df.dropna().copy()
    features = ["price", "competitor_avg_price", "stock", "rating",
                "day_of_week", "is_weekend", "demand_ma_7"]
    X = df[features].values
    y = df["units_sold"].values

    model = XGBRegressor(
        n_estimators=100, max_depth=5, learning_rate=0.1,
        objective="reg:squarederror", random_state=42, verbosity=0
    )
    model.fit(X, y)
    return model


def predict_demand(model: XGBRegressor, price: float, comp_avg: float,
                   stock: int, rating: float, dow: int, is_wknd: int,
                   demand_ma: float) -> float:
    """Predict demand for given features."""
    X = np.array([[price, comp_avg, stock, rating, dow, is_wknd, demand_ma]])
    pred = model.predict(X)[0]
    return max(0, float(pred))


def estimate_elasticity(processed_df: pd.DataFrame) -> float:
    """Estimate price elasticity of demand using log-log regression."""
    df = processed_df.dropna().copy()
    df = df[df["units_sold"] > 0]
    if len(df) < 30:
        return -0.5  # default

    log_price = np.log(df["price"].values).reshape(-1, 1)
    log_demand = np.log(df["units_sold"].values)
    lr = LinearRegression().fit(log_price, log_demand)
    elasticity = float(lr.coef_[0])
    return max(-3.0, min(-0.1, elasticity))  # clamp


def compute_elasticity_curve(processed_df: pd.DataFrame) -> list[dict]:
    """Generate elasticity curve data for charting."""
    df = processed_df.dropna().copy()
    if len(df) < 30:
        return []

    elasticity = estimate_elasticity(df)
    current_price = float(df["price"].iloc[-1])
    current_demand = float(df["demand_ma_7"].iloc[-1])

    curve = []
    for pct in range(-30, 31, 2):
        test_price = current_price * (1 + pct / 100)
        if test_price < PRICE_FLOOR or test_price > PRICE_CEILING:
            continue
        price_ratio = test_price / current_price
        expected_demand = current_demand * (price_ratio ** elasticity)
        expected_revenue = test_price * expected_demand
        curve.append({
            "price": round(test_price),
            "demand": round(expected_demand, 1),
            "revenue": round(expected_revenue),
        })
    return curve


def optimal_price_search(model: XGBRegressor, features: dict,
                         processed_df: pd.DataFrame) -> dict:
    """Grid search for revenue-maximizing price using XGBoost predictions."""
    best_price = features["current_price"]
    best_revenue = 0
    results = []

    for pct in range(-20, 21, 1):
        test_price = features["current_price"] * (1 + pct / 100)
        test_price = max(PRICE_FLOOR, min(PRICE_CEILING, test_price))

        demand = predict_demand(
            model, test_price, features["competitor_avg_price"],
            features["stock"], features["rating"], 3, 0, features["demand_ma_7"]
        )
        revenue = test_price * demand
        results.append((test_price, demand, revenue))

        if revenue > best_revenue:
            best_revenue = revenue
            best_price = test_price

    current_rev = features["current_price"] * features["demand_ma_7"]
    impact = ((best_revenue - current_rev) / current_rev * 100) if current_rev > 0 else 0

    # Confidence: based on how much better the optimal is vs current
    confidence = min(95, max(40, 60 + impact * 2))

    return {
        "optimal_price": round(best_price),
        "expected_demand": round(predict_demand(
            model, best_price, features["competitor_avg_price"],
            features["stock"], features["rating"], 3, 0, features["demand_ma_7"]
        ), 1),
        "expected_revenue": round(best_revenue),
        "revenue_impact_pct": round(impact, 1),
        "confidence": round(confidence, 1),
    }
