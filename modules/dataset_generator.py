"""
Module A — Dataset Generator
Produces 6 months of realistic simulated daily sales data for a white t-shirt.
"""
import numpy as np
import pandas as pd
from config import (
    BASE_PRICE, PRICE_FLOOR, PRICE_CEILING, INITIAL_STOCK,
    RESTOCK_THRESHOLD, SIMULATION_DAYS, SIM_START_DATE, RANDOM_SEED,
)


def generate_sales_data(seed: int = RANDOM_SEED) -> pd.DataFrame:
    """
    Return a DataFrame with columns:
        date, price, units_sold, rating, stock, revenue
    for SIMULATION_DAYS consecutive days starting at SIM_START_DATE.
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start=SIM_START_DATE, periods=SIMULATION_DAYS, freq="D")

    prices = []
    units_sold_list = []
    ratings = []
    stocks = []
    revenues = []

    price = float(BASE_PRICE)
    stock = INITIAL_STOCK
    rating = 4.1  # starting rating

    for i, date in enumerate(dates):
        # ── Price random walk ────────────────────────────────────────────
        price_change_pct = rng.normal(0, 0.015)  # ~1.5 % daily std dev
        # Add a small seasonal bump (festival season around day 60-90)
        if 60 <= i <= 90:
            price_change_pct += 0.003  # slight upward trend in festival season
        price *= (1 + price_change_pct)
        price = np.clip(price, PRICE_FLOOR, PRICE_CEILING)
        price = round(price, 0)

        # ── Demand model ─────────────────────────────────────────────────
        # Base demand inversely correlated with price
        base_demand = max(5, 60 - 0.05 * (price - 600))
        # Weekend boost (Sat=5, Sun=6)
        dow = date.dayofweek
        if dow >= 5:
            base_demand *= 1.3
        # Festival season boost
        if 60 <= i <= 90:
            base_demand *= 1.25
        # Small upward trend over time (brand awareness)
        base_demand += i * 0.04
        # Noise
        demand_noise = rng.normal(0, 4)
        units = int(max(1, round(base_demand + demand_noise)))

        # ── Stock management ─────────────────────────────────────────────
        stock -= units
        if stock < RESTOCK_THRESHOLD:
            restock = rng.integers(200, 400)
            stock += restock
        stock = max(0, stock)

        # ── Rating drift ─────────────────────────────────────────────────
        rating += rng.normal(0, 0.02)
        rating = np.clip(rating, 3.5, 4.8)

        # ── Revenue ──────────────────────────────────────────────────────
        revenue = price * units

        prices.append(price)
        units_sold_list.append(units)
        ratings.append(round(rating, 2))
        stocks.append(stock)
        revenues.append(revenue)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "price": prices,
        "units_sold": units_sold_list,
        "rating": ratings,
        "stock": stocks,
        "revenue": revenues,
    })
    return df
