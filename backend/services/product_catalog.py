"""Product Catalog — manages product profiles, default H&M T-shirt, and URL-based lookups."""

DEFAULT_PRODUCTS = {
    "hm-relaxed-fit-tshirt": {
        "id": "hm-relaxed-fit-tshirt",
        "name": "Relaxed Fit T-shirt",
        "brand": "H&M",
        "url": "https://www2.hm.com/en_in/productpage.1309319011.html",
        "image": "/hm_white_tshirt.png",
        "price": 799,
        "cost_price": 350,
        "currency": "INR",
        "category": "Men > T-shirts & Tanks",
        "sku": "1309319011",
        "concept": "BASICS",
        "description": "T-shirt in midweight cotton jersey with a round, rib-trimmed neckline, dropped shoulders and a straight-cut hem. Relaxed fit for a casual but not oversized silhouette.",
        "specifications": {
            "fit": "Relaxed fit",
            "length": "Regular length",
            "sleeve": "Short sleeve",
            "neckline": "Round, rib-trimmed crew-neck",
            "material": "100% Cotton",
            "fabric": "Midweight cotton jersey",
            "color": "White",
        },
        "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
        "size_chart": {
            "XS": {"width": "100 cm", "length": "68 cm"},
            "S":  {"width": "108 cm", "length": "70 cm"},
            "M":  {"width": "116 cm", "length": "71 cm"},
            "L":  {"width": "124 cm", "length": "73 cm"},
            "XL": {"width": "132 cm", "length": "74 cm"},
            "XXL": {"width": "140 cm", "length": "76 cm"},
        },
        "care": [
            "Machine wash at 40°",
            "Wash with similar colours",
            "Line dry",
            "High iron",
            "Can be dry cleaned",
            "Non-chlorine bleach when needed",
            "Tumble dry medium",
        ],
        "available_colors": [
            "White", "Black", "Dark plum purple", "Forest green", "Blue",
            "Beige", "Light blue", "Pink", "Brown", "Green", "Grey",
            "Navy", "Red", "Yellow", "Olive", "Burgundy", "Cream",
            "Charcoal", "Teal"
        ],
    },
    "generic-white-tshirt": {
        "id": "generic-white-tshirt",
        "name": "Classic White T-Shirt",
        "brand": "D2C Brand",
        "url": "",
        "image": "/hm_white_tshirt.png",
        "price": 799,
        "cost_price": 350,
        "currency": "INR",
        "category": "Men > T-shirts",
        "sku": "DTC-WT-001",
        "concept": "ESSENTIALS",
        "description": "Premium quality cotton crew-neck white t-shirt. Soft, breathable fabric perfect for everyday wear.",
        "specifications": {
            "fit": "Regular fit",
            "length": "Regular length",
            "sleeve": "Short sleeve",
            "neckline": "Crew-neck",
            "material": "100% Cotton",
            "fabric": "Premium combed cotton",
            "color": "White",
        },
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "size_chart": {
            "S":  {"width": "100 cm", "length": "70 cm"},
            "M":  {"width": "108 cm", "length": "72 cm"},
            "L":  {"width": "116 cm", "length": "74 cm"},
            "XL": {"width": "124 cm", "length": "76 cm"},
            "XXL": {"width": "132 cm", "length": "78 cm"},
        },
        "care": [
            "Machine wash at 40°",
            "Wash with similar colours",
            "Tumble dry low",
            "Iron medium",
        ],
        "available_colors": ["White", "Black", "Grey", "Navy"],
    },
}


def get_all_products() -> list[dict]:
    """Return all available product profiles."""
    return list(DEFAULT_PRODUCTS.values())


def get_product_by_id(product_id: str) -> dict | None:
    """Get a specific product by its ID."""
    return DEFAULT_PRODUCTS.get(product_id)


def lookup_product_by_url(url: str) -> dict | None:
    """Try to match a URL to a known product."""
    url_lower = url.lower().strip()
    for prod in DEFAULT_PRODUCTS.values():
        if prod["url"] and prod["url"].lower() in url_lower:
            return prod
        # Match by SKU in URL
        if prod["sku"] and prod["sku"] in url:
            return prod
    # If no match, return a custom product stub
    return {
        "id": "custom-url-product",
        "name": "Custom Product",
        "brand": "Unknown",
        "url": url,
        "image": "",
        "price": 0,
        "cost_price": 0,
        "currency": "INR",
        "category": "Unknown",
        "sku": "",
        "concept": "",
        "description": f"Product from URL: {url}. Specs will be extracted on analysis.",
        "specifications": {},
        "sizes": [],
        "size_chart": {},
        "care": [],
        "available_colors": [],
    }
