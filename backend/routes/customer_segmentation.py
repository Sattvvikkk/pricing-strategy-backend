"""Customer Segmentation API route.

GET /api/customer-segmentation/{product_id}
    Clusters users into premium buyers, discount seekers, loyal customers,
    and impulse shoppers using K-Means and DBSCAN. Returns per-segment
    pricing strategies and personalization insights.
"""
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory
from services.product_catalog import get_product
from services.customer_segmentation import segment_customers

router = APIRouter(prefix="/api/customer-segmentation", tags=["Customer Segmentation"])


@router.get("/{product_id}")
def get_customer_segmentation(product_id: str, db: Session = Depends(get_db)):
    """Return customer segmentation bundle for a product."""
    product = get_product(product_id)
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)

    bundle = segment_customers(sales_df, product)
    bundle["product_id"] = product_id
    bundle["product_name"] = product.get("name", product_id)
    return bundle
