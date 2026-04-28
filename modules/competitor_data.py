"""
Module B — Competitor Data Module
Simulates daily pricing data for 4 competitor brands over the simulation period.
"""
import numpy as np
import pandas as pd
from config import COMPETITORS, SIMULATION_DAYS, SIM_START_DATE, RANDOM_SEED


def generate_competitor_data(seed: int = RANDOM_SEED) -> pd.DataFrame:
    """
    Return a DataFrame with columns:
        date, brand, price, rating, discount
    One row per brand per day.
    """
    rng = np.random.default_rng(seed + 7)  # offset seed from sales data
    dates = pd.date_range(start=SIM_START_DATE, periods=SIMULATION_DAYS, freq="D")

    rows = []
    for brand, info in COMPETITORS.items():
        price = (info["base_price_low"] + info["base_price_high"]) / 2.0
        rating = (info["rating_low"] + info["rating_high"]) / 2.0

        for i, date in enumerate(dates):
            # ── Price random walk ────────────────────────────────────────
            price_change = rng.normal(0, 0.012) * price
            price += price_change
            price = np.clip(price, info["base_price_low"], info["base_price_high"])

            # Occasional sale events (~8 % of days)
            is_sale = rng.random() < 0.08
            discount = 0.0
            if is_sale:
                discount = rng.uniform(info["discount_low"], info["discount_high"])
            else:
                # Small random discount some days
                if rng.random() < 0.25:
                    discount = rng.uniform(0, info["discount_low"] + 5)

            # ── Rating drift ─────────────────────────────────────────────
            rating += rng.normal(0, 0.01)
            rating = np.clip(rating, info["rating_low"], info["rating_high"])

            effective_price = round(price * (1 - discount / 100), 0)

            rows.append({
                "date": date.strftime("%Y-%m-%d"),
                "brand": brand,
                "price": round(effective_price, 0),
                "rating": round(rating, 2),
                "discount": round(discount, 1),
            })

    df = pd.DataFrame(rows)
    return df


def get_competitor_summary(comp_df: pd.DataFrame) -> pd.DataFrame:
    """Return latest snapshot: one row per brand with avg price, rating, discount."""
    latest_date = comp_df["date"].max()
    latest = comp_df[comp_df["date"] == latest_date].copy()
    return latest[["brand", "price", "rating", "discount"]]
