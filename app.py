"""
AI-Driven Dynamic Pricing Dashboard — Streamlit App
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import os, sys, base64

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import *
from database import init_db, is_db_populated, insert_sales_bulk, insert_competitor_bulk, insert_product, get_sales_history, get_competitor_data
from modules.dataset_generator import generate_sales_data
from modules.competitor_data import generate_competitor_data, get_competitor_summary
from modules.data_processing import process_data, get_latest_features
from modules.demand_forecasting import forecast_demand
from modules.pricing_engine import compute_recommendation, scenario_recommendation
from modules.price_tracker import compute_price_metrics, compute_daily_volatility
from modules.ai_explanation import generate_explanation

# ── Page Config ──────────────────────────────────────────────────────────────
st.set_page_config(page_title="Dynamic Pricing Engine", page_icon="📊", layout="wide")

# ── Custom CSS ───────────────────────────────────────────────────────────────
st.markdown("""<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
html, body, [class*="st-"] { font-family: 'Inter', sans-serif; }
.stApp { background: linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%); }
.main .block-container { padding-top: 2rem; max-width: 1200px; }
div[data-testid="stMetric"] {
    background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
    padding: 20px 24px; backdrop-filter: blur(10px);
}
div[data-testid="stMetric"] label { color: rgba(255,255,255,0.6) !important; font-size: 0.85rem !important; }
div[data-testid="stMetric"] [data-testid="stMetricValue"] { color: #fff !important; font-size: 1.8rem !important; font-weight: 700 !important; }
.action-increase { background: linear-gradient(135deg, #00b894, #00cec9); color: #fff; padding: 6px 20px; border-radius: 25px; font-weight: 700; display: inline-block; }
.action-decrease { background: linear-gradient(135deg, #e17055, #d63031); color: #fff; padding: 6px 20px; border-radius: 25px; font-weight: 700; display: inline-block; }
.action-hold { background: linear-gradient(135deg, #fdcb6e, #f39c12); color: #1a1a2e; padding: 6px 20px; border-radius: 25px; font-weight: 700; display: inline-block; }
.explanation-box {
    background: linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,206,201,0.08));
    border-left: 4px solid #6c5ce7; border-radius: 12px; padding: 20px 24px;
    color: rgba(255,255,255,0.9); line-height: 1.7; font-size: 0.95rem;
}
.product-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 24px;
    backdrop-filter: blur(12px);
}
h1, h2, h3 { color: #fff !important; }
.stTabs [data-baseweb="tab-list"] { gap: 8px; }
.stTabs [data-baseweb="tab"] {
    background: rgba(255,255,255,0.05); border-radius: 10px; color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.08); padding: 8px 20px;
}
.stTabs [aria-selected="true"] {
    background: linear-gradient(135deg, #6c5ce7, #a29bfe) !important; color: #fff !important;
}
</style>""", unsafe_allow_html=True)

# ── Data Loading ─────────────────────────────────────────────────────────────
@st.cache_data
def load_data():
    init_db()
    if not is_db_populated():
        sales_df = generate_sales_data()
        comp_df = generate_competitor_data()
        insert_sales_bulk(sales_df)
        insert_competitor_bulk(comp_df)
        insert_product(PRODUCT_NAME, BASE_PRICE, COST_PRICE, BASE_PRICE)
    sales_df = get_sales_history()
    comp_df = get_competitor_data()
    processed = process_data(sales_df, comp_df)
    features = get_latest_features(processed)
    forecast_df = forecast_demand(processed)
    avg_forecast = float(forecast_df["yhat"].mean())
    rec = compute_recommendation(features, processed, avg_forecast)
    metrics = compute_price_metrics(processed)
    explanation = generate_explanation(rec, features, metrics)
    return sales_df, comp_df, processed, features, forecast_df, rec, metrics, explanation

sales_df, comp_df, processed, features, forecast_df, rec, metrics, explanation = load_data()

# ── Plot Theme ───────────────────────────────────────────────────────────────
PLOT_LAYOUT = dict(
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
    font=dict(color="rgba(255,255,255,0.8)", family="Inter"),
    xaxis=dict(gridcolor="rgba(255,255,255,0.06)", showline=False),
    yaxis=dict(gridcolor="rgba(255,255,255,0.06)", showline=False),
    margin=dict(l=40, r=20, t=40, b=40), legend=dict(bgcolor="rgba(0,0,0,0)"),
)

# ── Header ───────────────────────────────────────────────────────────────────
col_title, col_badge = st.columns([4, 1])
with col_title:
    st.markdown("# 📊 Dynamic Pricing Engine")
    st.markdown("<span style='color:rgba(255,255,255,0.5);font-size:0.95rem;'>AI-powered pricing for your D2C brand</span>", unsafe_allow_html=True)
with col_badge:
    action_class = f"action-{rec['action'].lower()}"
    st.markdown(f"<div style='text-align:right;padding-top:30px;'><span class='{action_class}'>{rec['action'].upper()}</span></div>", unsafe_allow_html=True)

st.markdown("---")

# ── Product Card + Recommendation ────────────────────────────────────────────
col_prod, col_rec = st.columns([1, 2])
with col_prod:
    img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "product_image.png")
    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()
        st.markdown(f"""<div class='product-card' style='text-align:center;'>
            <img src='data:image/png;base64,{img_b64}' style='width:160px;border-radius:12px;margin-bottom:12px;'/>
            <h3 style='margin:0;font-size:1.1rem;'>{PRODUCT_NAME}</h3>
            <p style='color:rgba(255,255,255,0.5);font-size:0.85rem;margin:4px 0 0;'>Premium D2C Collection</p>
        </div>""", unsafe_allow_html=True)
    else:
        st.markdown(f"<div class='product-card'><h3>{PRODUCT_NAME}</h3></div>", unsafe_allow_html=True)

with col_rec:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Current Price", f"₹{features['current_price']:.0f}")
    c2.metric("Recommended", f"₹{rec['recommended_price']:.0f}",
              delta=f"₹{rec['recommended_price']-features['current_price']:.0f}")
    c3.metric("Revenue Impact", f"{rec['revenue_impact_pct']:+.1f}%")
    c4.metric("Price Index", f"{features['price_index']:.2f}")

    st.markdown("")
    k1, k2, k3, k4 = st.columns(4)
    monthly_rev = processed["revenue"].tail(30).sum()
    k1.metric("Monthly Revenue", f"₹{monthly_rev:,.0f}")
    k2.metric("Avg Daily Demand", f"{features['demand_ma_7']:.0f} units")
    k3.metric("Volatility (σ)", f"₹{metrics['volatility']:.0f}")
    k4.metric("Price Trend", metrics["trend_direction"])

# ── AI Explanation ───────────────────────────────────────────────────────────
st.markdown("")
st.markdown(f"<div class='explanation-box'>🧠 <b>AI Insight:</b> {explanation}</div>", unsafe_allow_html=True)
st.markdown("")

# ── Charts ───────────────────────────────────────────────────────────────────
tab1, tab2, tab3, tab4, tab5 = st.tabs(["📈 Price Trend", "📊 Demand vs Price", "🏪 Competitor Analysis", "💰 Revenue", "🔮 Forecast"])

with tab1:
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=processed["date"], y=processed["price"], mode="lines",
        name="Our Price", line=dict(color="#6c5ce7", width=2.5),
        fill="tozeroy", fillcolor="rgba(108,92,231,0.1)"))
    fig.add_trace(go.Scatter(x=processed["date"], y=processed["price_ma_14"], mode="lines",
        name="14-Day MA", line=dict(color="#00cec9", width=2, dash="dash")))
    fig.add_hline(y=rec["recommended_price"], line_dash="dot", line_color="#00b894",
        annotation_text=f"Recommended: ₹{rec['recommended_price']}")
    fig.update_layout(**PLOT_LAYOUT, title="Price Over Time", height=420)
    st.plotly_chart(fig, use_container_width=True)

with tab2:
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=processed["price"], y=processed["units_sold"],
        mode="markers", marker=dict(color=processed["revenue"], colorscale="Viridis",
        size=8, showscale=True, colorbar=dict(title="Revenue")),
        name="Daily Sales", text=[f"Date: {d}" for d in processed["date"].dt.strftime("%Y-%m-%d")]))
    # Trend line
    z = np.polyfit(processed["price"], processed["units_sold"], 1)
    p = np.poly1d(z)
    x_line = np.linspace(processed["price"].min(), processed["price"].max(), 100)
    fig2.add_trace(go.Scatter(x=x_line, y=p(x_line), mode="lines",
        name="Trend", line=dict(color="#e17055", width=2, dash="dash")))
    fig2.update_layout(**PLOT_LAYOUT, title="Demand vs Price", height=420,
        xaxis_title="Price (₹)", yaxis_title="Units Sold")
    st.plotly_chart(fig2, use_container_width=True)

with tab3:
    comp_avg = comp_df.groupby(["date", "brand"])["price"].mean().reset_index()
    comp_avg["date"] = pd.to_datetime(comp_avg["date"])
    fig3 = go.Figure()
    colors = {"H&M": "#ff7675", "Zara": "#74b9ff", "Uniqlo": "#55efc4", "Amazon Basics": "#ffeaa7"}
    for brand in comp_avg["brand"].unique():
        bdf = comp_avg[comp_avg["brand"] == brand]
        fig3.add_trace(go.Scatter(x=bdf["date"], y=bdf["price"], mode="lines",
            name=brand, line=dict(color=colors.get(brand, "#ddd"), width=1.5)))
    fig3.add_trace(go.Scatter(x=processed["date"], y=processed["price"], mode="lines",
        name="Our Price", line=dict(color="#6c5ce7", width=3)))
    fig3.update_layout(**PLOT_LAYOUT, title="Competitor vs Our Price", height=420)
    st.plotly_chart(fig3, use_container_width=True)

    st.markdown("##### Latest Competitor Snapshot")
    snap = get_competitor_summary(comp_df)
    snap.columns = ["Brand", "Price (₹)", "Rating", "Discount (%)"]
    st.dataframe(snap, use_container_width=True, hide_index=True)

with tab4:
    fig4 = go.Figure()
    fig4.add_trace(go.Scatter(x=processed["date"], y=processed["revenue"], mode="lines",
        name="Daily Revenue", line=dict(color="#00cec9", width=1.5),
        fill="tozeroy", fillcolor="rgba(0,206,201,0.08)"))
    fig4.add_trace(go.Scatter(x=processed["date"], y=processed["revenue_ma_7"], mode="lines",
        name="7-Day MA", line=dict(color="#fdcb6e", width=2.5)))
    fig4.update_layout(**PLOT_LAYOUT, title="Revenue Trend", height=420,
        yaxis_title="Revenue (₹)")
    st.plotly_chart(fig4, use_container_width=True)

with tab5:
    fig5 = go.Figure()
    last_14 = processed.tail(14)
    fig5.add_trace(go.Scatter(x=last_14["date"], y=last_14["units_sold"], mode="lines+markers",
        name="Actual", line=dict(color="#6c5ce7", width=2)))
    fig5.add_trace(go.Scatter(x=forecast_df["ds"], y=forecast_df["yhat"], mode="lines+markers",
        name="Forecast", line=dict(color="#00b894", width=2, dash="dash")))
    fig5.add_trace(go.Scatter(x=forecast_df["ds"], y=forecast_df["yhat_upper"],
        mode="lines", line=dict(width=0), showlegend=False))
    fig5.add_trace(go.Scatter(x=forecast_df["ds"], y=forecast_df["yhat_lower"],
        mode="lines", line=dict(width=0), fill="tonexty",
        fillcolor="rgba(0,184,148,0.15)", name="Confidence"))
    fig5.update_layout(**PLOT_LAYOUT, title="14-Day Demand Forecast", height=420,
        yaxis_title="Predicted Units Sold")
    st.plotly_chart(fig5, use_container_width=True)

st.markdown("---")

# ── Scenario Testing & Static vs Dynamic ─────────────────────────────────────
col_sc, col_sd = st.columns(2)

with col_sc:
    st.markdown("### 🧪 Scenario Testing")
    demand_delta = st.slider("Demand change (%)", -50, 100, 0, 5, key="dem_slider")
    comp_delta = st.slider("Competitor price change (%)", -30, 30, 0, 5, key="comp_slider")
    if demand_delta != 0 or comp_delta != 0:
        avg_fc = float(forecast_df["yhat"].mean())
        sc = scenario_recommendation(features, processed, avg_fc, demand_delta, comp_delta)
        sc1, sc2, sc3 = st.columns(3)
        sc1.metric("Scenario Price", f"₹{sc['recommended_price']:.0f}")
        sc2.metric("Action", sc["action"])
        sc3.metric("Rev. Impact", f"{sc['revenue_impact_pct']:+.1f}%")
    else:
        st.info("Move the sliders to simulate a what-if scenario.")

with col_sd:
    st.markdown("### ⚡ Static vs Dynamic Pricing")
    static_rev = BASE_PRICE * processed["units_sold"].sum()
    dynamic_rev = processed["revenue"].sum()
    lift = ((dynamic_rev - static_rev) / static_rev) * 100
    fig6 = go.Figure()
    fig6.add_trace(go.Bar(x=["Static (₹799)"], y=[static_rev],
        marker_color="rgba(255,255,255,0.15)", name="Static", text=[f"₹{static_rev:,.0f}"],
        textposition="auto", textfont=dict(color="#fff")))
    fig6.add_trace(go.Bar(x=["Dynamic"], y=[dynamic_rev],
        marker_color="#6c5ce7", name="Dynamic", text=[f"₹{dynamic_rev:,.0f}"],
        textposition="auto", textfont=dict(color="#fff")))
    fig6.update_layout(**PLOT_LAYOUT, title="Total Revenue Comparison", height=350,
        showlegend=False, yaxis_title="Revenue (₹)")
    st.plotly_chart(fig6, use_container_width=True)
    if lift >= 0:
        st.success(f"Dynamic pricing generated **{lift:.1f}%** more revenue!")
    else:
        st.warning(f"Dynamic pricing generated **{lift:.1f}%** less revenue.")

# ── Footer ───────────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown("<p style='text-align:center;color:rgba(255,255,255,0.3);font-size:0.8rem;'>AI-Driven Dynamic Pricing Engine • Built with Streamlit & Python</p>", unsafe_allow_html=True)
