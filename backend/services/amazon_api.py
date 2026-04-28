"""Amazon connector — simulated. Production: use RapidAPI / Scraper API."""
import numpy as np

def fetch_amazon(seed: int = 100) -> list[dict]:
    """Return current Amazon white t-shirt prices."""
    rng = np.random.default_rng(seed + int(np.datetime64("today", "D").astype(int)))
    brands = [
        {"brand": "Amazon Basics", "base": 499, "spread": 80},
        {"brand": "Dennis Lingo", "base": 549, "spread": 100},
        {"brand": "GHPC", "base": 399, "spread": 60},
    ]
    results = []
    for b in brands:
        price = round(b["base"] + rng.normal(0, b["spread"]))
        price = max(299, min(899, price))
        rating = round(rng.uniform(3.2, 4.5), 1)
        discount = round(rng.choice([0, 0, 0, 5, 10, 15, 20, 25]), 1)
        results.append({
            "marketplace": "Amazon",
            "brand": b["brand"],
            "price": price,
            "rating": rating,
            "discount": discount,
        })
    return results
