"""AI Strategy Generator — Multi-agent orchestration for conversational strategy building.

This service coordinates multiple specialized AI agents to:
1. Analyze market data from business goal perspective
2. Generate strategic recommendations with reasoning
3. Predict outcomes and explain confidence
4. Provide actionable, explainable intelligence

Flow:
    user_objective (natural language)
        ↓
    business_goal (e.g. "maximize_profit")
        ↓
    multi_agent_analysis (parallel intelligence gathering)
        ↓
    ai_strategy_response (narrative + structured data)
"""

import json
import asyncio
import logging
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from datetime import datetime

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Data Models
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class BusinessGoal:
    """Parsed business objective."""
    goal_type: str  # "maximize_profit", "increase_revenue", "maximize_market_share", etc
    details: str    # user's natural language description
    constraints: List[str] = None  # e.g. ["maintain_stock_level", "protect_brand_premium"]


@dataclass
class AgentAnalysis:
    """Output from a specialized AI agent."""
    agent_name: str
    focus: str
    key_findings: List[str]
    recommendation: str
    confidence: float  # 0-1


class AIStrategyResponse(BaseModel):
    """Structured AI strategy response."""
    business_goal: str
    strategic_narrative: str  # 3-5 paragraphs of AI reasoning
    key_insights: List[str]   # 3-4 bullet points
    recommended_action: str
    expected_impact: Dict[str, Any]  # revenue_impact_pct, margin_impact, etc
    confidence_score: float   # 0-100
    reasoning_breakdown: Dict[str, str]  # reasoning by component
    next_steps: List[str]
    generated_at: str


# ─────────────────────────────────────────────────────────────────────────────
# Specialized AI Agents
# ─────────────────────────────────────────────────────────────────────────────

class PricingAgent:
    """Analyzes pricing opportunities aligned to business goal."""
    
    def __init__(self, strategy_data: Dict[str, Any]):
        self.strategy_data = strategy_data
        self.name = "Pricing Agent"
    
    def analyze(self, goal: BusinessGoal) -> AgentAnalysis:
        """Analyze pricing from goal perspective."""
        archetype = self.strategy_data.get("archetype", "HOLD")
        current_price = self.strategy_data.get("current_price", 0)
        recommended_price = self.strategy_data.get("recommended_price", 0)
        elasticity = self.strategy_data.get("elasticity", 0)
        confidence = self.strategy_data.get("confidence", 75)
        
        price_change_pct = ((recommended_price - current_price) / current_price * 100) if current_price else 0
        
        # Goal-specific reasoning
        if goal.goal_type == "maximize_profit":
            reasoning = (
                f"For profit maximization, the {archetype.lower()} strategy recommends "
                f"pricing at ₹{recommended_price:.0f} ({price_change_pct:+.1f}%). "
                f"With elasticity of {elasticity:.2f}, this targets the sweet spot between "
                f"volume and margin contribution."
            )
        elif goal.goal_type == "increase_revenue":
            reasoning = (
                f"To boost revenue, the {archetype.lower()} strategy suggests moving to "
                f"₹{recommended_price:.0f}. The elasticity of {elasticity:.2f} indicates "
                f"demand will {'rise significantly' if elasticity < -1.2 else 'shift moderately'} "
                f"with this price adjustment."
            )
        elif goal.goal_type == "maximize_market_share":
            reasoning = (
                f"For market share capture, aggressive penetration pricing at ₹{recommended_price:.0f} "
                f"is recommended. With elasticity of {elasticity:.2f}, lower pricing will drive "
                f"unit volume while maintaining acceptable margins."
            )
        else:
            reasoning = (
                f"Based on market analysis, recommended price is ₹{recommended_price:.0f} "
                f"({price_change_pct:+.1f}% adjustment). Price elasticity of {elasticity:.2f} "
                f"suggests {'high' if abs(elasticity) > 1.5 else 'moderate'} demand sensitivity."
            )
        
        return AgentAnalysis(
            agent_name=self.name,
            focus="Optimal price positioning",
            key_findings=[
                f"Current: ₹{current_price:.0f} → Recommended: ₹{recommended_price:.0f}",
                f"Price elasticity: {elasticity:.2f} ({archetype} archetype)",
                f"Estimated impact: {price_change_pct:+.1f}% price change"
            ],
            recommendation=reasoning,
            confidence=confidence / 100.0
        )


class CompetitorAgent:
    """Analyzes competitive positioning."""
    
    def __init__(self, strategy_data: Dict[str, Any]):
        self.strategy_data = strategy_data
        self.name = "Competitor Agent"
    
    def analyze(self, goal: BusinessGoal) -> AgentAnalysis:
        """Analyze competitive landscape."""
        comp_stats = self.strategy_data.get("competitor_stats", {})
        comp_avg = comp_stats.get("avg_price", 0)
        comp_min = comp_stats.get("min_price", 0)
        comp_max = comp_stats.get("max_price", 0)
        rec_price = self.strategy_data.get("recommended_price", 0)
        
        position = "premium" if rec_price > comp_avg else "aggressive" if rec_price < comp_min else "competitive"
        
        finding = (
            f"Your recommended price (₹{rec_price:.0f}) positions you {position}ly relative to "
            f"competitors (avg ₹{comp_avg:.0f}, range ₹{comp_min:.0f}-₹{comp_max:.0f}). "
            f"This helps {'defend premium positioning' if position == 'premium' else 'capture volume'} "
            f"in line with your {goal.goal_type.replace('_', ' ')} objective."
        )
        
        return AgentAnalysis(
            agent_name=self.name,
            focus="Competitive positioning",
            key_findings=[
                f"Competitor average: ₹{comp_avg:.0f} | Range: ₹{comp_min:.0f}-₹{comp_max:.0f}",
                f"Your position: {position.upper()}",
                f"Market coverage: {comp_stats.get('count', 0)} competitors tracked"
            ],
            recommendation=finding,
            confidence=0.8
        )


class InventoryAgent:
    """Analyzes stock and inventory implications."""
    
    def __init__(self, strategy_data: Dict[str, Any]):
        self.strategy_data = strategy_data
        self.name = "Inventory Agent"
    
    def analyze(self, goal: BusinessGoal) -> AgentAnalysis:
        """Analyze inventory health."""
        action_plan = self.strategy_data.get("action_plan", [])
        risk_flags = self.strategy_data.get("risk_flags", [])
        expected_outcome = self.strategy_data.get("expected_outcome", {})
        
        stock_risks = [f for f in risk_flags if "stock" in f.get("message", "").lower()]
        units_30d = expected_outcome.get("units_30d", 0)
        
        finding = (
            f"Projected 30-day sell-through: {units_30d:.0f} units. "
            f"This aligns with your goal to "
            f"{'clear excess inventory quickly' if stock_risks else 'maintain healthy stock rotation'}. "
            f"{len(stock_risks)} stock-related considerations flagged."
        )
        
        return AgentAnalysis(
            agent_name=self.name,
            focus="Inventory optimization",
            key_findings=[
                f"30-day volume projection: {units_30d:.0f} units",
                f"Stock risk factors: {len(stock_risks)}",
                f"Action plan: {len(action_plan)} price adjustments recommended"
            ],
            recommendation=finding,
            confidence=0.75
        )


class RevenueAgent:
    """Analyzes revenue & margin impact."""
    
    def __init__(self, strategy_data: Dict[str, Any]):
        self.strategy_data = strategy_data
        self.name = "Revenue Agent"
    
    def analyze(self, goal: BusinessGoal) -> AgentAnalysis:
        """Analyze financial impact."""
        expected_outcome = self.strategy_data.get("expected_outcome", {})
        revenue_30d = expected_outcome.get("revenue_30d", 0)
        margin_30d = expected_outcome.get("margin_30d", 0)
        revenue_impact = expected_outcome.get("revenue_impact_pct", 0)
        
        impact_direction = "positive" if revenue_impact > 0 else "negative"
        
        finding = (
            f"30-day revenue projection: ₹{revenue_30d:.0f} ({revenue_impact:+.1f}% vs HOLD). "
            f"Gross margin expected at {margin_30d:.1f}%. "
            f"This {impact_direction} impact supports your {goal.goal_type.replace('_', ' ')} objective."
        )
        
        return AgentAnalysis(
            agent_name=self.name,
            focus="Financial impact",
            key_findings=[
                f"30-day revenue: ₹{revenue_30d:.0f}",
                f"Projected margin: {margin_30d:.1f}%",
                f"vs HOLD strategy: {revenue_impact:+.1f}%"
            ],
            recommendation=finding,
            confidence=0.85
        )


class MarketingAgent:
    """Analyzes marketing and promotional opportunities."""
    
    def __init__(self, strategy_data: Dict[str, Any]):
        self.strategy_data = strategy_data
        self.name = "Marketing Agent"
    
    def analyze(self, goal: BusinessGoal) -> AgentAnalysis:
        """Analyze marketing implications."""
        triggers = self.strategy_data.get("triggers", [])
        action_plan = self.strategy_data.get("action_plan", [])
        archetype = self.strategy_data.get("archetype", "HOLD")
        
        # Count promotion-related triggers
        promo_triggers = [t for t in triggers if "discount" in t.get("condition", "").lower() or "promotion" in t.get("condition", "").lower()]
        
        # Goal-specific marketing analysis
        if goal.goal_type == "maximize_profit":
            finding = (
                f"Marketing focus should emphasize value positioning over price cuts. "
                f"With {len(promo_triggers)} promotional triggers planned, maintain brand premium "
                f"while using targeted promotions to drive volume without eroding margins."
            )
        elif goal.goal_type == "increase_revenue":
            finding = (
                f"Revenue growth requires aggressive promotional calendar. "
                f"The {archetype.lower()} strategy supports {len(promo_triggers)} flash sales "
                f"over {len(action_plan)} days, maximizing top-line while protecting market share."
            )
        else:
            finding = (
                f"Marketing should align with {archetype.lower()} positioning. "
                f"Planned {len(promo_triggers)} promotional activities will support "
                f"brand perception while driving tactical objectives."
            )
        
        return AgentAnalysis(
            agent_name=self.name,
            focus="Marketing optimization",
            key_findings=[
                f"Promotional triggers: {len(promo_triggers)}",
                f"Action plan duration: {len(action_plan)} days",
                f"Marketing alignment: {archetype} positioning"
            ],
            recommendation=finding,
            confidence=0.8
        )


class TrendAgent:
    """Analyzes fashion/trend signals and viral potential."""
    
    def __init__(self, strategy_data: Dict[str, Any]):
        self.strategy_data = strategy_data
        self.name = "Trend Agent"
    
    def analyze(self, goal: BusinessGoal) -> AgentAnalysis:
        """Analyze trend signals."""
        product_name = self.strategy_data.get("product_name", "Product")
        archetype = self.strategy_data.get("archetype", "HOLD")
        
        # Simulate trend analysis (in real implementation, would use external trend APIs)
        trend_signals = {
            "cotton_tee": "stable_baseline",
            "denim": "seasonal_peak",
            "dress": "trending_up",
            "jacket": "declining"
        }
        
        # Extract category from product name
        category = "cotton_tee"  # default
        for key in trend_signals:
            if key in product_name.lower():
                category = key
                break
        
        trend_signal = trend_signals.get(category, "stable_baseline")
        
        # Goal-specific trend analysis
        if trend_signal == "trending_up":
            finding = (
                f"Strong upward trend detected for {category.replace('_', ' ')} category. "
                f"The {archetype.lower()} strategy positions you to capture viral momentum. "
                f"Expect 20-30% demand surge over next 14 days."
            )
        elif trend_signal == "seasonal_peak":
            finding = (
                f"Seasonal peak approaching for {category.replace('_', ' ')} products. "
                f"Current {archetype.lower()} strategy aligns with seasonal demand patterns. "
                f"Optimize pricing now to maximize seasonal capture."
            )
        elif trend_signal == "declining":
            finding = (
                f"Category showing decline trend. "
                f"The {archetype.lower()} strategy helps mitigate downside risk. "
                f"Consider promotional acceleration to clear inventory before further decline."
            )
        else:
            finding = (
                f"Stable trend baseline for {category.replace('_', ' ')}. "
                f"{archetype.title()} strategy provides balanced approach. "
                f"No viral signals detected - focus on consistent execution."
            )
        
        return AgentAnalysis(
            agent_name=self.name,
            focus="Trend analysis",
            key_findings=[
                f"Category: {category.replace('_', ' ').title()}",
                f"Trend signal: {trend_signal.replace('_', ' ').title()}",
                f"Viral potential: {'High' if trend_signal == 'trending_up' else 'Low'}"
            ],
            recommendation=finding,
            confidence=0.75
        )


# ─────────────────────────────────────────────────────────────────────────────
# LLM-Based Strategy Narrative Generator
# ─────────────────────────────────────────────────────────────────────────────

class StrategyNarrativeGenerator:
    """Generates executive-level strategy narrative using LLM."""
    
    GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "llama-3.3-70b-versatile"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def generate(
        self,
        goal: BusinessGoal,
        agent_analyses: List[AgentAnalysis],
        strategy_data: Dict[str, Any]
    ) -> str:
        """Generate narrative strategy using Groq API."""
        
        # Build context from agent analyses
        agent_summaries = []
        for analysis in agent_analyses:
            agent_summaries.append(
                f"**{analysis.agent_name}**: {analysis.recommendation}"
            )
        
        product_name = strategy_data.get("product_name", "Product")
        archetype = strategy_data.get("archetype", "HOLD")
        
        prompt = f"""
You are an elite pricing strategist and business consultant. Generate a strategic recommendation for this scenario:

**Objective**: {goal.details}
**Business Goal**: {goal.goal_type.replace('_', ' ').title()}
**Product**: {product_name}
**Market Position**: {archetype}

**Multi-Agent Analysis Summary**:
{chr(10).join(agent_summaries)}

Write a compelling 3-paragraph executive strategy narrative that:
1. Opens with the core strategic opportunity and market dynamics
2. Explains the multi-agent intelligence (pricing, competition, inventory, marketing, trends, revenue)
3. Closes with the expected impact, confidence level, and immediate action required

Be specific with numbers, percentages, and timeframes. Use present tense. Write for a CFO/COO.
Avoid jargon. Be direct and confident. Focus on business outcomes.
"""
        
        try:
            response = httpx.post(
                self.GROQ_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.GROQ_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a senior pricing strategist writing for executives."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500,
                },
                timeout=10.0
            )
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"].strip()
        
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return self._fallback_narrative(goal, agent_analyses, strategy_data)
    
    def _fallback_narrative(
        self,
        goal: BusinessGoal,
        agent_analyses: List[AgentAnalysis],
        strategy_data: Dict[str, Any]
    ) -> str:
        """Fallback narrative if LLM fails."""
        archetype = strategy_data.get("archetype", "HOLD")
        revenue_impact = strategy_data.get("expected_outcome", {}).get("revenue_impact_pct", 0)
        
        return (
            f"The recommended {archetype.lower()} strategy aligns with your objective to "
            f"{goal.goal_type.replace('_', ' ')}. "
            f"Market analysis across pricing, competition, inventory, and revenue optimization "
            f"points to a {revenue_impact:+.1f}% revenue impact over 30 days. "
            f"This balanced approach captures the opportunity while managing market risks. "
            f"Implementation should begin immediately to capitalize on current demand signals."
        )


# ─────────────────────────────────────────────────────────────────────────────
# Main Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

class AIStrategyOrchestrator:
    """Orchestrates multi-agent analysis and generates AI strategy."""
    
    def __init__(self, groq_api_key: str):
        self.groq_api_key = groq_api_key
        self.narrative_generator = StrategyNarrativeGenerator(groq_api_key)
    
    def generate_strategy(
        self,
        goal: BusinessGoal,
        strategy_data: Dict[str, Any]
    ) -> AIStrategyResponse:
        """Generate complete AI strategy response."""
        
        # Instantiate agents
        agents = [
            PricingAgent(strategy_data),
            CompetitorAgent(strategy_data),
            InventoryAgent(strategy_data),
            MarketingAgent(strategy_data),
            TrendAgent(strategy_data),
            RevenueAgent(strategy_data),
        ]
        
        # Run analyses
        analyses = [agent.analyze(goal) for agent in agents]
        
        # Calculate average confidence
        avg_confidence = sum(a.confidence for a in analyses) / len(analyses) * 100
        
        # Generate strategic narrative
        narrative = self.narrative_generator.generate(goal, analyses, strategy_data)
        
        # Extract key insights from all agents
        key_insights = [
            f"{a.focus}: {a.key_findings[0]}"
            for a in analyses[:4]  # Top 4 insights
        ]
        
        # Build recommended action
        recommended_action = (
            f"Execute {strategy_data.get('archetype', 'HOLD').lower()} strategy "
            f"with immediate price adjustment to ₹{strategy_data.get('recommended_price', 0):.0f}. "
            f"Follow 14-day action plan with {len(strategy_data.get('triggers', []))} trigger rules."
        )
        
        # Expected impact
        expected_outcome = strategy_data.get("expected_outcome", {})
        expected_impact = {
            "revenue_impact_pct": expected_outcome.get("revenue_impact_pct", 0),
            "margin_impact_pct": expected_outcome.get("margin_30d", 0) - 18,  # assuming 18% baseline
            "volume_projection": expected_outcome.get("units_30d", 0),
            "timeframe": "30 days"
        }
        
        # Reasoning breakdown
        reasoning_breakdown = {
            analysis.agent_name: analysis.recommendation
            for analysis in analyses
        }
        
        # Next steps
        next_steps = [
            f"Implement {strategy_data.get('archetype', 'HOLD').lower()} pricing",
            f"Monitor {len(strategy_data.get('triggers', []))} automated trigger rules",
            f"Review performance daily vs {len(strategy_data.get('action_plan', []))}-day action plan",
            "Adjust based on competitor moves and demand signals"
        ]
        
        return AIStrategyResponse(
            business_goal=goal.goal_type.replace("_", " ").title(),
            strategic_narrative=narrative,
            key_insights=key_insights,
            recommended_action=recommended_action,
            expected_impact=expected_impact,
            confidence_score=avg_confidence,
            reasoning_breakdown=reasoning_breakdown,
            next_steps=next_steps,
            generated_at=datetime.utcnow().isoformat()
        )


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def create_orchestrator(groq_api_key: str) -> AIStrategyOrchestrator:
    """Factory function to create orchestrator with API key."""
    return AIStrategyOrchestrator(groq_api_key)
