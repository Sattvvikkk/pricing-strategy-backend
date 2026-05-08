"""
Dynamic Pricing Engine routes
=============================
POST /api/pricing/optimize        — produce one final price decision
POST /api/pricing/override        — manual override (audit-tracked)
GET  /api/pricing/audit           — most recent decisions (optional product filter)
GET  /api/pricing/audit/{product_id}
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory, CompetitorData
from services.product_catalog import get_product_by_id
from services.product_enrichment import enrich_product
from services.ml_orchestrator import run_analysis as ml_run_analysis
from services.dynamic_pricing_engine import (
    optimize,
    apply_override,
    get_audit_log,
)

router = APIRouter(prefix="/api/pricing", tags=["Dynamic Pricing Engine"])


class OptimizeRequest(BaseModel):
    product_id: str
    constraints: Optional[Dict[str, Any]] = None


class OverrideRequest(BaseModel):
    product_id: str
    new_price: float
    actor: Optional[str] = "user"
    note: Optional[str] = ""


def _load_context(product_id: str, db: Session):
    base = get_product_by_id(product_id)
    if not base:
        raise HTTPException(status_code=404, detail="Product not found")

    enriched = enrich_product(base)
    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)
    if not sales_df.empty:
        sales_df["date"] = pd.to_datetime(sales_df["date"]).dt.strftime("%Y-%m-%d")
    comp_q = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    comp_df = pd.read_sql(comp_q.statement, db.bind)

    ml_output = ml_run_analysis(enriched, sales_df=sales_df, comp_df=comp_df)
    return enriched, ml_output


@router.post("/optimize")
def pricing_optimize(req: OptimizeRequest, db: Session = Depends(get_db)):
    """Run the full intelligence stack and produce a single final price decision."""
    enriched, ml_output = _load_context(req.product_id, db)
    return optimize(enriched, ml_output, constraints=req.constraints)


@router.get("/optimize/{product_id}")
def pricing_optimize_get(product_id: str, db: Session = Depends(get_db)):
    """GET variant for easy frontend fetching with default constraints."""
    enriched, ml_output = _load_context(product_id, db)
    return optimize(enriched, ml_output, constraints=None)


@router.post("/override")
def pricing_override(req: OverrideRequest, db: Session = Depends(get_db)):
    """Record a manual price override in the audit log."""
    base = get_product_by_id(req.product_id)
    if not base:
        raise HTTPException(status_code=404, detail="Product not found")
    enriched = enrich_product(base)
    return apply_override(enriched, req.new_price, actor=req.actor or "user", note=req.note or "")


@router.get("/audit")
def get_global_audit(limit: int = 50):
    return {"entries": get_audit_log(product_id=None, limit=limit)}


@router.get("/audit/{product_id}")
def get_product_audit(product_id: str, limit: int = 50):
    return {"entries": get_audit_log(product_id=product_id, limit=limit)}
