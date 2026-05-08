"""Products API routes — catalog, detail, and URL lookup.
Spec endpoints:
  GET  /api/products
  GET  /api/products/{product_id}
  POST /api/products/lookup-url
  GET  /api/products/{product_id}/sales-history
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory
from services.product_catalog import (
    get_all_products,
    get_product_by_id,
    get_products_by_category,
)
from services.product_enrichment import enrich_product

router = APIRouter(prefix="/api/products", tags=["Products"])


class ProductURLRequest(BaseModel):
    url: str


@router.get("")
def list_products(category: str | None = None, enriched: bool = True):
    """Return all Vouge Studio products, optionally filtered by category.

    By default returns the rich enterprise model (cost_breakup, inventory,
    engagement metrics, risk flags, etc.). Pass enriched=false to get the
    legacy slim payload.
    """
    if category:
        products = get_products_by_category(category)
    else:
        products = get_all_products()
    if enriched:
        products = [enrich_product(p) for p in products]
    return {"products": products}


@router.get("/{product_id}")
def get_product(product_id: str, enriched: bool = True):
    """Return full product details for one SKU (enriched by default)."""
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if enriched:
        product = enrich_product(product)
    return {"product": product}


@router.post("/lookup-url")
def lookup_by_url(req: ProductURLRequest):
    """Search the catalog for a product whose name or brand appears in the URL."""
    url_lower = req.url.lower()
    for product in get_all_products():
        # Match by product name words in URL
        name_words = product["name"].lower().split()
        if any(word in url_lower for word in name_words if len(word) > 3):
            return {"product": product}
        # Match by SKU
        if product["sku"].lower() in url_lower:
            return {"product": product}
        # Match by brand
        if product["brand"].lower() in url_lower:
            return {"product": product}
    raise HTTPException(status_code=404, detail="Could not match product for this URL")


@router.get("/{product_id}/sales-history")
def get_sales_history(product_id: str, db: Session = Depends(get_db)):
    """Return 90-day sales history for a product."""
    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales = sales_q.order_by(SalesHistory.date.desc()).limit(90).all()
    
    if not sales:
        return {"data": []}
    
    data = []
    for sale in sales:
        data.append({
            "date": sale.date.strftime("%Y-%m-%d") if sale.date else None,
            "price": float(sale.price),
            "units_sold": int(sale.units_sold),
            "revenue": float(sale.revenue),
        })
    
    # Reverse to show oldest first
    return {"data": list(reversed(data))}
