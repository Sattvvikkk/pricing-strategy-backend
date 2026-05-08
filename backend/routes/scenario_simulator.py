"""Scenario Simulator API route.

POST /api/scenario-simulator/{product_id}
    Simulate what-if scenarios with adjustable sliders for price,
    ad spend, inventory, competitor reaction, and demand spike.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from services.product_catalog import get_product
from services.scenario_simulator import simulate_scenario, SimulationInput

router = APIRouter(prefix="/api/scenario-simulator", tags=["Scenario Simulator"])


class SimulationRequest(BaseModel):
    """Simulation input parameters."""
    price_change_pct: float = 0.0
    ad_spend_multiplier: float = 1.0
    inventory_quantity: int = 300
    competitor_reaction: str = "neutral"
    demand_spike: float = 1.0


@router.post("/{product_id}")
def run_simulation(product_id: str, request: SimulationRequest, db: Session = Depends(get_db)):
    """Run scenario simulation for a product."""
    product = get_product(product_id)
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")
    
    # Build base data from product
    base_data = {
        "current_price": product.get("price", 799),
        "cost_price": product.get("cost_price", product.get("price", 799) * 0.5),
        "current_stock": product.get("stock", 300),
        "avg_daily_demand": 30.0,  # Would come from sales history
        "elasticity": -1.5,  # Would come from ML model
        "competitor_avg_price": 750,  # Would come from competitor data
        "market_size": 10000,
        "current_revenue": 1200000,  # ₹12L
        "current_margin": 0.18,
        "current_sell_through": 0.61,
        "current_market_share": 0.08
    }
    
    # Create simulation input
    inputs = SimulationInput(
        price_change_pct=request.price_change_pct,
        ad_spend_multiplier=request.ad_spend_multiplier,
        inventory_quantity=request.inventory_quantity,
        competitor_reaction=request.competitor_reaction,
        demand_spike=request.demand_spike
    )
    
    # Run simulation
    result = simulate_scenario(base_data, inputs)
    
    # Add product context
    result["product_id"] = product_id
    result["product_name"] = product.get("name", product_id)
    
    return result
