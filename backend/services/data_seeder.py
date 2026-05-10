"""Data Seeder — seeds 40 products + 90 days of synthetic sales + competitor history."""
import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from models import Product, SalesHistory, CompetitorData
from services.product_catalog import DEFAULT_PRODUCTS


# Day-of-week demand multipliers (0=Monday … 6=Sunday)
DOW_MULTIPLIERS = {
    0: 0.85,   # Monday
    1: 0.90,   # Tuesday
    2: 0.95,   # Wednesday
    3: 1.00,   # Thursday
    4: 1.15,   # Friday
    5: 1.35,   # Saturday
    6: 1.25,   # Sunday
}

HISTORY_DAYS = 90

# Platform configs: (brand, price_multiplier_range)
PLATFORM_CONFIG = {
    "Amazon":   [("Amazon Basics", 0.85, 0.95), ("Dennis Lingo", 0.90, 1.00)],
    "Flipkart": [("Roadster", 0.88, 0.98),      ("HRX by HRX", 0.92, 1.05)],
    "Myntra":   [("H&M", 0.95, 1.10),           ("Zara", 1.05, 1.25)],
    "Ajio":     [("Uniqlo", 0.93, 1.08),         ("GAP", 1.00, 1.20)],
}


def seed_database(db: Session) -> None:
    """Seed products, sales history, and competitor data. Idempotent."""
    existing = db.query(SalesHistory).first()
    if existing:
        print("Seeder: Data already exists — skipping.")
        return

    # ── 1. Seed Products ──────────────────────────────────────────────────────
    for pid, pdata in DEFAULT_PRODUCTS.items():
        product = Product(
            id=pid,
            name=pdata["name"],
            brand=pdata["brand"],
            category=pdata["category"],
            current_price=pdata["price"],
            cost_price=pdata["cost_price"],
        )
        db.merge(product)      # merge handles re-runs safely

    db.flush()

    today = date.today()
    random.seed(42)            # reproducible

    # ── 2. Generate 90-day sales history per product ──────────────────────────
    history_records = []

    for pid, pdata in DEFAULT_PRODUCTS.items():
        base_price = pdata["price"]
        base_demand = max(5, int(3500 / base_price * 8))

        for day_offset in range(HISTORY_DAYS):
            record_date = today - timedelta(days=HISTORY_DAYS - 1 - day_offset)
            dow = record_date.weekday()          # 0=Mon … 6=Sun

            demand = base_demand

            # Day-of-week multiplier
            demand *= DOW_MULTIPLIERS[dow]

            # Random noise (0.85 – 1.15)
            demand *= random.uniform(0.85, 1.15)

            # Seasonal trend — last 30 days get a slight upward ramp (1.0 → 1.15)
            if day_offset >= (HISTORY_DAYS - 30):
                ramp_position = (day_offset - (HISTORY_DAYS - 30)) / 29   # 0.0 → 1.0
                demand *= 1.0 + 0.15 * ramp_position

            # Occasional sale spikes — 5 % of days get 1.5x – 2.0x
            if random.random() < 0.05:
                demand *= random.uniform(1.5, 2.0)

            units_sold = max(1, int(round(demand)))

            # Price with ±3 % daily noise
            day_price = round(base_price * random.uniform(0.97, 1.03), 2)
            revenue = round(day_price * units_sold, 2)

            history_records.append(SalesHistory(
                product_id=pid,
                date=record_date,
                price=day_price,
                units_sold=units_sold,
                revenue=revenue,
                day_of_week=dow,
            ))

    db.bulk_save_objects(history_records)

    # ── 3. Generate competitor data per product ───────────────────────────────
    comp_records = []
    # Scrape 30 distinct dates spread across the 90-day window
    sample_dates = [today - timedelta(days=d) for d in range(0, 90, 3)]  # 30 dates

    for pid, pdata in DEFAULT_PRODUCTS.items():
        base_price = pdata["price"]

        for rec_date in sample_dates:
            for platform, brands in PLATFORM_CONFIG.items():
                brand_name, lo_mult, hi_mult = random.choice(brands)
                comp_price = round(base_price * random.uniform(lo_mult, hi_mult), 2)

                comp_records.append(CompetitorData(
                    product_id=pid,
                    platform=platform,
                    price=comp_price,
                    title=f"{brand_name} similar product",
                    merchant=brand_name,
                    link=None,
                ))

    db.bulk_save_objects(comp_records)
    db.commit()
    print(f"Seeder: {len(DEFAULT_PRODUCTS)} products, "
          f"{len(history_records)} sales records, "
          f"{len(comp_records)} competitor records.")
