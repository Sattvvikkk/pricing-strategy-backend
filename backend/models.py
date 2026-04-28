"""SQLAlchemy ORM models."""
from sqlalchemy import Column, Integer, Float, String, Text, DateTime, Date, Boolean
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    base_price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    rating = Column(Float, default=4.0)


class SalesHistory(Base):
    __tablename__ = "sales_history"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(20), nullable=False, index=True)
    price = Column(Float, nullable=False)
    units_sold = Column(Integer, nullable=False)
    stock = Column(Integer, default=0)
    rating = Column(Float, default=4.0)
    revenue = Column(Float, nullable=False)


class CompetitorData(Base):
    __tablename__ = "competitor_data"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(20), nullable=False, index=True)
    marketplace = Column(String(50), nullable=False)
    brand = Column(String(100), nullable=False)
    price = Column(Float, nullable=False)
    rating = Column(Float, default=0)
    discount = Column(Float, default=0)


class PriceHistory(Base):
    __tablename__ = "price_history"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(20), nullable=False)
    price = Column(Float, nullable=False)
    action = Column(String(20), default="Hold")
    reason = Column(Text, default="")


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    forecast_date = Column(String(20), nullable=False)
    predicted_demand = Column(Float)
    recommended_price = Column(Float)
    action = Column(String(20))
    confidence = Column(Float, default=0.0)
    revenue_impact_pct = Column(Float, default=0.0)
    explanation = Column(Text, default="")
