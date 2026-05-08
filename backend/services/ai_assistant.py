"""
AI Assistant — Gemini-first chat service for the pricing copilot.

Tier order (first available wins):
  1. Gemini (if GEMINI_API_KEY set)        — free tier on AI Studio
  2. Groq llama (if GROQ_API_KEY set)      — already wired into the project
  3. Deterministic fallback (always works) — pulls answers from the
     ML orchestrator + product context, so the chatbot stays useful even
     when no key is configured ("demo mode").

The assistant is designed to *explain* and *summarize* — it never makes
the final pricing decision (that stays with the engine).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GEMINI_MODEL = "gemini-2.0-flash"  # fast + free tier eligible
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = (
    "You are a senior pricing strategist for a fashion retailer. "
    "You analyze product data, ML predictions, competitor intelligence, and "
    "inventory state to answer business questions in clear, concise language. "
    "Always ground your answers in the numbers provided in the context. "
    "Do not invent data. Keep responses to 4–6 sentences unless the user asks "
    "for a deeper breakdown. Never recommend a final price by yourself — "
    "explain trade-offs instead. Use Indian Rupees (₹) when discussing prices."
)


# ── Mode detection ──────────────────────────────────────────────────────────


def get_mode() -> str:
    if GEMINI_API_KEY and not GEMINI_API_KEY.lower().startswith("your"):
        return "gemini"
    if GROQ_API_KEY and not GROQ_API_KEY.lower().startswith("gsk_your"):
        return "groq"
    return "demo"


# ── Provider implementations ────────────────────────────────────────────────


def _ask_gemini(question: str, context: Dict[str, Any]) -> Optional[str]:
    """Call Gemini API. Returns None on failure so caller can fall back."""
    try:
        body = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{
                "role": "user",
                "parts": [{
                    "text": f"Context (JSON):\n{json.dumps(context, indent=2)}\n\nQuestion: {question}"
                }]
            }],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 380,
            },
        }
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                GEMINI_URL,
                headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
                json=body,
            )
            if r.status_code != 200:
                logger.warning("Gemini %s: %s", r.status_code, r.text[:200])
                return None
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:  # noqa: BLE001
        logger.warning("Gemini call failed: %s", e)
        return None


def _ask_groq(question: str, context: Dict[str, Any]) -> Optional[str]:
    """Fallback to Groq llama if Gemini unavailable."""
    try:
        body = {
            "model": GROQ_MODEL,
            "max_tokens": 380,
            "temperature": 0.4,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Context:\n{json.dumps(context, indent=2)}\n\nQuestion: {question}"},
            ],
        }
        with httpx.Client(timeout=15.0) as client:
            r = client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json=body,
            )
            if r.status_code != 200:
                logger.warning("Groq %s: %s", r.status_code, r.text[:200])
                return None
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:  # noqa: BLE001
        logger.warning("Groq call failed: %s", e)
        return None


# ── Demo-mode (deterministic) responses ────────────────────────────────────


def _ask_demo(question: str, context: Dict[str, Any]) -> str:
    """Deterministic fallback — answers from ML output / product fields."""
    q = question.lower()
    p = context.get("product", {})
    ml = context.get("ml", {})

    name = p.get("name", "this product")
    current = p.get("current_price", 0)
    margin = p.get("gross_margin_pct", 0)
    risk = p.get("risk_flag", "Unknown")
    sales = p.get("sales_30d", 0)
    rec = ml.get("recommended_action", {})
    insights = ml.get("insights") or p.get("recommendation") or []

    if any(k in q for k in ["why", "explain", "rationale"]):
        if rec:
            return (
                f"For {name}, the engine recommends \"{rec.get('action', 'hold price')}\" "
                f"(target ₹{rec.get('recommended_price', current)}). "
                f"{rec.get('rationale', 'No rationale available.')} "
                f"Expected revenue impact: {rec.get('expected_revenue_change_pct', 0):+.1f}%, "
                f"margin impact: {rec.get('expected_margin_change_pct', 0):+.1f}%."
            )
        return f"{name} currently retails at ₹{current} with a {margin:.1f}% gross margin and a {risk.lower()} risk flag."

    if any(k in q for k in ["forecast", "demand", "predict"]):
        f = ml.get("forecast", {})
        return (
            f"Demand forecast for {name}: {f.get('7d', 0)} units in 7d, "
            f"{f.get('30d', 0)} in 30d, {f.get('90d', 0)} in 90d. "
            f"Daily velocity is ~{f.get('daily_velocity', 0):.1f} units."
        )

    if any(k in q for k in ["competitor", "market"]):
        comp = ml.get("competitor_response", {})
        return (
            f"Competitor avg is ₹{comp.get('competitor_avg_price', 0):.0f} across "
            f"{comp.get('competitor_count', 0)} listings. Reaction probability: "
            f"{int(comp.get('reaction_probability', 0) * 100)}%. Expected response window: "
            f"{comp.get('expected_response_days', 14)} days."
        )

    if any(k in q for k in ["risk", "stockout", "inventory"]):
        inv = ml.get("inventory_risk", {})
        return (
            f"Inventory risk: {inv.get('urgency', 'Unknown')}. "
            f"Stockout probability {int(inv.get('stockout_probability', 0) * 100)}%, "
            f"overstock probability {int(inv.get('overstock_probability', 0) * 100)}%. "
            f"Days of cover: {inv.get('days_of_cover', 0):.0f}."
        )

    if any(k in q for k in ["margin", "profit", "cost"]):
        return (
            f"{name} sells at ₹{current} against a cost of ₹{p.get('cost_price', 0)}, "
            f"giving a {margin:.1f}% gross margin. "
            f"Breakdown: {', '.join(f'{k} ₹{v}' for k, v in (p.get('cost_breakup') or {}).items())}."
        )

    # Default: top insight
    if insights and isinstance(insights, list):
        return f"Top insight for {name}: {insights[0]}"
    return (
        f"{name} is currently priced at ₹{current} with {margin:.1f}% margin. "
        f"Risk flag: {risk}. Last 30d sales: {sales} units. "
        f"Ask me about forecasts, competitors, margins, risks, or strategy."
    )


# ── Public API ──────────────────────────────────────────────────────────────


def chat(question: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Answer a question grounded in product+ML context."""
    ctx = context or {}
    mode = get_mode()

    if mode == "gemini":
        answer = _ask_gemini(question, ctx)
        if answer:
            return {"answer": answer, "provider": "gemini", "model": GEMINI_MODEL}
        # fall through to groq
        mode = "groq" if GROQ_API_KEY else "demo"

    if mode == "groq":
        answer = _ask_groq(question, ctx)
        if answer:
            return {"answer": answer, "provider": "groq", "model": GROQ_MODEL}
        mode = "demo"

    return {"answer": _ask_demo(question, ctx), "provider": "demo", "model": "deterministic"}


def suggest_questions(product: Dict[str, Any]) -> List[str]:
    """Generate context-aware suggested prompts."""
    if not product:
        return [
            "Which products have the highest revenue impact opportunity?",
            "Where is my inventory most at risk?",
        ]
    name = product.get("name", "this product")
    return [
        f"Why is the recommended price ₹{product.get('current_price', 0)}?",
        f"What is the demand forecast for {name}?",
        "How are competitors priced?",
        "What's the biggest risk on this SKU right now?",
        "Which strategy maximizes margin for the next 30 days?",
    ]
