"""LLM Explainer — calls Groq API to generate 3-sentence pricing rationale.

generate_llm_rationale(
    archetype, product_name, current_price, recommended_price,
    comp_avg, elasticity, risk_flags, confidence
) → str

Falls back to a template string if the API call fails for any reason.
"""
import os
import httpx
from typing import List, Dict, Any


_GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_MODEL = "llama-3.3-70b-versatile"

_SYSTEM_PROMPT = (
    "You are a senior pricing analyst at a fashion retail consultancy. "
    "You write concise, data-driven pricing recommendations in plain English. "
    "Never use jargon. Always reference specific numbers. "
    "Write in present tense. Be direct."
)


def _build_user_prompt(
    archetype: str,
    product_name: str,
    current_price: float,
    recommended_price: float,
    comp_avg: float,
    elasticity: float,
    risk_flags: List[Dict[str, Any]],
    confidence: float,
) -> str:
    price_direction = "up" if recommended_price > current_price else "down"
    change_pct      = abs((recommended_price - current_price) / current_price * 100)

    flags_text = ""
    if risk_flags:
        messages = [f["message"] for f in risk_flags]
        flags_text = f" Risk flags to mention: {'; '.join(messages)}."

    return (
        f"Product: {product_name}\n"
        f"Current price: ₹{current_price:.0f}\n"
        f"Recommended price: ₹{recommended_price:.0f} "
        f"({price_direction} {change_pct:.1f}%)\n"
        f"Strategy archetype: {archetype}\n"
        f"Competitor average price: ₹{comp_avg:.0f}\n"
        f"Price elasticity of demand: {elasticity:.2f}\n"
        f"Model confidence: {confidence:.0f}%\n"
        f"{flags_text}\n\n"
        "Write exactly 3 sentences.\n"
        "Sentence 1: State what the recommendation is and what market signal drives it.\n"
        "Sentence 2: Explain what the key data point is (elasticity, competitor position, "
        "or stock situation).\n"
        "Sentence 3: State the expected outcome in quantified terms. "
        "If any risk flags exist, incorporate them in sentence 3."
    )


def _fallback_rationale(
    archetype: str,
    product_name: str,
    current_price: float,
    recommended_price: float,
    comp_avg: float,
    elasticity: float,
    confidence: float,
) -> str:
    direction = "increase" if recommended_price > current_price else "decrease"
    change_pct = abs((recommended_price - current_price) / current_price * 100)
    archetype_readable = archetype.replace("_", " ").title()

    return (
        f"The {archetype_readable} strategy recommends a price {direction} "
        f"from ₹{current_price:.0f} to ₹{recommended_price:.0f} "
        f"({change_pct:.1f}%), driven by the current market position relative to "
        f"the competitor average of ₹{comp_avg:.0f}. "
        f"With a price elasticity of {elasticity:.2f}, demand is "
        f"{'highly sensitive' if abs(elasticity) > 1.5 else 'moderately responsive'} "
        f"to price changes, making precision pricing critical. "
        f"At {confidence:.0f}% model confidence, this recommendation is expected to "
        f"optimise revenue while maintaining competitive positioning in the market."
    )


def generate_llm_rationale(
    archetype: str,
    product_name: str,
    current_price: float,
    recommended_price: float,
    comp_avg: float,
    elasticity: float,
    risk_flags: List[Dict[str, Any]],
    confidence: float,
) -> str:
    """
    Call the Groq API for a 3-sentence pricing rationale.
    Returns a fallback template string if the API call fails.
    """
    api_key = os.getenv("GROQ_API_KEY", "")

    # If no valid API key configured, go straight to fallback
    if not api_key or api_key.startswith("gsk_your"):
        return _fallback_rationale(
            archetype, product_name, current_price, recommended_price,
            comp_avg, elasticity, confidence,
        )

    user_prompt = _build_user_prompt(
        archetype, product_name, current_price, recommended_price,
        comp_avg, elasticity, risk_flags, confidence,
    )

    payload = {
        "model":       _GROQ_MODEL,
        "max_tokens":  220,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                _GROQ_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()
            if text:
                return text
    except Exception:
        pass  # Fall through to template fallback

    return _fallback_rationale(
        archetype, product_name, current_price, recommended_price,
        comp_avg, elasticity, confidence,
    )
