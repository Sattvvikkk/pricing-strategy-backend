"""
AI Chat route — Gemini-first conversational copilot.

POST /api/ai/chat
GET  /api/ai/mode
GET  /api/ai/suggestions/{product_id}
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import SalesHistory, CompetitorData
from services.product_catalog import get_product_by_id
from services.product_enrichment import enrich_product
from services.ml_orchestrator import run_analysis as ml_run_analysis
from services.ai_assistant import chat as ai_chat, get_mode, suggest_questions

router = APIRouter(prefix="/api/ai", tags=["AI Copilot"])


class ChatRequest(BaseModel):
    question: str
    product_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None  # [{role, content}, ...]


def _build_context(product_id: Optional[str], db: Session) -> Dict[str, Any]:
    """Pull product + ML context for grounding the assistant."""
    ctx: Dict[str, Any] = {}
    if not product_id:
        return ctx

    base = get_product_by_id(product_id)
    if not base:
        return ctx
    enriched = enrich_product(base)

    sales_q = db.query(SalesHistory).filter(SalesHistory.product_id == product_id)
    sales_df = pd.read_sql(sales_q.statement, db.bind)
    if not sales_df.empty:
        sales_df["date"] = pd.to_datetime(sales_df["date"]).dt.strftime("%Y-%m-%d")
    comp_q = db.query(CompetitorData).filter(CompetitorData.product_id == product_id)
    comp_df = pd.read_sql(comp_q.statement, db.bind)

    try:
        ml = ml_run_analysis(enriched, sales_df=sales_df, comp_df=comp_df)
    except Exception:
        ml = {}

    # Trim to keep prompt small
    ctx["product"] = {
        "id": enriched.get("id"),
        "name": enriched.get("name"),
        "category": enriched.get("category"),
        "current_price": enriched.get("current_price"),
        "cost_price": enriched.get("cost_price"),
        "gross_margin_pct": enriched.get("gross_margin_pct"),
        "stock_on_hand": enriched.get("stock_on_hand"),
        "sales_30d": enriched.get("sales_30d"),
        "revenue_30d": enriched.get("revenue_30d"),
        "competitor_avg_price": enriched.get("competitor_avg_price"),
        "price_index": enriched.get("price_index"),
        "demand_trend": enriched.get("demand_trend"),
        "risk_flag": enriched.get("risk_flag"),
        "recommendation": enriched.get("recommendation"),
        "cost_breakup": enriched.get("cost_breakup"),
    }
    ctx["ml"] = {
        "forecast": ml.get("forecast"),
        "elasticity_score": ml.get("elasticity_score"),
        "recommended_price_band": ml.get("recommended_price_band"),
        "competitor_response": ml.get("competitor_response"),
        "inventory_risk": ml.get("inventory_risk"),
        "insights": ml.get("insights"),
        "recommended_action": ml.get("recommended_action"),
        "confidence_score": ml.get("confidence_score"),
    }
    return ctx


@router.post("/chat")
def chat_endpoint(req: ChatRequest, db: Session = Depends(get_db)):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    context = _build_context(req.product_id, db)
    result = ai_chat(req.question.strip(), context=context)
    return {
        **result,
        "product_id": req.product_id,
        "context_keys": list(context.keys()),
    }


@router.get("/mode")
def get_chat_mode():
    """Reports which provider tier the assistant is using."""
    mode = get_mode()
    return {
        "mode": mode,
        "label": {
            "gemini": "Gemini · Live",
            "groq": "Groq Llama · Live",
            "demo": "Demo mode (no API key)",
        }[mode],
        "is_live": mode != "demo",
    }


@router.get("/suggestions/{product_id}")
def get_suggestions(product_id: str):
    base = get_product_by_id(product_id)
    if not base:
        return {"suggestions": suggest_questions(None)}
    enriched = enrich_product(base)
    return {"suggestions": suggest_questions(enriched), "product_id": product_id}


@router.get("/suggestions")
def get_global_suggestions():
    return {"suggestions": suggest_questions(None)}
