"""Marketplace API routes.

GET /api/marketplace/{product_id}         — aggregated competitor data for a product
GET /api/marketplace/{product_id}/prices  — flat list of competitor prices
GET /api/marketplace/{product_id}/comparison — per-marketplace comparison stats
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import CompetitorData
from services.product_catalog import get_product_by_id
from services.scraper_engine import get_competitor_prices_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])


def _ensure_data(product_id: str, db: Session) -> list[CompetitorData]:
    """
    Return fresh competitor rows from DB (last 48 h).
    If none exist, fall back to static data and persist it.
    """
    cutoff = datetime.utcnow() - timedelta(hours=48)
    rows = (
        db.query(CompetitorData)
        .filter(CompetitorData.product_id == product_id)
        .filter(CompetitorData.scraped_at >= cutoff)
        .order_by(CompetitorData.scraped_at.desc())
        .all()
    )
    if rows:
        return rows

    # Fallback — seed static data so the page isn't empty
    product = get_product_by_id(product_id)
    if not product:
        return []

    static = get_competitor_prices_sync(product)
    for item in static:
        db.add(CompetitorData(
            product_id=product_id,
            platform=item.get("marketplace", "Unknown"),
            price=float(item.get("price", 0)),
            title=item.get("title", ""),
            merchant=item.get("merchant", ""),
            link=item.get("link", ""),
        ))
    try:
        db.commit()
    except Exception:
        db.rollback()

    return (
        db.query(CompetitorData)
        .filter(CompetitorData.product_id == product_id)
        .order_by(CompetitorData.scraped_at.desc())
        .all()
    )


# ── GET /{product_id} ─────────────────────────────────────────────────────────

@router.get("/{product_id}")
def get_marketplace(product_id: str, db: Session = Depends(get_db)):
    """Full marketplace overview — prices + per-platform comparison stats."""
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")

    our_price = float(product.get("price", 0))
    rows = _ensure_data(product_id, db)

    if not rows:
        return {
            "product_id": product_id,
            "product_name": product.get("name"),
            "our_price": our_price,
            "prices": [],
            "comparison": [],
            "total": 0,
        }

    prices_out = []
    for r in rows:
        diff = round(r.price - our_price, 2)
        prices_out.append({
            "id": r.id,
            "marketplace": r.platform,
            "brand": r.merchant or "",
            "title": r.title or "",
            "price": round(r.price, 2),
            "discount": 0,
            "rating": None,
            "vs_ours": diff,
            "link": r.link or "",
            "scraped_at": r.scraped_at.isoformat() if r.scraped_at else None,
        })

    # Per-marketplace stats
    by_mp: dict[str, list[float]] = {}
    for r in rows:
        by_mp.setdefault(r.platform, []).append(r.price)

    comparison = []
    for mp, mp_prices in by_mp.items():
        arr = np.array(mp_prices)
        comparison.append({
            "marketplace": mp,
            "avg_price": round(float(np.mean(arr)), 2),
            "min_price": round(float(np.min(arr)), 2),
            "max_price": round(float(np.max(arr)), 2),
            "count": len(mp_prices),
            "cheaper_than_us": int(np.sum(arr < our_price)),
            "pricier_than_us": int(np.sum(arr > our_price)),
        })

    comparison.sort(key=lambda x: x["marketplace"])

    return {
        "product_id": product_id,
        "product_name": product.get("name"),
        "our_price": our_price,
        "prices": prices_out,
        "comparison": comparison,
        "total": len(prices_out),
        "last_updated": rows[0].scraped_at.isoformat() if rows else None,
    }
