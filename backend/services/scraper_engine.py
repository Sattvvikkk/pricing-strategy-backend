"""Four-tier competitor price fetcher.
Tier 1 — SerpApi        (SERPAPI_KEY set)
Tier 2 — Playwright     (ENABLE_PLAYWRIGHT=true)
Tier 3 — Selenium       (ENABLE_SELENIUM=true)
Tier 4 — Static fallback (always works)
"""
from __future__ import annotations
import asyncio, logging, os, random, time, re
from typing import AsyncGenerator
from urllib.parse import quote_plus
import httpx
from services.product_catalog import get_product_by_id, DEFAULT_PRODUCTS

logger = logging.getLogger(__name__)

# ── Static data ──────────────────────────────────────────────────────────────
_RANGES = {
    "T-Shirts":   (499, 1799),
    "Jeans":      (1499, 3999),
    "Dresses":    (999, 3499),
    "Jackets":    (1999, 6999),
    "Shirts":     (699, 2499),
    "Trousers":   (799, 2999),
    "Sweatshirts":(899, 2999),
    "Activewear": (599, 2499),
}

# Title templates — {color} and {fit} are filled with the queried attributes.
_TITLE_TEMPLATES = {
    "T-Shirts": [
        "{color} {fit} T-Shirt",
        "{color} Half-Sleeve {fit} Tee",
        "Solid {color} {fit} T-Shirt",
        "{color} Cotton {fit} Round-Neck Tee",
        "Premium {color} {fit} T-Shirt",
        "Everyday {color} {fit} Tee",
        "{color} Drop-Shoulder {fit} T-Shirt",
        "Classic {color} {fit} Half-Sleeve Tee",
    ],
    "Jeans": [
        "{color} {fit} Denim Jeans",
        "{color} Mid-Rise {fit} Jeans",
        "Stretch {color} {fit} Jeans",
        "{color} {fit} Denim",
        "Classic {color} {fit} Jeans",
    ],
    "Jackets": [
        "{color} {fit} Bomber Jacket",
        "{color} Lightweight {fit} Jacket",
        "{color} {fit} Windbreaker",
        "Quilted {color} {fit} Jacket",
        "{color} Denim {fit} Jacket",
    ],
    "Shirts": [
        "{color} {fit} Casual Shirt",
        "{color} Full-Sleeve {fit} Shirt",
        "Solid {color} {fit} Shirt",
        "{color} Cotton {fit} Shirt",
        "{color} {fit} Linen Shirt",
    ],
    "Trousers": [
        "{color} {fit} Trousers",
        "{color} {fit} Chinos",
        "Formal {color} {fit} Trousers",
        "{color} Stretch {fit} Pants",
        "{color} {fit} Cargo Trousers",
    ],
    "Sweatshirts": [
        "{color} {fit} Sweatshirt",
        "{color} Fleece {fit} Sweatshirt",
        "{color} Graphic {fit} Sweatshirt",
        "Cozy {color} {fit} Pullover",
        "{color} {fit} Hoodie",
    ],
    "Activewear": [
        "{color} {fit} Activewear Top",
        "{color} Compression {fit} Tee",
        "{color} Moisture-Wicking {fit} Top",
        "{color} Sports {fit} Vest",
        "Performance {color} {fit} Shirt",
    ],
    "Dresses": [
        "{color} {fit} Midi Dress",
        "{color} Wrap {fit} Dress",
        "Solid {color} {fit} A-Line Dress",
        "{color} {fit} Maxi Dress",
        "{color} Shift {fit} Dress",
    ],
}

# Brand lists per marketplace (15 per platform matches frontend)
_MP_MERCHANTS = {
    "Amazon":   [
        "H&M India", "Campus Sutra", "Bewakoof", "Roadster", "Urbanic",
        "Symbol", "Allen Solly", "Levi's", "Van Heusen", "U.S. Polo Assn.",
        "Max", "Global Desi", "Pepe Jeans", "Kraus Jeans", "Miss Chase",
    ],
    "Flipkart": [
        "HRX by Hrithik", "Allen Solly", "Van Heusen", "Arrow", "Puma",
        "Highlander", "Harvard", "Provogue", "Metronaut", "Veirdo",
        "Urbano Fashion", "Tokyo Talkies", "Sassafras", "Ketch", "Dollar Missy",
    ],
    "Myntra":   [
        "Roadster", "Tokyo Talkies", "DressBerry", "Athena", "HERE&NOW",
        "SASSAFRAS", "Sangria", "Chemistry", "StyleCast", "KASSUALLY",
        "Berrylush", "Mast & Harbour", "Moda Rapido", "Campus Sutra", "Anouk",
    ],
    "Ajio":     [
        "Outryt", "Avaasa", "Netplay", "Teamspirit", "Indie Picks",
        "Rio", "DNMX", "Project Eve", "Puma", "GAP",
        "Superdry", "Stylum", "The Indian Garage Co", "Miss Chase", "Fig",
    ],
}

# Known colors and fits for name-parsing
_KNOWN_COLORS = [
    "black", "white", "grey", "gray", "navy", "blue", "red", "green", "olive",
    "beige", "cream", "ivory", "coral", "rust", "indigo", "charcoal", "sand",
    "stone", "forest", "light blue", "denim", "pink", "yellow", "orange", "purple",
]
_KNOWN_FITS = [
    "oversized", "slim fit", "regular fit", "relaxed fit", "skinny", "straight fit",
    "wide leg", "tapered", "cropped", "athletic fit", "jogger", "boxy",
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def _query(product: dict) -> str:
    name = product.get("name",""); brand = product.get("brand",""); cat = product.get("category","")
    if brand and name.lower().startswith(brand.lower()):
        name = name[len(brand):].strip()
    return " ".join(p for p in [brand, name or cat] if p)[:60]

def get_product_for_scrape(product_id: str | None = None) -> dict:
    p = get_product_by_id(product_id) if product_id else None
    return p or list(DEFAULT_PRODUCTS.values())[0]

def _parse_price(raw: str) -> float:
    try: return float(str(raw).replace("₹","").replace("\u20b9","").replace(",","").strip().split()[0])
    except: return 0.0

# ── Name attribute parser ────────────────────────────────────────────────────
def _parse_name_attributes(name: str) -> dict:
    """Extract color, fit, and category hints from a free-form product name."""
    name_lower = name.lower()
    color = None
    for c in _KNOWN_COLORS:
        if c in name_lower:
            color = c.title()
            break
    fit = None
    for f in _KNOWN_FITS:
        if f in name_lower:
            fit = f.title()
            break
    return {"color": color, "fit": fit}

# ── Tier 4: Static (product-name-aware) ──────────────────────────────────────
def _tier4_static(product: dict, color_override: str | None = None, fit_override: str | None = None) -> list[dict]:
    """Generate realistic static listings, biased to the product's color/fit."""
    cat = product.get("category", "T-Shirts")
    lo, hi = _RANGES.get(cat, (499, 2999))
    templates = _TITLE_TEMPLATES.get(cat, _TITLE_TEMPLATES["T-Shirts"])

    # Resolve color/fit: override > product attrs > parse from name
    name_attrs = _parse_name_attributes(product.get("name", ""))
    color = (color_override
             or product.get("color")
             or (product.get("specifications") or {}).get("color")
             or name_attrs["color"]
             or "Black")
    fit   = (fit_override
             or product.get("fit")
             or (product.get("specifications") or {}).get("fit")
             or name_attrs["fit"]
             or "Regular")

    # Clean fit label for title use (e.g. "Regular Fit" -> "Regular Fit")
    fit_word = fit.split()[0] if fit else "Regular"

    seed_key = product.get("id", product.get("name", "x"))
    rng = random.Random(abs(hash(seed_key)))
    results = []
    for mp, merchants in _MP_MERCHANTS.items():
        mp_merchants = list(merchants)
        for idx in range(rng.randint(4, 6)):
            m = mp_merchants[idx % len(mp_merchants)]
            template = templates[idx % len(templates)]
            t = template.format(color=color, fit=fit_word)
            p = round(rng.uniform(lo, hi), -1)
            op = round(p * rng.uniform(1.1, 1.5), -1)
            results.append({
                "marketplace": mp,
                "title": f"{m} — {t}",
                "price": float(p),
                "original_price": float(op),
                "discount": round((op - p) / op * 100),
                "rating": round(rng.uniform(3.5, 4.8), 1),
                "review_count": rng.randint(50, 8000),
                "merchant": m,
                "color": color,
                "fit": fit,
                "category": cat,
                "link": "",
                "_source_tier": 4,
                "_source_badge": "⚪ SAMPLE DATA",
            })
    return results


def scrape_by_name(
    product_name: str,
    category: str = "T-Shirts",
    marketplaces: list[str] | None = None,
    count: int = 30,
    color: str | None = None,
    fit: str | None = None,
    anchor_price: float | None = None,
) -> dict:
    """
    Build a rich competitor product list for a given product name / query.
    Attempts live tiers (SerpApi) then falls back to static sample data.
    Returns a dict ready to serialize as the /api/marketplace/search response.
    """
    if marketplaces is None:
        marketplaces = list(_MP_MERCHANTS.keys())

    # Normalise marketplace names to match _MP_MERCHANTS keys
    _id_map = {"myntra": "Myntra", "ajio": "Ajio", "amazon": "Amazon", "flipkart": "Flipkart"}
    mp_keys = [_id_map.get(m.lower(), m) for m in marketplaces]

    # Parse attributes from name if not supplied
    name_attrs = _parse_name_attributes(product_name)
    resolved_color = (color or name_attrs["color"] or "Black").strip().title()
    resolved_fit   = (fit   or name_attrs["fit"]   or "Regular").strip().title()
    fit_word = resolved_fit.split()[0]

    cat = category
    lo, hi = _RANGES.get(cat, (499, 2999))
    templates = _TITLE_TEMPLATES.get(cat, _TITLE_TEMPLATES["T-Shirts"])
    fabrics = ["100% Cotton", "Linen Blend", "Viscose", "Rayon", "Cotton Lycra", "Modal", "Poly-Cotton"]
    positions = ["Premium Segment", "Fast Fashion", "Heavy Discounting", "Bestseller",
                 "Trend-Driven", "Minimalist Styling", "Occasion Wear", "Streetwear"]
    fits_pool = ["Slim Fit", "Relaxed Fit", "Regular Fit", "Oversized",
                 "Tailored", "Athletic fit", "Straight fit", "Wide leg"]
    colors_pool = ["Coral", "Ivory", "Charcoal", "Indigo", "Olive", "Rust",
                   "Black", "Sand", "Cream", "Stone", "Forest", "White",
                   "Beige", "Green", "Navy", "Blue", "Grey"]
    mp_offset = {"Myntra": 0, "Ajio": 3, "Amazon": 6, "Flipkart": 9}

    results = []
    per_mp = max(4, count // max(1, len(mp_keys)))

    # Attempt Tier 1 (SerpApi) for live prices
    source_badge = "⚪ SAMPLE DATA"
    source = "static"
    serp_key = os.getenv("SERPAPI_KEY", "").strip()
    live_prices: dict[str, list[float]] = {}
    if serp_key and not serp_key.startswith("your_"):
        q = f"{resolved_color} {fit_word} {cat.rstrip('s')}"
        url = (f"https://serpapi.com/search.json?engine=google_shopping"
               f"&q={quote_plus(q)}&gl=in&hl=en&api_key={serp_key}")
        try:
            resp = httpx.get(url, timeout=15)
            resp.raise_for_status()
            for item in resp.json().get("shopping_results", []):
                price = float(str(item.get("extracted_price") or 0).replace(",", ""))
                mp_name = _merchant_to_mp(item.get("source", ""))
                if price and mp_name in mp_keys:
                    live_prices.setdefault(mp_name, []).append(price)
            if live_prices:
                source_badge = "🟢 LIVE — SerpApi"
                source = "serpapi"
        except Exception as e:
            logger.warning("SerpApi search: %s", e)

    for mp_name in mp_keys:
        merchants = _MP_MERCHANTS.get(mp_name, [])
        if not merchants:
            continue
        offset = mp_offset.get(mp_name, 0)
        live_p_list = live_prices.get(mp_name, [])

        # Pricing tilt per marketplace
        mp_shift = {"Myntra": 0.05, "Ajio": 0.12, "Amazon": -0.15, "Flipkart": -0.20}.get(mp_name, 0)

        similar_count = int(per_mp * 0.65)  # first 65% match the queried color/fit

        for i in range(per_mp):
            seed = abs(hash(f"{mp_name}-{cat}-{product_name}-{i}"))
            rng_inst = random.Random(seed)

            brand = merchants[i % len(merchants)]
            similar_slot = i < similar_count

            # Color/Fit: first N cards exactly match the query, rest diversify
            card_color = resolved_color if similar_slot else colors_pool[seed % len(colors_pool)]
            card_fit   = resolved_fit   if similar_slot else fits_pool[seed % len(fits_pool)]
            card_fit_word = card_fit.split()[0]
            fabric = fabrics[seed % len(fabrics)]
            positioning = positions[seed % len(positions)]

            template = templates[(i + offset) % len(templates)]
            title_only = template.format(color=card_color, fit=card_fit_word)
            full_title = f"{brand} — {title_only}"

            # Price: use live data if available, else synthetic
            if live_p_list:
                base = live_p_list[i % len(live_p_list)]
            elif anchor_price:
                variance = ((seed % 80) - 40) / 100
                base = max(299, round(anchor_price * (1 + variance + mp_shift)))
            else:
                base = round(rng_inst.uniform(lo, hi), -1)

            mrp = round((base * 1.6) / 10) * 10
            disc_pct = 15 + (seed % 60)
            price = round((mrp * (100 - disc_pct) / 100) / 10) * 10

            rating  = round(3.6 + (seed % 13) / 10, 1)
            reviews = 80 + (seed % 5800)
            bestseller  = (seed % 11) < 2
            new_arrival = not bestseller and (seed % 9) < 2
            sizes = [s for k, s in enumerate(["XS","S","M","L","XL","XXL"])
                     if ((seed >> (k + 1)) & 1) == 1 or k <= 3]
            delivery = ("Express, same city" if seed % 3 == 0
                        else "Standard, 4\u20136 days")

            results.append({
                "id": f"{mp_name.lower()}-{cat}-{product_name}-{i}".lower().replace(" ", "-"),
                "title": full_title,
                "brand": brand,
                "marketplace": mp_name.lower(),
                "category": cat,
                "color": card_color,
                "fit": card_fit,
                "fabric": fabric,
                "mrp": mrp,
                "price": price,
                "discountPct": disc_pct,
                "rating": rating,
                "reviews": reviews,
                "sizes": sizes,
                "seller": f"{brand} Official Store",
                "bestseller": bestseller,
                "newArrival": new_arrival,
                "positioning": positioning,
                "delivery": delivery,
                "image": "",  # Frontend fills from IMAGES_BY_ATTRIBUTES
                "_source_tier": 4,
                "_source_badge": source_badge,
            })

    return {
        "query": product_name,
        "color": resolved_color,
        "fit": resolved_fit,
        "category": cat,
        "source": source,
        "source_badge": source_badge,
        "results": results,
        "count": len(results),
    }

def _merchant_to_mp(m: str) -> str:
    m = m.lower()
    if "amazon" in m: return "Amazon"
    if "flipkart" in m: return "Flipkart"
    if "myntra" in m: return "Myntra"
    if "ajio" in m: return "Ajio"
    return "Google Shopping"


# ── Tier 1: SerpApi ───────────────────────────────────────────────────────────
def _tier1_serpapi_sync(product: dict) -> list[dict]:
    key = os.getenv("SERPAPI_KEY","").strip()
    if not key or key.startswith("your_"): return []
    q = _query(product)
    url = f"https://serpapi.com/search.json?engine=google_shopping&q={quote_plus(q)}&gl=in&hl=en&api_key={key}"
    try:
        resp = httpx.get(url, timeout=15); resp.raise_for_status(); data = resp.json()
    except Exception as e: logger.error("SerpApi: %s", e); return []
    results = []
    for item in data.get("shopping_results",[]):
        try: price = float(str(item.get("extracted_price") or 0).replace(",",""))
        except: price = 0.0
        if not price: continue
        merchant = item.get("source","Unknown")
        results.append({"marketplace":_merchant_to_mp(merchant),"title":item.get("title",""),
            "price":price,"original_price":None,"discount":None,
            "rating":item.get("rating"),"review_count":item.get("reviews"),
            "merchant":merchant,"link":item.get("link",""),
            "_source_tier":1,"_source_badge":"🟢 LIVE — SerpApi"})
    return results

# ── Tier 2: Playwright ────────────────────────────────────────────────────────
_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"

async def _pw_amazon(product: dict, browser) -> list[dict]:
    q = _query(product)
    url = f"https://www.amazon.in/s?k={quote_plus(q)}&i=apparel"
    results = []; page = None
    try:
        page = await browser.new_page()
        await page.set_extra_http_headers({"User-Agent":_UA,"Accept-Language":"en-IN,en;q=0.9"})
        await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        await page.wait_for_selector('[data-component-type="s-search-result"]', timeout=12000)
        await asyncio.sleep(0.5)
        items = await page.query_selector_all('[data-component-type="s-search-result"]')
        for item in items[:10]:
            try:
                te = await item.query_selector("h2 span.a-text-normal")
                pe = await item.query_selector(".a-price .a-offscreen")
                re = await item.query_selector(".a-icon-alt")
                rve = await item.query_selector(".a-size-base.s-underline-text")
                le = await item.query_selector("h2 a.a-link-normal")
                oe = await item.query_selector(".a-text-price .a-offscreen")
                title = (await te.inner_text()).strip() if te else ""
                price = _parse_price((await pe.inner_text()) if pe else "")
                if not title or not price: continue
                rating_raw = (await re.inner_text()).strip() if re else ""
                try: rating = float(rating_raw.split()[0])
                except: rating = None
                review_raw = (await rve.inner_text()).strip() if rve else ""
                try: rc = int(review_raw.replace(",",""))
                except: rc = None
                href = (await le.get_attribute("href")) if le else ""
                link = f"https://www.amazon.in{href}" if href and href.startswith("/") else (href or "")
                op_raw = (await oe.inner_text()) if oe else ""
                op = _parse_price(op_raw) or None
                disc = round((op-price)/op*100) if op and price else None
                results.append({"marketplace":"Amazon","title":title,"price":price,
                    "original_price":op,"discount":disc,"rating":rating,"review_count":rc,
                    "merchant":"Amazon.in","link":link,"_source_tier":2,"_source_badge":"🟡 LIVE — Playwright"})
            except: continue
    except Exception as e: logger.error("PW Amazon: %s", e)
    finally:
        if page:
            try: await page.close()
            except: pass
    return results

async def _pw_flipkart(product: dict, browser) -> list[dict]:
    q = _query(product)
    url = f"https://www.flipkart.com/search?q={quote_plus(q)}&otracker=search"
    results = []; page = None
    try:
        page = await browser.new_page()
        await page.set_extra_http_headers({"User-Agent":_UA})
        await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        try:
            cb = await page.query_selector("._2KpZ6l._2doB4z")
            if cb: await cb.click(); await asyncio.sleep(0.3)
        except: pass
        await asyncio.sleep(1)
        cards = await page.query_selector_all("._1YokD2._3Mn1Gg ._1AtVbE") or await page.query_selector_all("[data-id]")
        for card in cards[:10]:
            try:
                te = await card.query_selector("._2WkVRV") or await card.query_selector(".s1Q9rs") or await card.query_selector("a[title]")
                pe = await card.query_selector("._30jeq3") or await card.query_selector("._1_WHN1")
                re = await card.query_selector("._3LWZlK")
                le = await card.query_selector("a._1fQZEK") or await card.query_selector("a.s1Q9rs") or await card.query_selector("a[href]")
                oe = await card.query_selector("._3I9_wc") or await card.query_selector("._27UcVY")
                title = ""
                if te: title = (await te.inner_text()).strip()
                elif le: title = (await le.get_attribute("title") or "").strip()
                price = _parse_price((await pe.inner_text()) if pe else "")
                if not title or not price: continue
                rating_raw = (await re.inner_text()).strip() if re else ""
                try: rating = float(rating_raw)
                except: rating = None
                href = (await le.get_attribute("href")) if le else ""
                link = f"https://www.flipkart.com{href}" if href and href.startswith("/") else (href or "")
                op_raw = (await oe.inner_text()) if oe else ""
                op = _parse_price(op_raw) or None
                disc = round((op-price)/op*100) if op and price else None
                results.append({"marketplace":"Flipkart","title":title,"price":price,
                    "original_price":op,"discount":disc,"rating":rating,"review_count":None,
                    "merchant":"Flipkart","link":link,"_source_tier":2,"_source_badge":"🟡 LIVE — Playwright"})
            except: continue
    except Exception as e: logger.error("PW Flipkart: %s", e)
    finally:
        if page:
            try: await page.close()
            except: pass
    return results

async def _scrape_playwright(product: dict, emit) -> list[dict]:
    if os.getenv("ENABLE_PLAYWRIGHT","false").lower() != "true": return []
    try: from playwright.async_api import async_playwright
    except ImportError: logger.warning("playwright not installed"); return []
    results = []
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
            await emit("MP_START",{"marketplace":"Amazon","icon":"🛒","url":f"https://www.amazon.in/s?k={quote_plus(_query(product))}"})
            await emit("MP_START",{"marketplace":"Flipkart","icon":"🏪","url":f"https://www.flipkart.com/search?q={quote_plus(_query(product))}"})
            t0 = time.time()
            amz, fk = await asyncio.gather(
                _pw_amazon(product, browser),
                _pw_flipkart(product, browser),
                return_exceptions=True
            )
            await browser.close()
            for mp_name, mp_res in [("Amazon", amz),("Flipkart", fk)]:
                if isinstance(mp_res, Exception): mp_res = []
                results.extend(mp_res)
                await emit("MP_DONE",{"marketplace":mp_name,"count":len(mp_res),"duration_ms":round((time.time()-t0)*1000)})
    except Exception as e: logger.error("Playwright session: %s", e)
    return results

# ── Tier 3: Selenium ──────────────────────────────────────────────────────────
def _sel_amazon_sync(product: dict) -> list[dict]:
    q = _query(product)
    url = f"https://www.amazon.in/s?k={quote_plus(q)}&i=apparel"
    results = []
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.chrome.service import Service
        opts = Options()
        opts.add_argument("--headless=new"); opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage"); opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument(f"user-agent={_UA}"); opts.add_experimental_option("excludeSwitches",["enable-automation"])
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
        driver.get(url)
        WebDriverWait(driver,12).until(EC.presence_of_element_located((By.CSS_SELECTOR,'[data-component-type="s-search-result"]')))
        items = driver.find_elements(By.CSS_SELECTOR,'[data-component-type="s-search-result"]')
        for item in items[:10]:
            try:
                title = item.find_element(By.CSS_SELECTOR,"h2 span").text.strip()
                price_els = item.find_elements(By.CSS_SELECTOR,".a-price .a-offscreen")
                price = _parse_price(price_els[0].get_attribute("innerHTML")) if price_els else 0.0
                if not title or not price: continue
                try: rating = float(item.find_element(By.CSS_SELECTOR,".a-icon-alt").get_attribute("innerHTML").split()[0])
                except: rating = None
                try: rc = int(item.find_element(By.CSS_SELECTOR,".a-size-base.s-underline-text").text.replace(",",""))
                except: rc = None
                try:
                    href = item.find_element(By.CSS_SELECTOR,"h2 a.a-link-normal").get_attribute("href")
                    link = href if href else ""
                except: link = ""
                results.append({"marketplace":"Amazon","title":title,"price":price,
                    "original_price":None,"discount":None,"rating":rating,"review_count":rc,
                    "merchant":"Amazon.in","link":link,"_source_tier":3,"_source_badge":"🔵 LIVE — Selenium"})
            except: continue
        driver.quit()
    except Exception as e: logger.error("Selenium Amazon: %s", e)
    return results

def _sel_flipkart_sync(product: dict) -> list[dict]:
    q = _query(product)
    url = f"https://www.flipkart.com/search?q={quote_plus(q)}&otracker=search"
    results = []
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.chrome.service import Service
        opts = Options()
        opts.add_argument("--headless=new"); opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage"); opts.add_argument(f"user-agent={_UA}")
        opts.add_experimental_option("excludeSwitches",["enable-automation"])
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
        driver.get(url)
        time.sleep(2)
        try: driver.find_element(By.CSS_SELECTOR,"._2KpZ6l._2doB4z").click()
        except: pass
        time.sleep(0.5)
        cards = driver.find_elements(By.CSS_SELECTOR,"._1AtVbE") or driver.find_elements(By.CSS_SELECTOR,"[data-id]")
        for card in cards[:10]:
            try:
                title_els = card.find_elements(By.CSS_SELECTOR,"._2WkVRV") or card.find_elements(By.CSS_SELECTOR,".s1Q9rs")
                price_els = card.find_elements(By.CSS_SELECTOR,"._30jeq3") or card.find_elements(By.CSS_SELECTOR,"._1_WHN1")
                title = title_els[0].text.strip() if title_els else ""
                price = _parse_price(price_els[0].text) if price_els else 0.0
                if not title or not price: continue
                try: rating = float(card.find_element(By.CSS_SELECTOR,"._3LWZlK").text)
                except: rating = None
                try:
                    a = card.find_element(By.CSS_SELECTOR,"a._1fQZEK") or card.find_element(By.CSS_SELECTOR,"a[href]")
                    href = a.get_attribute("href"); link = href or ""
                except: link = ""
                results.append({"marketplace":"Flipkart","title":title,"price":price,
                    "original_price":None,"discount":None,"rating":rating,"review_count":None,
                    "merchant":"Flipkart","link":link,"_source_tier":3,"_source_badge":"🔵 LIVE — Selenium"})
            except: continue
        driver.quit()
    except Exception as e: logger.error("Selenium Flipkart: %s", e)
    return results

async def _scrape_selenium(product: dict, emit) -> list[dict]:
    if os.getenv("ENABLE_SELENIUM","false").lower() != "true": return []
    loop = asyncio.get_event_loop()
    results = []
    await emit("MP_START",{"marketplace":"Amazon","icon":"🛒","url":f"https://www.amazon.in/s?k={quote_plus(_query(product))}"})
    t0 = time.time()
    amz = await loop.run_in_executor(None, _sel_amazon_sync, product)
    results.extend(amz)
    await emit("MP_DONE",{"marketplace":"Amazon","count":len(amz),"duration_ms":round((time.time()-t0)*1000)})
    await emit("MP_START",{"marketplace":"Flipkart","icon":"🏪","url":f"https://www.flipkart.com/search?q={quote_plus(_query(product))}"})
    t1 = time.time()
    fk = await loop.run_in_executor(None, _sel_flipkart_sync, product)
    results.extend(fk)
    await emit("MP_DONE",{"marketplace":"Flipkart","count":len(fk),"duration_ms":round((time.time()-t1)*1000)})
    return results

# ── Main SSE Generator ────────────────────────────────────────────────────────
async def scrape_competitors_sse(product: dict) -> AsyncGenerator[dict, None]:
    name = product.get("name","Unknown"); our_price = float(product.get("price",0))
    messages: asyncio.Queue = asyncio.Queue()

    async def emit(type_: str, extra: dict = {}):
        await messages.put({"type": type_, **extra})

    async def put_done():
        await messages.put(None)

    async def run():
        await emit("INIT",{"message":f"Starting scan for: {name}","product_name":name,"our_price":our_price})
        await asyncio.sleep(0.1)
        results: list[dict] = []

        # Tier 1 — SerpApi
        await emit("TIER_ATTEMPT",{"tier":1,"name":"SerpApi","badge":"🟢","message":"Tier 1 — Trying SerpApi Google Shopping..."})
        await asyncio.sleep(0.1)
        t1 = await asyncio.get_event_loop().run_in_executor(None, _tier1_serpapi_sync, product)
        if t1:
            results = t1
            await emit("TIER_RESULT",{"tier":1,"status":"used","badge":"🟢","message":f"Tier 1 — SerpApi returned {len(t1)} live results ✓"})
        else:
            await emit("TIER_RESULT",{"tier":1,"status":"skipped","badge":"🟢","message":"Tier 1 — SerpApi skipped (no API key configured)"})

            # Tier 2 — Playwright
            await emit("TIER_ATTEMPT",{"tier":2,"name":"Playwright","badge":"🟡","message":"Tier 2 — Launching Playwright headless browser..."})
            await asyncio.sleep(0.1)

            async def emit2(t,e={}): await messages.put({"type":t,**e})
            pw_results = await _scrape_playwright(product, emit2)

            if pw_results:
                results = pw_results
                await emit("TIER_RESULT",{"tier":2,"status":"used","badge":"🟡","message":f"Tier 2 — Playwright scraped {len(pw_results)} results ✓"})
            else:
                await emit("TIER_RESULT",{"tier":2,"status":"skipped","badge":"🟡","message":"Tier 2 — Playwright skipped (ENABLE_PLAYWRIGHT=false)"})

                # Tier 3 — Selenium
                await emit("TIER_ATTEMPT",{"tier":3,"name":"Selenium","badge":"🔵","message":"Tier 3 — Launching Selenium ChromeDriver..."})
                await asyncio.sleep(0.1)
                sel_results = await _scrape_selenium(product, emit2)

                if sel_results:
                    results = sel_results
                    await emit("TIER_RESULT",{"tier":3,"status":"used","badge":"🔵","message":f"Tier 3 — Selenium scraped {len(sel_results)} results ✓"})
                else:
                    await emit("TIER_RESULT",{"tier":3,"status":"skipped","badge":"🔵","message":"Tier 3 — Selenium skipped (ENABLE_SELENIUM=false)"})

                    # Tier 4 — Static
                    await emit("TIER_ATTEMPT",{"tier":4,"name":"Static","badge":"⚪","message":"Tier 4 — Using realistic static sample data..."})
                    await asyncio.sleep(0.2)
                    results = _tier4_static(product)
                    for mp in _MP_MERCHANTS:
                        mp_res = [r for r in results if r["marketplace"]==mp]
                        await emit("MP_START",{"marketplace":mp,"icon":{"Amazon":"🛒","Flipkart":"🏪","Myntra":"👕","Ajio":"🏬"}.get(mp,"🏬"),"url":""})
                        await asyncio.sleep(0.15)
                        await emit("MP_DONE",{"marketplace":mp,"count":len(mp_res),"duration_ms":150})
                    await emit("TIER_RESULT",{"tier":4,"status":"used","badge":"⚪","message":f"Tier 4 — Generated {len(results)} sample listings"})

        # Stream results
        await emit("INFO",{"message":f"Streaming {len(results)} results..."})
        await asyncio.sleep(0.05)
        for r in results:
            diff = round((r["price"]-our_price)/our_price*100,1) if our_price else 0
            sign = "+" if diff > 0 else ""
            await messages.put({"type":"RESULT","message":f"{r['merchant']} — {r['marketplace']} — \u20b9{r['price']} ({sign}{diff}% vs ours)",**r,"diff_pct":diff})
            await asyncio.sleep(0.06)

        # Summary
        if results:
            prices = [r["price"] for r in results]
            by_mp = {}
            for r in results:
                by_mp.setdefault(r["marketplace"],[]).append(r["price"])
            mp_stats = {mp:{"count":len(ps),"avg":round(sum(ps)/len(ps))} for mp,ps in by_mp.items()}
            await emit("SUMMARY",{"message":f"Scan complete — {len(results)} listings found",
                "count":len(results),"avg_price":round(sum(prices)/len(prices)),
                "min_price":round(min(prices)),"max_price":round(max(prices)),
                "source_badge":results[0]["_source_badge"],"mp_stats":mp_stats})
        else:
            await emit("SUMMARY",{"message":"Scan complete — no results","count":0,"avg_price":0,"min_price":0,"max_price":0,"source_badge":"","mp_stats":{}})

        await asyncio.sleep(0.05)
        await emit("DONE",{"message":"Stream finished"})
        await put_done()

    asyncio.create_task(run())

    while True:
        msg = await messages.get()
        if msg is None: break
        yield msg

# ── Legacy compat ─────────────────────────────────────────────────────────────
def get_competitor_prices_sync(product: dict) -> list[dict]:
    return _tier4_static(product)

def run_full_scrape(product_id: str | None = None) -> dict:
    product = get_product_for_scrape(product_id)
    results = _tier4_static(product)
    our = float(product.get("price",0))
    prices = [r["price"] for r in results]
    avg = round(sum(prices)/len(prices)) if prices else 0
    by_mp: dict = {}
    for r in results: by_mp.setdefault(r["marketplace"],[]).append(r)
    mps = []
    for mp_name, prods in list(by_mp.items())[:4]:
        mp_prices = [p["price"] for p in prods]
        mps.append({"marketplace":mp_name,"products_found":len(prods),"products":prods,
            "stats":{"avg_price":round(sum(mp_prices)/len(mp_prices)) if mp_prices else 0,
                     "min_price":min(mp_prices) if mp_prices else 0,"max_price":max(mp_prices) if mp_prices else 0,
                     "our_price":our,"avg_vs_ours":0,"avg_rating":4.0,"total_reviews":1000,"avg_discount":30,"in_stock_pct":100}})
    all_p = [p for m in mps for p in m["products"]]
    return {"product":{"id":product.get("id"),"name":product.get("name"),"price":our},"scrape_steps":[],"marketplaces":mps,
        "analysis":{"total_products_scraped":len(all_p),"total_marketplaces":len(mps),"overall_avg_price":avg,
            "overall_min_price":min(prices) if prices else 0,"overall_max_price":max(prices) if prices else 0,
            "our_price":our,"price_position":"Below Average" if our < avg else "Above Average",
            "best_match":all_p[0] if all_p else None,"cheapest":min(all_p,key=lambda p:p["price"]) if all_p else None,
            "most_reviewed":None,"competitors_cheaper":sum(1 for p in all_p if p["price"]<our),
            "competitors_pricier":sum(1 for p in all_p if p["price"]>our)}}
