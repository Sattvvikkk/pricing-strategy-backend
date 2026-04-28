"""Ajio connector — simulated. Production: use Selenium."""
import numpy as np

def scrape_ajio(seed: int = 400) -> list[dict]:
    rng = np.random.default_rng(seed + int(np.datetime64("today", "D").astype(int)))
    brands = [
        {"brand": "Uniqlo", "base": 699, "spread": 90},
        {"brand": "GAP", "base": 799, "spread": 100},
        {"brand": "Superdry", "base": 999, "spread": 130},
    ]
    results = []
    for b in brands:
        price = round(b["base"] + rng.normal(0, b["spread"]))
        price = max(399, min(1299, price))
        rating = round(rng.uniform(3.9, 4.6), 1)
        discount = round(rng.choice([0, 0, 5, 10, 15, 20, 25]), 1)
        results.append({
            "marketplace": "Ajio",
            "brand": b["brand"],
            "price": price,
            "rating": rating,
            "discount": discount,
        })
    return results
