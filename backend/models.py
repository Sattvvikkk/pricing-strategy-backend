"""SQLAlchemy ORM models — all 8 tables for PriceEngine."""
from sqlalchemy import (
    Column, Integer, Float, String, Text, DateTime, Date,
    Boolean, ForeignKey, JSON
)
from sqlalchemy.sql import func
from database import Base


# ──────────────────────────────────────────────
# ORGANISATIONS
# ──────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    plan = Column(String(20), default="free")          # free / starter / pro
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    subscription_status = Column(String(50), default="inactive")


# ──────────────────────────────────────────────
# USERS
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)


# ──────────────────────────────────────────────
# ORGANISATION MEMBERS (join table with roles)
# ──────────────────────────────────────────────

class OrganizationMember(Base):
    __tablename__ = "organization_members"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), default="member")       # owner / admin / member
    created_at = Column(DateTime, server_default=func.now())


# ──────────────────────────────────────────────
# PRODUCTS  (string primary key — slug)
# ──────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"
    id = Column(String(100), primary_key=True, index=True)   # e.g. vs-essential-cotton-tee
    name = Column(String(255), nullable=False)
    brand = Column(String(100), default="Vouge Studio")
    category = Column(String(100), nullable=True)
    current_price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)


# ──────────────────────────────────────────────
# SALES HISTORY
# ──────────────────────────────────────────────

class SalesHistory(Base):
    __tablename__ = "sales_history"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(String(100), ForeignKey("products.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    date = Column(Date, nullable=False, index=True)
    price = Column(Float, nullable=False)
    units_sold = Column(Integer, nullable=False)
    revenue = Column(Float, nullable=False)
    day_of_week = Column(Integer, nullable=True)      # 0=Mon … 6=Sun


# ──────────────────────────────────────────────
# COMPETITOR DATA
# ──────────────────────────────────────────────

class CompetitorData(Base):
    __tablename__ = "competitor_data"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(String(100), ForeignKey("products.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    scraped_at = Column(DateTime, server_default=func.now())
    platform = Column(String(100), nullable=False)    # Amazon / Myntra / H&M / etc.
    price = Column(Float, nullable=False)
    title = Column(String(500), nullable=True)
    merchant = Column(String(255), nullable=True)
    link = Column(Text, nullable=True)


# ──────────────────────────────────────────────
# STRATEGIES  (custom strategy builder entries)
# ──────────────────────────────────────────────

class Strategy(Base):
    __tablename__ = "strategies"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    objective = Column(String(100), nullable=True)
    price_formula_type = Column(String(50), nullable=True)   # fixed / competitor_pct / cost_plus
    price_formula_value = Column(Float, nullable=True)
    time_horizon_days = Column(Integer, default=14)
    rules = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# ──────────────────────────────────────────────
# STRATEGY APPLICATIONS
# ──────────────────────────────────────────────

class StrategyApplication(Base):
    __tablename__ = "strategy_applications"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False)
    product_id = Column(String(100), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    applied_at = Column(DateTime, server_default=func.now())
    applied_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="ACTIVE")      # ACTIVE / PAUSED / COMPLETED
    results = Column(JSON, nullable=True)


# ──────────────────────────────────────────────
# USAGE LOGS
# ──────────────────────────────────────────────

class UsageLog(Base):
    __tablename__ = "usage_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    date = Column(Date, nullable=False)
    endpoint = Column(String(255), nullable=False)
    count = Column(Integer, default=1)
