"""Backend configuration — settings, constants, and environment."""
import os
from datetime import datetime, timedelta

# ── Auth ─────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "dynamic-pricing-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./pricing_saas.db"  # swap to postgresql://... for production
)

# ── Product ──────────────────────────────────────────────────────────────────
PRODUCT_NAME = "Classic White T-Shirt"
PRODUCT_DESC = "Premium cotton crew-neck white t-shirt — D2C brand"
BASE_PRICE = 799
COST_PRICE = 350
PRICE_FLOOR = 549
PRICE_CEILING = 1099
INITIAL_STOCK = 500

# ── Simulation ───────────────────────────────────────────────────────────────
SIMULATION_DAYS = 180
SIM_START_DATE = datetime(2025, 10, 1).date()
RANDOM_SEED = 42

# ── Pricing thresholds ───────────────────────────────────────────────────────
DEMAND_UP_THRESH = 0.05
DEMAND_DOWN_THRESH = -0.05
HIGH_STOCK = 350
LOW_STOCK = 100
RULE_WEIGHT = 0.50
ML_WEIGHT = 0.50
FORECAST_DAYS = 14

# ── Marketplace brands ───────────────────────────────────────────────────────
MARKETPLACES = {
    "Amazon":   {"brands": ["Amazon Basics", "Dennis Lingo"], "base_range": (399, 699)},
    "Flipkart": {"brands": ["Roadster", "HRX"],              "base_range": (449, 749)},
    "Myntra":   {"brands": ["H&M", "Zara"],                  "base_range": (699, 1199)},
    "Ajio":     {"brands": ["Uniqlo", "GAP"],                 "base_range": (599, 899)},
}
