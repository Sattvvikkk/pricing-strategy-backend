"""FastAPI application — Dynamic Pricing SaaS Backend."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, SessionLocal
from models import Product, SalesHistory, CompetitorData
from config import PRODUCT_NAME, PRODUCT_DESC, BASE_PRICE, COST_PRICE
from auth.routes import router as auth_router
from routes.dashboard import router as dashboard_router
from routes.analytics import router as analytics_router
from routes.marketplace import router as marketplace_router
from routes.products import router as products_router
from routes.scraper import router as scraper_router


def seed_data():
    """Populate DB with simulated data if empty."""
    db = SessionLocal()
    try:
        if db.query(SalesHistory).count() > 0:
            return
        print("[SEED] Generating simulated data...")
        from services.dataset_generator import generate_sales_data, generate_competitor_data

        # Product
        product = Product(name=PRODUCT_NAME, description=PRODUCT_DESC,
                          base_price=BASE_PRICE, cost_price=COST_PRICE,
                          current_price=BASE_PRICE, stock=500, rating=4.1)
        db.add(product)

        # Sales
        sales_df = generate_sales_data()
        for _, row in sales_df.iterrows():
            db.add(SalesHistory(**row.to_dict()))

        # Competitors
        comp_df = generate_competitor_data()
        for _, row in comp_df.iterrows():
            db.add(CompetitorData(**row.to_dict()))

        db.commit()
        print(f"[SEED] Done — {len(sales_df)} sales, {len(comp_df)} competitor rows")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_data()
    yield


app = FastAPI(
    title="Dynamic Pricing Engine API",
    description="AI-driven dynamic pricing for D2C e-commerce",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(marketplace_router)
app.include_router(products_router)
app.include_router(scraper_router)


@app.get("/")
def root():
    return {"message": "Dynamic Pricing Engine API v2.0", "docs": "/docs"}
