"""
Global configuration for the Dynamic Pricing System.
"""
import datetime

# ── Product Details ──────────────────────────────────────────────────────────
PRODUCT_NAME = "Classic White T-Shirt"
PRODUCT_DESCRIPTION = "Premium cotton crew-neck white t-shirt — D2C brand"
BASE_PRICE = 799          # ₹ — starting / default price
COST_PRICE = 350          # ₹ — cost of goods
PRICE_FLOOR = 549         # ₹ — never sell below this
PRICE_CEILING = 1099      # ₹ — never sell above this
INITIAL_STOCK = 500       # units at the start of simulation
RESTOCK_THRESHOLD = 80    # restock when stock falls below this

# ── Simulation ───────────────────────────────────────────────────────────────
SIMULATION_DAYS = 180     # ~6 months of data
SIM_START_DATE = datetime.date(2025, 10, 1)
SIM_END_DATE = SIM_START_DATE + datetime.timedelta(days=SIMULATION_DAYS - 1)
RANDOM_SEED = 42

# ── Competitor Brands ────────────────────────────────────────────────────────
COMPETITORS = {
    "H&M": {
        "base_price_low": 699,
        "base_price_high": 899,
        "rating_low": 3.5,
        "rating_high": 4.3,
        "discount_low": 0,
        "discount_high": 20,
    },
    "Zara": {
        "base_price_low": 899,
        "base_price_high": 1199,
        "rating_low": 3.8,
        "rating_high": 4.5,
        "discount_low": 0,
        "discount_high": 15,
    },
    "Uniqlo": {
        "base_price_low": 599,
        "base_price_high": 799,
        "rating_low": 4.0,
        "rating_high": 4.6,
        "discount_low": 0,
        "discount_high": 25,
    },
    "Amazon Basics": {
        "base_price_low": 399,
        "base_price_high": 599,
        "rating_low": 3.2,
        "rating_high": 4.0,
        "discount_low": 5,
        "discount_high": 30,
    },
}

# ── Pricing Engine Thresholds ────────────────────────────────────────────────
DEMAND_INCREASE_THRESHOLD = 0.05      # 5 % rise in 7-day trend → "increasing"
DEMAND_DECREASE_THRESHOLD = -0.05     # 5 % drop → "decreasing"
HIGH_STOCK_THRESHOLD = 350            # units — considered "high"
LOW_STOCK_THRESHOLD = 100             # units — considered "low"
COMPETITOR_HIGH_FACTOR = 1.05         # competitor avg > our price * factor → "high"
RULE_WEIGHT = 0.60                    # blend weight for rule-based price
ML_WEIGHT = 0.40                      # blend weight for ML-based price

# ── Forecast ─────────────────────────────────────────────────────────────────
FORECAST_DAYS = 14                    # predict next 14 days

# ── Database ─────────────────────────────────────────────────────────────────
DB_PATH = "pricing.db"
