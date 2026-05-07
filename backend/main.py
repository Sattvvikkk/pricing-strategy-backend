"""PriceEngine — FastAPI application entry point."""
import os
import json
import math
import typing
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv

load_dotenv()

from database import init_db, SessionLocal
from auth.routes import router as auth_router
from services.data_seeder import seed_database


def clean_nan(obj):
    """Recursively clean NaN/Infinity values from data structures."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [clean_nan(item) for item in obj]
    return obj


class SafeJSONResponse(JSONResponse):
    """JSONResponse that handles NaN/Infinity by converting to null."""
    def render(self, content: typing.Any) -> bytes:
        cleaned = clean_nan(content)
        return json.dumps(
            cleaned,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")

# ── Route imports (stubs for now — filled in later parts) ────────────────────
from routes.dashboard import router as dashboard_router
from routes.analytics import router as analytics_router
from routes.scraper import router as scraper_router
from routes.products import router as products_router
from routes.marketplace import router as marketplace_router
from routes.strategy import router as strategy_router
from routes.ai_copilot import router as ai_copilot_router
from routes.intelligence import router as intelligence_router


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables, then seed data."""
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="PriceEngine API",
    description="B2B SaaS dynamic pricing for Vouge Studio",
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=SafeJSONResponse,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(scraper_router)
app.include_router(strategy_router)
app.include_router(marketplace_router)
app.include_router(ai_copilot_router)
app.include_router(intelligence_router)


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok"}


@app.get("/", tags=["System"])
def root():
    return {"message": "PriceEngine API v1.0", "docs": "/docs"}
