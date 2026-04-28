"""Unified marketplace aggregator — collects prices from all sources."""
from services.scraper_engine import run_full_scrape

def get_all_prices() -> list[dict]:
    """Fetch prices from all marketplaces using the scraper engine."""
    scrape_result = run_full_scrape()
    data = []
    for mp in scrape_result.get("marketplaces", []):
        for p in mp.get("products", []):
            data.append({
                "marketplace": mp.get("marketplace"),
                "brand": p.get("brand"),
                "price": p.get("price"),
                "rating": p.get("rating"),
                "discount": p.get("discount")
            })
    return data


def get_competitor_avg_price() -> float:
    """Get the average price across all marketplace competitors."""
    prices = get_all_prices()
    if not prices:
        return 700.0
    return round(sum(p["price"] for p in prices) / len(prices), 2)
