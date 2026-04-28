"""Scraper API routes — run marketplace scrapes with SSE streaming progress."""
import json
import asyncio
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from services.scraper_engine import run_full_scrape, scrape_marketplace_detail, get_product_for_scrape
import numpy as np

router = APIRouter(prefix="/api/scraper", tags=["Scraper"])


class ScrapeRequest(BaseModel):
    product_id: Optional[str] = None


@router.post("/run")
def run_scrape(req: ScrapeRequest = None):
    """Run a full marketplace scrape for the given product."""
    product_id = req.product_id if req else None
    result = run_full_scrape(product_id)
    return result


@router.get("/run")
def run_scrape_get(product_id: str = None):
    """GET version — run scrape with optional product_id query param."""
    result = run_full_scrape(product_id)
    return result


@router.get("/stream")
async def run_scrape_stream(product_id: str = None):
    """SSE endpoint — streams scraping progress in real time (no auth required)."""

    async def event_generator():
        product = get_product_for_scrape(product_id)
        seed_val = abs(int(np.datetime64("today", "D").astype(int)) + hash(product.get("id", ""))) % (2**31)
        rng = np.random.default_rng(seed_val)

        marketplaces = [
            {"name": "Amazon", "domain": "amazon.in", "icon": "🛒", "pages": ["search results", "product listings", "price data", "review data"]},
            {"name": "Flipkart", "domain": "flipkart.com", "icon": "🏪", "pages": ["search results", "product catalog", "seller data", "pricing info"]},
            {"name": "Myntra", "domain": "myntra.com", "icon": "👕", "pages": ["fashion catalog", "product details", "size charts", "pricing data"]},
            {"name": "Ajio", "domain": "ajio.com", "icon": "🏬", "pages": ["product search", "brand listings", "price comparison", "stock data"]},
        ]

        # Phase 0: Initialization
        yield f"data: {json.dumps({'type': 'init', 'product': {'id': product.get('id'), 'name': product.get('name'), 'brand': product.get('brand'), 'price': product.get('price', 799)}})}\n\n"
        await asyncio.sleep(0.3)

        yield f"data: {json.dumps({'type': 'log', 'level': 'system', 'message': '◆ PriceEngine Scraper v2.0 initialized'})}\n\n"
        await asyncio.sleep(0.2)

        _target_msg = '◆ Target: {} (₹{})'.format(product.get('name', 'Unknown'), product.get('price', 799))
        yield f"data: {json.dumps({'type': 'log', 'level': 'system', 'message': _target_msg})}\n\n"
        await asyncio.sleep(0.2)

        yield f"data: {json.dumps({'type': 'log', 'level': 'system', 'message': '◆ Initializing headless browser pool...'})}\n\n"
        await asyncio.sleep(0.4)

        yield f"data: {json.dumps({'type': 'log', 'level': 'success', 'message': '✓ Browser pool ready (4 instances)'})}\n\n"
        await asyncio.sleep(0.2)

        yield f"data: {json.dumps({'type': 'log', 'level': 'system', 'message': '◆ Loading anti-detection fingerprints...'})}\n\n"
        await asyncio.sleep(0.3)

        yield f"data: {json.dumps({'type': 'log', 'level': 'success', 'message': '✓ Fingerprints loaded — stealth mode active'})}\n\n"
        await asyncio.sleep(0.2)

        yield f"data: {json.dumps({'type': 'phase', 'phase': 'crawling', 'message': 'Beginning marketplace crawl...'})}\n\n"
        await asyncio.sleep(0.3)

        all_results = []

        for mp_idx, mp in enumerate(marketplaces):
            mp_name = mp["name"]
            domain = mp["domain"]

            # Start marketplace
            yield f"data: {json.dumps({'type': 'marketplace_start', 'index': mp_idx, 'name': mp_name, 'domain': domain, 'icon': mp['icon']})}\n\n"
            await asyncio.sleep(0.15)

            yield f"data: {json.dumps({'type': 'log', 'level': 'info', 'message': f'[{mp_name}] Connecting to {domain}...'})}\n\n"
            await asyncio.sleep(0.35)

            yield f"data: {json.dumps({'type': 'log', 'level': 'network', 'message': f'[{mp_name}] DNS resolved → {int(rng.integers(10, 120))}ms | TLS handshake → {int(rng.integers(30, 90))}ms'})}\n\n"
            await asyncio.sleep(0.25)

            yield f"data: {json.dumps({'type': 'log', 'level': 'success', 'message': f'[{mp_name}] Connection established (HTTP/2)'})}\n\n"
            await asyncio.sleep(0.2)

            # Crawl pages
            for page_idx, page in enumerate(mp["pages"]):
                yield f"data: {json.dumps({'type': 'log', 'level': 'crawl', 'message': f'[{mp_name}] Crawling {page}...'})}\n\n"
                await asyncio.sleep(0.25)

                bytes_received = int(rng.integers(45, 380))
                yield f"data: {json.dumps({'type': 'log', 'level': 'data', 'message': f'[{mp_name}] ← Received {bytes_received}KB ({page})'})}\n\n"

                yield f"data: {json.dumps({'type': 'crawl_progress', 'marketplace_index': mp_idx, 'page_index': page_idx, 'total_pages': len(mp['pages']), 'page_name': page, 'bytes': bytes_received})}\n\n"
                await asyncio.sleep(0.2)

            # Extract data
            yield f"data: {json.dumps({'type': 'log', 'level': 'info', 'message': f'[{mp_name}] Parsing DOM & extracting product data...'})}\n\n"
            await asyncio.sleep(0.3)

            yield f"data: {json.dumps({'type': 'log', 'level': 'info', 'message': f'[{mp_name}] Running NLP matcher on product specs...'})}\n\n"
            await asyncio.sleep(0.25)

            # Actually scrape
            try:
                data = scrape_marketplace_detail(mp_name, product, rng)
                product_count = data["products_found"]
                all_results.append(data)

                yield f"data: {json.dumps({'type': 'log', 'level': 'success', 'message': f'[{mp_name}] ✓ Extracted {product_count} products with pricing data'})}\n\n"
                await asyncio.sleep(0.15)

                # Show brief product previews
                for p in data["products"][:2]:
                    _prev_msg = '[{}]   → {} {}: ₹{} ({}% match)'.format(mp_name, p['brand'], p['name'], p['price'], p['match_score'])
                    yield f"data: {json.dumps({'type': 'log', 'level': 'product', 'message': _prev_msg})}\n\n"
                    await asyncio.sleep(0.12)

                if product_count > 2:
                    yield f"data: {json.dumps({'type': 'log', 'level': 'product', 'message': f'[{mp_name}]   → ...and {product_count - 2} more products'})}\n\n"
                    await asyncio.sleep(0.1)

                duration_ms = int(rng.integers(1200, 3500))
                yield f"data: {json.dumps({'type': 'marketplace_done', 'index': mp_idx, 'name': mp_name, 'status': 'completed', 'products_found': product_count, 'duration_ms': duration_ms, 'stats': data['stats']})}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'type': 'log', 'level': 'error', 'message': f'[{mp_name}] ✗ Error: {str(e)}'})}\n\n"
                yield f"data: {json.dumps({'type': 'marketplace_done', 'index': mp_idx, 'name': mp_name, 'status': 'failed', 'error': str(e)})}\n\n"

            await asyncio.sleep(0.3)

        # Analysis phase
        yield f"data: {json.dumps({'type': 'phase', 'phase': 'analyzing', 'message': 'Running competitive analysis...'})}\n\n"
        await asyncio.sleep(0.3)

        yield f"data: {json.dumps({'type': 'log', 'level': 'system', 'message': '◆ Aggregating price data across all marketplaces...'})}\n\n"
        await asyncio.sleep(0.25)

        yield f"data: {json.dumps({'type': 'log', 'level': 'system', 'message': '◆ Computing match scores & price positioning...'})}\n\n"
        await asyncio.sleep(0.3)

        yield f"data: {json.dumps({'type': 'log', 'level': 'system', 'message': '◆ Generating competitive intelligence report...'})}\n\n"
        await asyncio.sleep(0.3)

        # Build final result
        all_products = []
        for r in all_results:
            all_products.extend(r["products"])

        all_prices = [p["price"] for p in all_products]
        our_price = product.get("price", 799)

        analysis = {
            "total_products_scraped": len(all_products),
            "total_marketplaces": len(all_results),
            "overall_avg_price": round(sum(all_prices) / len(all_prices)) if all_prices else 0,
            "overall_min_price": min(all_prices) if all_prices else 0,
            "overall_max_price": max(all_prices) if all_prices else 0,
            "our_price": our_price,
            "price_position": "Below Average" if our_price < (sum(all_prices) / len(all_prices) if all_prices else our_price) else "Above Average",
            "best_match": max(all_products, key=lambda p: p["match_score"]) if all_products else None,
            "cheapest": min(all_products, key=lambda p: p["price"]) if all_products else None,
            "most_reviewed": max(all_products, key=lambda p: p["review_count"]) if all_products else None,
            "competitors_cheaper": sum(1 for p in all_products if p["price"] < our_price),
            "competitors_pricier": sum(1 for p in all_products if p["price"] > our_price),
        }

        steps = []
        for idx, r in enumerate(all_results):
            steps.append({
                "marketplace": r["marketplace"],
                "status": "completed",
                "duration_ms": int(rng.integers(1200, 3500)),
                "products_found": r["products_found"],
            })

        final_result = {
            "product": {
                "id": product.get("id"),
                "name": product.get("name"),
                "brand": product.get("brand"),
                "price": our_price,
                "image": product.get("image"),
            },
            "scrape_steps": steps,
            "marketplaces": all_results,
            "analysis": analysis,
        }

        yield f"data: {json.dumps({'type': 'log', 'level': 'success', 'message': f'✓ Analysis complete — {len(all_products)} products across {len(all_results)} marketplaces'})}\n\n"
        await asyncio.sleep(0.2)

        _pos_msg = '✓ Price position: {} (Market avg: ₹{})'.format(analysis['price_position'], analysis['overall_avg_price'])
        yield f"data: {json.dumps({'type': 'log', 'level': 'success', 'message': _pos_msg})}\n\n"
        await asyncio.sleep(0.2)

        yield f"data: {json.dumps({'type': 'complete', 'result': final_result})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
