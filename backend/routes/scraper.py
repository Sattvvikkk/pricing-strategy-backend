"""Scraper API routes — SSE streaming + DB-backed results."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models import CompetitorData
from services.scraper_engine import (
    get_product_for_scrape,
    get_competitor_prices_sync,
    scrape_competitors_sse,
)
from services.product_catalog import get_product_by_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scraper", tags=["Scraper"])


# ── SSE stream endpoint ───────────────────────────────────────────────────────

@router.get("/stream/{product_id}")
async def stream_scrape(product_id: str, db: Session = Depends(get_db)):
    """
    SSE endpoint — streams live scraping progress for a product.
    After the stream finishes, all RESULT messages are persisted to DB.
    """
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")

    collected_results: list[dict] = []

    async def event_generator():
        nonlocal collected_results

        async for msg in scrape_competitors_sse(product):
            # Collect RESULT messages for DB persistence
            if msg["type"] == "RESULT":
                collected_results.append(msg)

            yield f"data: {json.dumps(msg)}\n\n"

            # After DONE, persist results to DB
            if msg["type"] == "DONE" and collected_results:
                try:
                    now = datetime.now(timezone.utc).replace(tzinfo=None)
                    for r in collected_results:
                        db.add(CompetitorData(
                            product_id=product_id,
                            platform=r.get("merchant", "Unknown"),
                            price=float(r["price"]),
                            title=r.get("title", ""),
                            merchant=r.get("merchant", ""),
                            link=r.get("link", ""),
                            scraped_at=now,
                        ))
                    db.commit()
                    logger.info(
                        "Saved %d competitor records for %s",
                        len(collected_results), product_id,
                    )
                except Exception as exc:
                    logger.error("DB persist failed: %s", exc)
                    db.rollback()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "Connection":       "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Cached results endpoint ───────────────────────────────────────────────────

@router.get("/results/{product_id}")
def get_scraper_results(product_id: str, db: Session = Depends(get_db)):
    """
    Return the most recent scrape batch from DB without re-scraping.
    If no DB records exist, call get_competitor_prices_sync() and return live.
    """
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")

    # Find most-recent batch by the latest scraped_at timestamp
    latest_record = (
        db.query(CompetitorData)
        .filter(CompetitorData.product_id == product_id)
        .order_by(CompetitorData.scraped_at.desc())
        .first()
    )

    if latest_record:
        # Fetch all records from the same batch (within 30s of the latest)
        from datetime import timedelta
        batch_cutoff = latest_record.scraped_at - timedelta(seconds=30)
        records = (
            db.query(CompetitorData)
            .filter(CompetitorData.product_id == product_id)
            .filter(CompetitorData.scraped_at >= batch_cutoff)
            .order_by(CompetitorData.scraped_at.desc())
            .all()
        )
        our_price = float(product.get("price", 0))
        results = []
        for r in records:
            diff_pct = round((r.price - our_price) / our_price * 100, 1) if our_price else 0
            results.append({
                "title":        r.title or "",
                "price":        r.price,
                "merchant":     r.merchant or r.platform,
                "link":         r.link or "",
                "rating":       None,
                "source_badge": "💾 Cached",
                "diff_pct":     diff_pct,
            })
        prices = [r["price"] for r in results]
        return {
            "source": "database",
            "scraped_at": latest_record.scraped_at.isoformat(),
            "count": len(results),
            "avg_price": round(sum(prices) / len(prices)) if prices else 0,
            "min_price": round(min(prices)) if prices else 0,
            "max_price": round(max(prices)) if prices else 0,
            "results": results,
        }

    # No DB records — run sync scrape and return without saving
    live = get_competitor_prices_sync(product)
    our_price = float(product.get("price", 0))
    results = []
    for r in live:
        diff_pct = round((r["price"] - our_price) / our_price * 100, 1) if our_price else 0
        results.append({
            "title":        r["title"],
            "price":        r["price"],
            "merchant":     r["merchant"],
            "link":         r.get("link", ""),
            "rating":       r.get("rating"),
            "source_badge": r["_source_badge"],
            "diff_pct":     diff_pct,
        })
    prices = [r["price"] for r in results]
    return {
        "source": "live",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(results),
        "avg_price": round(sum(prices) / len(prices)) if prices else 0,
        "min_price": round(min(prices)) if prices else 0,
        "max_price": round(max(prices)) if prices else 0,
        "results": results,
    }


# ── Legacy endpoints (kept for backward compat) ───────────────────────────────

@router.post("/run")
@router.get("/run")
def run_scrape_legacy(product_id: str = None):
    """Legacy sync scrape — returns the old run_full_scrape shape."""
    from services.scraper_engine import run_full_scrape
    return run_full_scrape(product_id)
