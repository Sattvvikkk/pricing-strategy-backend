"""Competitor Reaction API route.

GET /api/competitor-reaction/{product_id}
    Predicts what competitors may do next based on competitor price history,
    stock status, and promotion patterns. Returns per-platform price-drop
    probability, predicted sale periods, market aggression score, and a
    recommended response.
"""
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import CompetitorData
from services.product_catalog import get_product
from services.competitor_reaction_model import predict_competitor_reactions

router = APIRouter(prefix="/api/competitor-reaction", tags=["Competitor Reaction"])


@router.get("/{product_id}")
def get_competitor_reaction(product_id: str, db: Session = Depends(get_db)):
    """Return competitor reaction prediction bundle for a product."""
    product = get_product(product_id)
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    comp_q = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    comp_df = pd.read_sql(comp_q.statement, db.bind)

    bundle = predict_competitor_reactions(comp_df, product)
    bundle["product_id"] = product_id
    bundle["product_name"] = product.get("name", product_id)
    return bundle
