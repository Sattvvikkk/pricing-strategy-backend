"""
Database layer — SQLite setup, schema creation, and CRUD helpers.
"""
import sqlite3
import os
import pandas as pd
from config import DB_PATH


def _get_db_path() -> str:
    """Return absolute path to the database file next to this script."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), DB_PATH)


def get_connection() -> sqlite3.Connection:
    """Open (or create) the SQLite database and return a connection."""
    conn = sqlite3.connect(_get_db_path())
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Create all tables if they don't already exist."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS product (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            base_price  REAL    NOT NULL,
            cost_price  REAL    NOT NULL,
            current_price REAL  NOT NULL
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS sales_history (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            date                TEXT    NOT NULL,
            price               REAL    NOT NULL,
            units_sold          INTEGER NOT NULL,
            competitor_avg_price REAL,
            rating              REAL,
            stock               INTEGER,
            revenue             REAL    NOT NULL
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS competitor_data (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            date      TEXT    NOT NULL,
            brand     TEXT    NOT NULL,
            price     REAL    NOT NULL,
            rating    REAL,
            discount  REAL
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS price_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            date        TEXT    NOT NULL,
            price       REAL    NOT NULL,
            action      TEXT,
            reason      TEXT
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at          TEXT    NOT NULL,
            forecast_date       TEXT    NOT NULL,
            predicted_demand    REAL,
            recommended_price   REAL,
            action              TEXT,
            revenue_impact_pct  REAL,
            explanation         TEXT
        );
    """)

    conn.commit()
    conn.close()


# ── Insert helpers ───────────────────────────────────────────────────────────

def insert_product(name: str, base_price: float, cost_price: float,
                   current_price: float) -> None:
    conn = get_connection()
    conn.execute(
        "INSERT INTO product (name, base_price, cost_price, current_price) "
        "VALUES (?, ?, ?, ?)",
        (name, base_price, cost_price, current_price),
    )
    conn.commit()
    conn.close()


def update_product_price(price: float) -> None:
    conn = get_connection()
    conn.execute("UPDATE product SET current_price = ? WHERE id = 1", (price,))
    conn.commit()
    conn.close()


def insert_sales_bulk(df: pd.DataFrame) -> None:
    """Insert a DataFrame of sales rows (must match sales_history columns)."""
    conn = get_connection()
    df.to_sql("sales_history", conn, if_exists="append", index=False)
    conn.commit()
    conn.close()


def insert_competitor_bulk(df: pd.DataFrame) -> None:
    conn = get_connection()
    df.to_sql("competitor_data", conn, if_exists="append", index=False)
    conn.commit()
    conn.close()


def insert_price_record(date: str, price: float, action: str,
                        reason: str) -> None:
    conn = get_connection()
    conn.execute(
        "INSERT INTO price_history (date, price, action, reason) "
        "VALUES (?, ?, ?, ?)",
        (date, price, action, reason),
    )
    conn.commit()
    conn.close()


def insert_prediction(created_at: str, forecast_date: str,
                      predicted_demand: float, recommended_price: float,
                      action: str, revenue_impact_pct: float,
                      explanation: str) -> None:
    conn = get_connection()
    conn.execute(
        "INSERT INTO predictions "
        "(created_at, forecast_date, predicted_demand, recommended_price, "
        "action, revenue_impact_pct, explanation) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (created_at, forecast_date, predicted_demand, recommended_price,
         action, revenue_impact_pct, explanation),
    )
    conn.commit()
    conn.close()


# ── Query helpers ────────────────────────────────────────────────────────────

def get_product() -> dict:
    conn = get_connection()
    row = conn.execute("SELECT * FROM product WHERE id = 1").fetchone()
    conn.close()
    if row is None:
        return {}
    return {
        "id": row[0], "name": row[1], "base_price": row[2],
        "cost_price": row[3], "current_price": row[4],
    }


def get_sales_history() -> pd.DataFrame:
    conn = get_connection()
    df = pd.read_sql("SELECT * FROM sales_history ORDER BY date", conn)
    conn.close()
    return df


def get_competitor_data() -> pd.DataFrame:
    conn = get_connection()
    df = pd.read_sql("SELECT * FROM competitor_data ORDER BY date, brand", conn)
    conn.close()
    return df


def get_price_history() -> pd.DataFrame:
    conn = get_connection()
    df = pd.read_sql("SELECT * FROM price_history ORDER BY date", conn)
    conn.close()
    return df


def get_predictions() -> pd.DataFrame:
    conn = get_connection()
    df = pd.read_sql("SELECT * FROM predictions ORDER BY forecast_date", conn)
    conn.close()
    return df


def is_db_populated() -> bool:
    """Check whether the sales_history table already has data."""
    conn = get_connection()
    row = conn.execute("SELECT COUNT(*) FROM sales_history").fetchone()
    conn.close()
    return row[0] > 0
