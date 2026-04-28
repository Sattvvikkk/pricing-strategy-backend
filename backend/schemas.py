"""Pydantic schemas for API request/response validation."""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ── Auth ─────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str = ""

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    class Config:
        from_attributes = True


# ── Product ──────────────────────────────────────────────────────────────────
class ProductOut(BaseModel):
    name: str
    base_price: float
    cost_price: float
    current_price: float
    stock: int
    rating: float


# ── Dashboard ────────────────────────────────────────────────────────────────
class KPIData(BaseModel):
    current_price: float
    recommended_price: float
    action: str
    revenue_impact_pct: float
    confidence: float
    monthly_revenue: float
    avg_daily_demand: float
    price_index: float
    volatility: float
    price_trend: str

class DashboardResponse(BaseModel):
    product: ProductOut
    kpis: KPIData
    explanation: str
    rule_price: float
    ml_price: float

class ScenarioRequest(BaseModel):
    demand_change_pct: float = 0.0
    competitor_price_change_pct: float = 0.0

class ScenarioResponse(BaseModel):
    recommended_price: float
    action: str
    revenue_impact_pct: float


# ── Analytics ────────────────────────────────────────────────────────────────
class TimeSeriesPoint(BaseModel):
    date: str
    value: float
    secondary: Optional[float] = None

class ScatterPoint(BaseModel):
    x: float
    y: float
    label: Optional[str] = None

class AnalyticsResponse(BaseModel):
    data: List[dict]


# ── Marketplace ──────────────────────────────────────────────────────────────
class MarketplacePrice(BaseModel):
    marketplace: str
    brand: str
    price: float
    rating: float
    discount: float

class MarketplaceResponse(BaseModel):
    prices: List[MarketplacePrice]
    our_price: float
