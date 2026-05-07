import requests
import time

urls = [
    "https://www.amazon.in/dp/B012STP7EO",
    "https://www.amazon.in/dp/B077Z65HVD",
    "https://www.amazon.in/dp/B0B2RDN3R6",
    "https://www.amazon.in/dp/B01MT2GBS1", # US Polo
    "https://www.flipkart.com/roadster-solid-men-round-neck-white-t-shirt/p/itm93b6ce99cfd34",
    "https://www.myntra.com/tshirts/hm/hm-men-white-solid-cotton-pure-cotton-t-shirt-regular-fit/11468714/buy",
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

for url in urls:
    try:
        r = requests.get(url, headers=headers, timeout=5)
        print(f"[{r.status_code}] {url}")
    except Exception as e:
        print(f"[ERR] {url}: {e}")
    time.sleep(1)
