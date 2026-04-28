"""Dataset generator — produces 6 months of simulated sales + competitor data."""
import numpy as np
import pandas as pd
from config import BASE_PRICE, PRICE_FLOOR, PRICE_CEILING, INITIAL_STOCK, SIMULATION_DAYS, SIM_START_DATE, RANDOM_SEED, MARKETPLACES


def generate_sales_data(seed: int = RANDOM_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start=SIM_START_DATE, periods=SIMULATION_DAYS, freq="D")
    rows = []
    price, stock, rating = float(BASE_PRICE), INITIAL_STOCK, 4.1

    for i, date in enumerate(dates):
        price *= (1 + rng.normal(0, 0.015))
        if 60 <= i <= 90: price *= 1.003
        price = round(np.clip(price, PRICE_FLOOR, PRICE_CEILING))
        base_demand = max(5, 60 - 0.05 * (price - 600))
        if date.dayofweek >= 5: base_demand *= 1.3
        if 60 <= i <= 90: base_demand *= 1.25
        base_demand += i * 0.04
        units = int(max(1, round(base_demand + rng.normal(0, 4))))
        stock -= units
        if stock < 80: stock += rng.integers(200, 400)
        stock = max(0, stock)
        rating = round(np.clip(rating + rng.normal(0, 0.02), 3.5, 4.8), 2)
        rows.append({"date": date.strftime("%Y-%m-%d"), "price": price,
                      "units_sold": units, "stock": stock, "rating": rating,
                      "revenue": price * units})
    return pd.DataFrame(rows)


def generate_competitor_data(seed: int = RANDOM_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed + 7)
    dates = pd.date_range(start=SIM_START_DATE, periods=SIMULATION_DAYS, freq="D")
    rows = []
    for marketplace, info in MARKETPLACES.items():
        lo, hi = info["base_range"]
        for brand_name in info["brands"]:
            price = (lo + hi) / 2
            rating = rng.uniform(3.5, 4.5)
            for i, date in enumerate(dates):
                price += rng.normal(0, 0.012) * price
                price = np.clip(price, lo, hi)
                disc = 0.0
                if rng.random() < 0.08:
                    disc = rng.uniform(5, 25)
                elif rng.random() < 0.25:
                    disc = rng.uniform(0, 5)
                rating = np.clip(rating + rng.normal(0, 0.01), 3.2, 4.8)
                eff_price = round(price * (1 - disc / 100))
                rows.append({"date": date.strftime("%Y-%m-%d"), "marketplace": marketplace,
                              "brand": brand_name, "price": eff_price,
                              "rating": round(rating, 2), "discount": round(disc, 1)})
    return pd.DataFrame(rows)
