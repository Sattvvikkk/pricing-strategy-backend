"""Four-tier competitor price fetcher.
Tier 1 — SerpApi        (SERPAPI_KEY set)
Tier 2 — Playwright     (ENABLE_PLAYWRIGHT=true)
Tier 3 — Selenium       (ENABLE_SELENIUM=true)
Tier 4 — Static fallback (always works)
"""
from __future__ import annotations
import asyncio, logging, os, random, time
from typing import AsyncGenerator
from urllib.parse import quote_plus
import httpx
from services.product_catalog import get_product_by_id, DEFAULT_PRODUCTS

logger = logging.getLogger(__name__)

# ── Static data ──────────────────────────────────────────────────────────────
_RANGES = {"T-Shirts":(499,1799),"Jeans":(1499,3999),"Dresses":(999,3499),"Jackets":(1999,6999)}
_TITLES = {
    "T-Shirts":["Men's Classic Cotton Crew-Neck Tee","Solid Regular Fit Half-Sleeve Tee","Premium Combed Cotton T-Shirt","Relaxed Fit Plain Tee","Everyday Essential Round-Neck T-Shirt"],
    "Jeans":["Slim-Fit Stretch Denim Jeans","Classic Mid-Rise Tapered Jeans","Relaxed Fit Dark-Wash Jeans","Skinny Jeans Slight Stretch","Regular Fit Cotton Denim"],
    "Dresses":["Floral Wrap Midi Dress","Solid A-Line Knee-Length Dress","Casual Fit-and-Flare Summer Dress","Shirt Dress with Belt","Linen Sleeveless Midi Dress"],
    "Jackets":["Lightweight Bomber Jacket","Classic Denim Jacket","Quilted Puffer Jacket","Slim-Fit Blazer","Hooded Windbreaker"],
}
_MP_MERCHANTS = {
    "Amazon":   ["H&M India","Campus Sutra","Bewakoof","Roadster","Urbanic"],
    "Flipkart": ["HRX by Hrithik","Allen Solly","Van Heusen","Arrow","Puma"],
    "Myntra":   ["Nike India","Adidas","Levis India","US Polo","Jack & Jones"],
    "Ajio":     ["Ajio Label","Flying Machine","Peter England","Raymond","ColorPlus"],
}

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

def _merchant_to_mp(m: str) -> str:
    m = m.lower()
    if "amazon" in m: return "Amazon"
    if "flipkart" in m: return "Flipkart"
    if "myntra" in m: return "Myntra"
    if "ajio" in m: return "Ajio"
    return "Google Shopping"

# ── Tier 4: Static ────────────────────────────────────────────────────────────
def _tier4_static(product: dict) -> list[dict]:
    cat = product.get("category","T-Shirts")
    lo, hi = _RANGES.get(cat,(499,2999))
    titles = _TITLES.get(cat,_TITLES["T-Shirts"])
    rng = random.Random(abs(hash(product.get("id","x"))))
    results = []
    for mp, merchants in _MP_MERCHANTS.items():
        for _ in range(rng.randint(3,5)):
            m = rng.choice(merchants); t = rng.choice(titles)
            p = round(rng.uniform(lo,hi),-1); op = round(p*rng.uniform(1.1,1.4),-1)
            results.append({"marketplace":mp,"title":f"{m} — {t}","price":float(p),
                "original_price":float(op),"discount":round((op-p)/op*100),
                "rating":round(rng.uniform(3.5,4.8),1),"review_count":rng.randint(50,8000),
                "merchant":m,"link":"","_source_tier":4,"_source_badge":"⚪ SAMPLE DATA"})
    return results

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
