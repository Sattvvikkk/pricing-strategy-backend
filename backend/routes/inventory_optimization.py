"""Inventory Optimization API route.

GET /api/inventory-optimization/{product_id}
    AI suggests restock timing, markdown timing, clearance pricing,
    and warehouse balancing for a product.
"""
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory
from services.product_catalog import get_product
from services.inventory_optimization import optimize_inventory

router = APIRouter(prefix="/api/inventory-optimization", tags=["Inventory Optimization"])


@router.get("/{product_id}")
def get_inventory_optimization(product_id: str, db: Session = Depends(get_db)):
    """Return inventory optimization bundle for a product."""
    product = get_product(product_id)
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)

    bundle = optimize_inventory(sales_df, product)
    bundle["product_id"] = product_id
    bundle["product_name"] = product.get("name", product_id)
    return bundle
