"""Flipkart connector — simulated. Production: use SerpAPI."""
import numpy as np

def fetch_flipkart(seed: int = 200) -> list[dict]:
    rng = np.random.default_rng(seed + int(np.datetime64("today", "D").astype(int)))
    brands = [
        {"brand": "Roadster", "base": 549, "spread": 90},
        {"brand": "HRX by Hrithik", "base": 599, "spread": 80},
        {"brand": "Metronaut", "base": 449, "spread": 70},
    ]
    results = []
    for b in brands:
        price = round(b["base"] + rng.normal(0, b["spread"]))
        price = max(299, min(999, price))
        rating = round(rng.uniform(3.5, 4.6), 1)
        discount = round(rng.choice([0, 0, 5, 10, 15, 20, 30]), 1)
        results.append({
            "marketplace": "Flipkart",
            "brand": b["brand"],
            "price": price,
            "rating": rating,
            "discount": discount,
        })
    return results
