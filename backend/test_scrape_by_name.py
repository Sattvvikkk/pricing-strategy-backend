import sys
sys.path.insert(0, '.')
from services.scraper_engine import scrape_by_name

r = scrape_by_name('Black Oversized T-Shirt', 'T-Shirts', ['myntra','ajio','amazon','flipkart'], 12)
print(f"Results: {r['count']}, source: {r['source']}")
print(f"Query: {r['query']}, Color: {r['color']}, Fit: {r['fit']}")
print()
for p in r['results'][:8]:
    print(f"  [{p['marketplace']}] {p['brand']} | color={p['color']} fit={p['fit']} price={p['price']}")
    print(f"    Title: {p['title']}")
