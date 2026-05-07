"""Pydantic schemas for the Strategy Engine response — Part 4."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ── Action Plan ───────────────────────────────────────────────────────────────

class ActionPlanDay(BaseModel):
    date:              str    # ISO date  "YYYY-MM-DD"
    day:               int    # 1–14
    recommended_price: float
    expected_demand:   float
    expected_revenue:  float
    expected_margin:   float


# ── Trigger Rules ─────────────────────────────────────────────────────────────

class TriggerRule(BaseModel):
    condition: str    # human-readable with actual rupee values
    action:    str
    value:     float  # target price in rupees
    priority:  str    # "HIGH" | "MEDIUM" | "LOW"


# ── Risk Flags ────────────────────────────────────────────────────────────────

class RiskFlag(BaseModel):
    severity: str  # "CRITICAL" | "WARNING" | "INFO"
    message:  str


# ── Price Corridor ────────────────────────────────────────────────────────────

class PriceCorridor(BaseModel):
    min: float
    max: float


# ── Competitor Stats ──────────────────────────────────────────────────────────

class CompetitorStats(BaseModel):
    avg_price: float
    min_price: float
    max_price: float
    p25:       float
    count:     int


# ── Simulation ────────────────────────────────────────────────────────────────

class SimulationDay(BaseModel):
    day:     int
    price:   float
    demand:  float
    revenue: float
    margin:  float


class SimulationSummary(BaseModel):
    total_revenue: float
    total_margin:  float
    total_units:   float


class SimulationResult(BaseModel):
    series:  Dict[str, List[SimulationDay]]
    summary: Dict[str, SimulationSummary]


# ── Expected Outcome ──────────────────────────────────────────────────────────

class ExpectedOutcome(BaseModel):
    revenue_30d:        float
    margin_30d:         float
    units_30d:          float
    revenue_impact_pct: float  # vs HOLD baseline


# ── Top-level Response ────────────────────────────────────────────────────────

class StrategyResponse(BaseModel):
    product_id:       str
    product_name:     str
    archetype:        str           # e.g. "PENETRATION", "PREMIUM"
    current_price:    float
    recommended_price: float
    price_corridor:   PriceCorridor
    confidence:       float         # 50–95
    elasticity:       float
    rationale:        str           # 3-sentence LLM output
    risk_flags:       List[RiskFlag]
    action_plan:      List[ActionPlanDay]   # exactly 14 items
    triggers:         List[TriggerRule]     # 2–4 items
    simulation:       SimulationResult
    competitor_stats: CompetitorStats
    expected_outcome: ExpectedOutcome
    generated_at:     datetime


# ── Legacy models kept for backward compatibility ─────────────────────────────

class StrategyRequest(BaseModel):
    product_id:    str
    force_refresh: bool = False


class ScenarioRequest(BaseModel):
    product_id:           str
    demand_change_pct:    float = 0.0
    competitor_change_pct: float = 0.0


class ScenarioResponse(BaseModel):
    recommended_price:  float
    action:             str
    revenue_impact_pct: float