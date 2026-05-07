"""
Customer Segmentation Model
============================
Derives buyer segments from daily sales patterns using K-Means + DBSCAN.
Since we have sales history (not individual customer records), we cluster
daily behavioral signals as proxies for buyer cohorts.

Segments
--------
PREMIUM_BUYERS   — High willingness-to-pay, weekday-dominant
DISCOUNT_SEEKERS — Spike on low-price days, high price sensitivity
LOYAL_CUSTOMERS  — Consistent demand, price-insensitive
IMPULSE_SHOPPERS — Irregular spikes, weekend-heavy

Public API
----------
segment_customers(sales_df, product) → dict
"""
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler


# ── Feature engineering ───────────────────────────────────────────────────────

def _build_segment_features(sales_df: pd.DataFrame, product: dict) -> pd.DataFrame:
    """
    Build daily feature vectors for clustering.
    Each row represents a single day's behavioral profile.
    """
    df = sales_df.sort_values("date").copy()
    df["date"]       = pd.to_datetime(df["date"])
    df["dow"]        = df["date"].dt.dayofweek
    df["is_weekend"] = (df["dow"] >= 5).astype(int)
    df["price_ma7"]  = df["price"].rolling(7, min_periods=1).mean()
    df["demand_ma7"] = df["units_sold"].rolling(7, min_periods=1).mean()

    # Price below 7-day average → potential promotion / discount day
    df["is_low_price"]  = (df["price"] < df["price_ma7"] * 0.97).astype(float)
    df["is_high_price"] = (df["price"] > df["price_ma7"] * 1.03).astype(float)

    # Demand spike (above 7d MA by 30%)
    df["is_spike"]      = (df["units_sold"] > df["demand_ma7"] * 1.30).astype(float)

    # Willingness to pay proxy: revenue per unit vs average
    df["revenue_per_unit"] = df["price"]  # price IS willingness to pay in single-price model

    # Normalised price position: 0 = lowest, 1 = highest price in window
    p_min = df["price"].min()
    p_max = df["price"].max()
    p_range = p_max - p_min if p_max > p_min else 1
    df["price_position"] = (df["price"] - p_min) / p_range

    # Demand consistency: inverse of coefficient of variation rolling
    df["demand_cv"] = df["units_sold"].rolling(14, min_periods=3).std() / \
                      (df["units_sold"].rolling(14, min_periods=3).mean() + 1e-6)
    df["demand_cv"] = df["demand_cv"].fillna(0.5)
    df["demand_consistency"] = 1.0 - df["demand_cv"].clip(0, 1)

    features = df[[
        "is_weekend", "is_low_price", "is_high_price", "is_spike",
        "price_position", "demand_consistency", "dow",
    ]].fillna(0)

    return features, df


# ── K-Means clustering ────────────────────────────────────────────────────────

def _kmeans_cluster(features: pd.DataFrame, k: int = 4) -> np.ndarray:
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(features.values)
    km = KMeans(n_clusters=k, random_state=42, n_init=10, max_iter=300)
    return km.fit_predict(X_scaled), scaler, km


# ── DBSCAN outlier detection ──────────────────────────────────────────────────

def _dbscan_outliers(features: pd.DataFrame) -> np.ndarray:
    """Return boolean array: True = impulse/outlier day."""
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(features.values)
    db = DBSCAN(eps=0.8, min_samples=3)
    labels = db.fit_predict(X_scaled)
    return labels == -1  # -1 = outlier in DBSCAN


# ── Segment labeling ──────────────────────────────────────────────────────────

SEGMENT_DEFINITIONS = {
    "PREMIUM_BUYERS": {
        "description": "High willingness-to-pay, buy at full or premium price, weekday-dominant",
        "recommended_strategy": "Maintain premium pricing. Offer exclusive bundles. Avoid deep discounts.",
        "icon": "👑",
        "color": "#8B5CF6",
    },
    "DISCOUNT_SEEKERS": {
        "description": "Purchase primarily during sales/promotions, highly price sensitive",
        "recommended_strategy": "Use time-limited flash sales. Avoid permanent price cuts. Create urgency.",
        "icon": "🏷️",
        "color": "#F59E0B",
    },
    "LOYAL_CUSTOMERS": {
        "description": "Consistent buyers regardless of price, form the reliable revenue base",
        "recommended_strategy": "Reward with loyalty perks. Upsell higher-margin products. Protect pricing.",
        "icon": "❤️",
        "color": "#10B981",
    },
    "IMPULSE_SHOPPERS": {
        "description": "Irregular spike buyers, often weekend-triggered, unpredictable",
        "recommended_strategy": "Use FOMO tactics. Weekend promotions. Limited-edition drops.",
        "icon": "⚡",
        "color": "#EF4444",
    },
}

SEGMENT_NAMES = list(SEGMENT_DEFINITIONS.keys())


def _assign_segment_label(cluster_df: pd.DataFrame, original_df: pd.DataFrame) -> str:
    """
    Assign a semantic segment name to a cluster based on its centroid profile.
    """
    avg_weekend         = cluster_df["is_weekend"].mean()
    avg_low_price       = cluster_df["is_low_price"].mean()
    avg_high_price      = cluster_df["is_high_price"].mean()
    avg_spike           = cluster_df["is_spike"].mean()
    avg_price_position  = cluster_df["price_position"].mean()
    avg_consistency     = cluster_df["demand_consistency"].mean()

    # Scoring matrix
    scores = {
        "PREMIUM_BUYERS":   avg_high_price * 3 + avg_price_position * 2 + (1 - avg_weekend) + avg_consistency,
        "DISCOUNT_SEEKERS": avg_low_price * 3 + avg_spike * 1.5 + (1 - avg_price_position) * 2,
        "LOYAL_CUSTOMERS":  avg_consistency * 4 + (1 - avg_spike) + (1 - avg_low_price),
        "IMPULSE_SHOPPERS": avg_spike * 3 + avg_weekend * 2 + (1 - avg_consistency) * 2,
    }
    return max(scores, key=scores.get)


# ── Per-segment statistics ────────────────────────────────────────────────────

def _segment_stats(cluster_df: pd.DataFrame, orig_df: pd.DataFrame, label: str, total_days: int) -> dict:
    """Compute per-segment statistics and strategy recommendation."""
    size_pct = round(len(cluster_df) / total_days * 100, 1)

    avg_price = float(orig_df.loc[cluster_df.index, "price"].mean()) \
        if not orig_df.loc[cluster_df.index, "price"].empty else 0

    avg_demand = float(orig_df.loc[cluster_df.index, "units_sold"].mean()) \
        if not orig_df.loc[cluster_df.index, "units_sold"].empty else 0

    avg_revenue = round(avg_price * avg_demand, 2)

    defn = SEGMENT_DEFINITIONS.get(label, {})

    return {
        "name":                     label,
        "icon":                     defn.get("icon", "🔵"),
        "color":                    defn.get("color", "#6366F1"),
        "size_pct":                 size_pct,
        "day_count":                len(cluster_df),
        "avg_willingness_to_pay":   round(avg_price, 2),
        "avg_daily_demand":         round(avg_demand, 1),
        "avg_daily_revenue":        avg_revenue,
        "description":              defn.get("description", ""),
        "recommended_strategy":     defn.get("recommended_strategy", ""),
    }


# ── Master function ───────────────────────────────────────────────────────────

def segment_customers(sales_df: pd.DataFrame, product: dict) -> dict:
    """
    Run K-Means (k=4) + DBSCAN on daily sales features to derive
    4 buyer segments and per-segment pricing strategies.

    Returns
    -------
    {
      "segments": [{ name, icon, color, size_pct, avg_willingness_to_pay,
                     avg_daily_demand, description, recommended_strategy }],
      "dominant_segment": str,
      "impulse_days_pct": float,
      "personalization_insights": str,
      "model_info": { "kmeans_k": 4, "dbscan_outliers_pct": float }
    }
    """
    df = sales_df.sort_values("date").copy()

    if len(df) < 20:
        # Not enough data — return synthetic segments
        return {
            "segments": [
                {**SEGMENT_DEFINITIONS[name], "name": name, "size_pct": 25.0,
                 "day_count": 0, "avg_willingness_to_pay": product.get("price", 799),
                 "avg_daily_demand": 30.0, "avg_daily_revenue": 0.0}
                for name in SEGMENT_NAMES
            ],
            "dominant_segment":           "LOYAL_CUSTOMERS",
            "impulse_days_pct":           12.0,
            "personalization_insights":   "Insufficient data. Collect at least 20 days of sales.",
            "model_info":                 {"kmeans_k": 4, "dbscan_outliers_pct": 0},
        }

    features, enriched_df = _build_segment_features(df, product)

    # K-Means
    cluster_labels, scaler, km = _kmeans_cluster(features, k=4)

    # DBSCAN outliers
    is_impulse = _dbscan_outliers(features)
    impulse_pct = round(float(is_impulse.mean() * 100), 1)

    # Assign semantic labels — avoid duplicate assignments
    used_labels = set()
    cluster_to_label = {}
    cluster_ids = list(range(4))

    for cid in cluster_ids:
        mask = cluster_labels == cid
        if mask.sum() == 0:
            continue
        cluster_feat_df = features[mask].copy()
        label = _assign_segment_label(cluster_feat_df, features)
        # Ensure unique labels
        if label in used_labels:
            remaining = [l for l in SEGMENT_NAMES if l not in used_labels]
            label = remaining[0] if remaining else label
        used_labels.add(label)
        cluster_to_label[cid] = label

    # Build segment result
    segments = []
    label_counts = {}
    total_days = len(df)

    for cid, label in cluster_to_label.items():
        mask = cluster_labels == cid
        cluster_feat_df = features[mask].copy()
        stats = _segment_stats(cluster_feat_df, enriched_df, label, total_days)
        segments.append(stats)
        label_counts[label] = stats["day_count"]

    # Sort by size descending
    segments.sort(key=lambda s: s["size_pct"], reverse=True)

    dominant = segments[0]["name"] if segments else "LOYAL_CUSTOMERS"

    # Personalization insight
    dominant_defn = SEGMENT_DEFINITIONS.get(dominant, {})
    insights = (
        f"Your customer base is dominated by {dominant} ({segments[0]['size_pct']}% of days). "
        f"{dominant_defn.get('recommended_strategy', '')}"
    )

    return {
        "segments":               segments,
        "dominant_segment":       dominant,
        "impulse_days_pct":       impulse_pct,
        "personalization_insights": insights,
        "model_info": {
            "kmeans_k":               4,
            "dbscan_outliers_pct":    impulse_pct,
            "features_used":          list(features.columns),
        },
    }
