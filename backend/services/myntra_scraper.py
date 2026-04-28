"""Myntra connector — simulated. Production: use Selenium."""
import numpy as np

def scrape_myntra(seed: int = 300) -> list[dict]:
    rng = np.random.default_rng(seed + int(np.datetime64("today", "D").astype(int)))
    brands = [
        {"brand": "H&M", "base": 799, "spread": 100},
        {"brand": "Zara", "base": 990, "spread": 120},
        {"brand": "Mango", "base": 899, "spread": 110},
    ]
    results = []
    for b in brands:
        price = round(b["base"] + rng.normal(0, b["spread"]))
        price = max(499, min(1499, price))
        rating = round(rng.uniform(3.8, 4.7), 1)
        discount = round(rng.choice([0, 0, 0, 5, 10, 15]), 1)
        results.append({
            "marketplace": "Myntra",
            "brand": b["brand"],
            "price": price,
            "rating": rating,
            "discount": discount,
        })
    return results
