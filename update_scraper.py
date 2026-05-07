import re

with open("backend/services/scraper_engine.py", "r", encoding="utf-8") as f:
    content = f.read()

new_mock_data = '''AMAZON_PRODUCTS = [
    {
        "brand": "Amazon Brand - Symbol",
        "name": "Symbol Men's Solid Plain White Round Neck T-Shirt",
        "price": 399,
        "original_price": 999,
        "discount": 60,
        "rating": 4.1,
        "review_count": 5123,
        "seller_count": 3,
        "url": "https://www.amazon.in/dp/B09Z6XJYGG",
        "delivery": "1-2 days (Prime)",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["S", "M", "L", "XL", "XXL"],
    },
    {
        "brand": "Jockey",
        "name": "Jockey Men's Plain White Round Neck T-Shirt",
        "price": 499,
        "original_price": 499,
        "discount": 0,
        "rating": 4.3,
        "review_count": 892,
        "seller_count": 2,
        "url": "https://www.amazon.in/dp/B0CHK2WZ74",
        "delivery": "3-5 days",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["S", "M", "L", "XL"],
    }
]

FLIPKART_PRODUCTS = [
    {
        "brand": "Roadster",
        "name": "Roadster Men Solid Plain White Round Neck T-Shirt",
        "price": 399,
        "original_price": 999,
        "discount": 60,
        "rating": 4.2,
        "review_count": 28456,
        "seller_count": 6,
        "url": "https://www.flipkart.com/jockey-solid-men-round-neck-white-t-shirt/p/itm5316e6d1c81cf",
        "delivery": "2-3 days",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["S", "M", "L", "XL", "XXL"],
    },
    {
        "brand": "HRX by Hrithik Roshan",
        "name": "HRX Men Solid Plain White Round Neck T-Shirt",
        "price": 449,
        "original_price": 999,
        "discount": 55,
        "rating": 4.1,
        "review_count": 15234,
        "seller_count": 4,
        "url": "https://www.flipkart.com/fastcolors-solid-men-round-neck-white-t-shirt/p/itm4b04d16d6cc99",
        "delivery": "2-3 days",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["S", "M", "L", "XL", "XXL"],
    }
]

MYNTRA_PRODUCTS = [
    {
        "brand": "HRX by Hrithik Roshan",
        "name": "HRX Men Solid Plain White Round Neck T-Shirt",
        "price": 499,
        "original_price": 799,
        "discount": 38,
        "rating": 4.3,
        "review_count": 4521,
        "seller_count": 1,
        "url": "https://www.myntra.com/tshirts/hrx-by-hrithik-roshan/hrx-by-hrithik-roshan-men-white-solid-round-neck-t-shirt/1700871/buy",
        "delivery": "3-4 days",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["XS", "S", "M", "L", "XL", "XXL"],
    },
    {
        "brand": "Roadster",
        "name": "Roadster Men Pure Cotton Plain White Round Neck T-Shirt",
        "price": 990,
        "original_price": 1990,
        "discount": 50,
        "rating": 4.4,
        "review_count": 287,
        "seller_count": 1,
        "url": "https://www.myntra.com/tshirts/roadster/roadster-men-white-pure-cotton-t-shirt/1996777/buy",
        "delivery": "4-6 days",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["S", "M", "L", "XL"],
    }
]

AJIO_PRODUCTS = [
    {
        "brand": "DNMX",
        "name": "DNMX Men Plain White Round Neck T-Shirt",
        "price": 900,
        "original_price": 1799,
        "discount": 50,
        "rating": 3.5,
        "review_count": 50,
        "seller_count": 1,
        "url": "https://www.ajio.com/dnmx-men-crew-neck-t-shirt/p/441119741_white",
        "delivery": "4-6 days",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["S", "M", "L", "XL", "XXL"],
    },
    {
        "brand": "Netplay",
        "name": "Netplay Men Solid Plain White Round Neck T-Shirt",
        "price": 800,
        "original_price": 1999,
        "discount": 60,
        "rating": 4.1,
        "review_count": 11,
        "seller_count": 1,
        "url": "https://www.ajio.com/netplay-slim-fit-crew-neck-t-shirt/p/441126710_white",
        "delivery": "4-6 days",
        "in_stock": True,
        "specifications": {
            "material": "100% Cotton",
            "fit": "Regular fit",
            "neckline": "Round neck",
            "sleeve": "Short sleeve",
            "color": "White"
        },
        "sizes_available": ["S", "M", "L", "XL"],
    }
]'''

# Regex to replace everything from AMAZON_PRODUCTS = [ down to the end of AJIO_PRODUCTS = [...]
pattern = r'AMAZON_PRODUCTS = \[.*?AJIO_PRODUCTS = \[[^\]]*\]'
new_content = re.sub(pattern, new_mock_data, content, flags=re.DOTALL)

with open("backend/services/scraper_engine.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated scraper_engine.py successfully.")
