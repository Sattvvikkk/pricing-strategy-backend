"""AI Copilot routes — Natural language strategy generation.

GET /api/copilot/strategy/{product_id}
    ├─ query params: goal_type, objective (natural language)
    └─ returns: AIStrategyResponse (narrative + structured intelligence)

GET /api/copilot/insights/{product_id}
    └─ returns: AI insight cards (market risk, opportunity, trend, recommendation)

POST /api/copilot/chat
    ├─ body: { product_id, message, goal_type, conversation_history }
    └─ returns: { response, related_strategy_data, suggested_next_steps }
"""

import os
import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from services.product_catalog import get_product_by_id
from services.ai_strategy_generator import (
    BusinessGoal,
    AIStrategyResponse,
    create_orchestrator,
)
from routes.strategy import get_strategy  # reuse existing strategy logic

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/copilot", tags=["AI Copilot"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class InsightCard(BaseModel):
    """AI-generated insight card."""
    type: str  # "market_risk", "revenue_opportunity", "trend_alert", "ai_recommendation"
    title: str
    description: str
    severity: Optional[str] = None  # "CRITICAL", "WARNING", "INFO" for risks
    impact_pct: Optional[float] = None


class CopilotChatRequest(BaseModel):
    """User message to AI Copilot."""
    product_id: str
    message: str
    goal_type: str  # e.g. "maximize_profit"
    conversation_history: Optional[List[dict]] = None


class CopilotChatResponse(BaseModel):
    """AI Copilot response."""
    message: str
    related_insights: List[InsightCard]
    suggested_actions: List[str]
    confidence_score: float


class InsightCardsResponse(BaseModel):
    """Collection of insight cards for a product."""
    product_id: str
    product_name: str
    cards: List[InsightCard]
    generated_at: str


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/strategy/{product_id}")
async def generate_ai_strategy(
    product_id: str,
    goal_type: str = Query(..., description="Goal: maximize_profit, increase_revenue, etc"),
    objective: str = Query(..., description="User's objective in natural language"),
    db: Session = Depends(get_db),
):
    """
    Generate AI strategy with multi-agent analysis.
    
    Example:
        GET /api/copilot/strategy/prod_123?goal_type=maximize_profit&objective=Increase%20margin%20on%20summer%20collection
    """
    
    # Get product
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get existing strategy (reuse ML pipeline)
    try:
        strategy_response = get_strategy(product_id, db)
        strategy_data = strategy_response.model_dump()
    except Exception as e:
        logger.error(f"Failed to get strategy: {e}")
        raise HTTPException(status_code=500, detail="Strategy generation failed")
    
    # Create business goal
    goal = BusinessGoal(
        goal_type=goal_type,
        details=objective,
        constraints=[]
    )
    
    # Generate AI strategy
    try:
        orchestrator = create_orchestrator(GROQ_API_KEY)
        ai_strategy = orchestrator.generate_strategy(goal, strategy_data)
        return ai_strategy
    
    except Exception as e:
        logger.error(f"AI strategy generation failed: {e}")
        raise HTTPException(status_code=500, detail="AI strategy generation failed")


@router.get("/insights/{product_id}")
async def generate_insight_cards(
    product_id: str,
    db: Session = Depends(get_db),
) -> InsightCardsResponse:
    """
    Generate AI insight cards (market risk, opportunity, trends, recommendations).
    
    Example:
        GET /api/copilot/insights/prod_123
    """
    
    # Get product
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get strategy
    try:
        strategy_response = get_strategy(product_id, db)
        strategy = strategy_response.model_dump()
    except Exception as e:
        logger.error(f"Failed to get strategy: {e}")
        raise HTTPException(status_code=500, detail="Strategy retrieval failed")
    
    # Build insight cards
    cards = []
    
    # 1. Market Risk Card
    risk_flags = strategy.get("risk_flags", [])
    if risk_flags:
        critical_risks = [f for f in risk_flags if f.get("severity") == "CRITICAL"]
        if critical_risks:
            cards.append(InsightCard(
                type="market_risk",
                title="🚨 Market Risk Detected",
                description=critical_risks[0].get("message", "Critical market condition detected"),
                severity="CRITICAL",
                impact_pct=-5.0
            ))
        else:
            warning_risks = [f for f in risk_flags if f.get("severity") == "WARNING"]
            if warning_risks:
                cards.append(InsightCard(
                    type="market_risk",
                    title="⚠️ Market Warning",
                    description=warning_risks[0].get("message", "Monitor market conditions"),
                    severity="WARNING",
                    impact_pct=-2.0
                ))
    
    # 2. Revenue Opportunity Card
    expected_outcome = strategy.get("expected_outcome", {})
    revenue_impact = expected_outcome.get("revenue_impact_pct", 0)
    if revenue_impact > 5:
        cards.append(InsightCard(
            type="revenue_opportunity",
            title="📈 Revenue Opportunity",
            description=f"AI predicts {revenue_impact:+.1f}% revenue lift over 30 days with recommended strategy.",
            impact_pct=revenue_impact
        ))
    
    # 3. Trend Alert Card
    archetype = strategy.get("archetype", "HOLD")
    elasticity = strategy.get("elasticity", 0)
    if abs(elasticity) > 1.5:
        cards.append(InsightCard(
            type="trend_alert",
            title="🔥 Demand Sensitivity Detected",
            description=f"Price elasticity of {elasticity:.2f} indicates high demand sensitivity. "
                       f"Small price moves will significantly impact volume.",
            impact_pct=abs(elasticity) * 10
        ))
    
    # 4. AI Recommendation Card
    rec_price = strategy.get("recommended_price", 0)
    current_price = strategy.get("current_price", 0)
    price_change_pct = ((rec_price - current_price) / current_price * 100) if current_price else 0
    
    if abs(price_change_pct) > 0.5:  # Only show if meaningful change
        action = "increase" if price_change_pct > 0 else "decrease"
        cards.append(InsightCard(
            type="ai_recommendation",
            title="🧠 AI Recommendation",
            description=f"Move price {action} {abs(price_change_pct):.1f}% to ₹{rec_price:.0f} "
                       f"({archetype.lower()} strategy). Expected margin: {expected_outcome.get('margin_30d', 0):.1f}%.",
            impact_pct=revenue_impact
        ))
    
    # Ensure we have at least 4 cards
    while len(cards) < 4:
        cards.append(InsightCard(
            type="info",
            title="ℹ️ Market Stable",
            description="Current market conditions are stable. Monitor performance against benchmarks.",
            severity="INFO"
        ))
    
    return InsightCardsResponse(
        product_id=product_id,
        product_name=product.name,
        cards=cards[:4],  # Return top 4
        generated_at=datetime.utcnow().isoformat()
    )


@router.post("/chat")
async def copilot_chat(
    request: CopilotChatRequest,
    db: Session = Depends(get_db),
) -> CopilotChatResponse:
    """
    Conversational AI Copilot endpoint.
    
    User sends natural language message → AI Copilot generates contextual response.
    
    Example:
        POST /api/copilot/chat
        {
            "product_id": "prod_123",
            "message": "Should we lower the price to compete?",
            "goal_type": "maximize_market_share",
            "conversation_history": [
                {"role": "user", "content": "..."},
                {"role": "assistant", "content": "..."}
            ]
        }
    """
    
    # Get product
    product = get_product_by_id(db, request.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get strategy
    try:
        strategy_response = get_strategy(request.product_id, db)
        strategy_data = strategy_response.model_dump()
    except Exception as e:
        logger.error(f"Strategy retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve strategy")
    
    # Generate response using orchestrator
    try:
        goal = BusinessGoal(
            goal_type=request.goal_type,
            details=request.message,
            constraints=[]
        )
        
        orchestrator = create_orchestrator(GROQ_API_KEY)
        ai_strategy = orchestrator.generate_strategy(goal, strategy_data)
        
        # Extract insights cards for this response
        insight_cards = await generate_insight_cards(request.product_id, db)
        
        return CopilotChatResponse(
            message=ai_strategy.strategic_narrative,
            related_insights=insight_cards.cards,
            suggested_actions=ai_strategy.next_steps,
            confidence_score=ai_strategy.confidence_score
        )
    
    except Exception as e:
        logger.error(f"Copilot chat failed: {e}")
        raise HTTPException(status_code=500, detail="Copilot response generation failed")
