import React, { useState, useEffect } from 'react';
import API from '../api/client';
import { useProduct } from '../context/ProductContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Legend
} from 'recharts';

export default function Analytics() {
  const { activeProduct } = useProduct();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const productId = activeProduct?.id || 'vs-essential-cotton-tee';

  useEffect(() => {
    setLoading(true);
    API.get(`/api/analytics/${productId}`)
      .then(res => {
        setAnalytics(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productId]);

  const ttStyle = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    color: '#0F172A',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    fontSize: '0.82rem',
  };
  const axisStyle = { stroke: '#D4DDD3', fontSize: 11, fill: '#0A1F14' };
  const gridStyle = { strokeDasharray: '3 3', stroke: '#E6EDE5' };
  const accentColor = '#6366f1';

  if (loading) return (
    <div className="main-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '48px 0' }}>
        <div className="spinner" style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Loading analytics…
      </div>
    </div>
  );

  if (!analytics) return (
    <div className="main-content">
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Historical trends, demand analysis, and elasticity curves</p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        No analytics data available
      </div>
    </div>
  );

  const { price_trend, elasticity, revenue, heatmap, competitor_comparison } = analytics;

  return (
    <div className="main-content">
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Historical trends, demand analysis, and elasticity curves for {activeProduct?.name || 'selected product'}</p>
      </div>

      <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 20 }}>
        {/* Chart 1: Price Trend */}
        <div className="card chart-card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
            Price Trend (90 Days)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={price_trend}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} interval={10} />
              <YAxis {...axisStyle} label={{ value: 'Price (₹)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={ttStyle} />
              <Legend />
              <Line type="monotone" dataKey="price" stroke={accentColor} strokeWidth={2.5} dot={false} name="Vouge Studio" />
              <Line type="monotone" dataKey="competitor_avg" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Competitor Average" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Elasticity Curve */}
        <div className="card chart-card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
            Elasticity Curve
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={elasticity.curve}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="price" {...axisStyle} label={{ value: 'Price (₹)', position: 'insideBottom' }} />
              <YAxis {...axisStyle} label={{ value: 'Expected Demand (units)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={ttStyle} />
              <ReferenceLine x={elasticity.current_price} stroke="#6366f1" strokeDasharray="3 3" label={{ value: 'Current', position: 'top' }} />
              <ReferenceLine x={elasticity.recommended_price} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Recommended', position: 'top' }} />
              <Line type="monotone" dataKey="demand" stroke={accentColor} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Revenue by Day */}
        <div className="card chart-card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
            Revenue by Day (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenue.data}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} interval={5} />
              <YAxis {...axisStyle} label={{ value: 'Revenue (₹)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={ttStyle} />
              <ReferenceLine y={revenue.average} stroke="#64748b" strokeDasharray="3 3" label={{ value: `Avg: ₹${revenue.average.toFixed(0)}`, position: 'right' }} />
              <Bar dataKey="revenue" fill={(entry) => entry.revenue >= revenue.average ? '#6366f1' : '#94a3b8'} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Weekly Demand Heatmap */}
        <div className="card chart-card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
            Weekly Demand Heatmap (91 Days)
          </h3>
          <WeeklyHeatmap data={heatmap} accentColor={accentColor} />
        </div>

        {/* Chart 5: Competitor Comparison */}
        <div className="card chart-card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
            Competitor Price Comparison
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={competitor_comparison} layout="horizontal">
              <CartesianGrid {...gridStyle} />
              <XAxis type="number" {...axisStyle} label={{ value: 'Price (₹)', position: 'insideBottom' }} />
              <YAxis dataKey="platform" type="category" {...axisStyle} width={100} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="price" fill={(entry) => entry.is_vouge ? accentColor : '#94a3b8'} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Sorted by price ascending. Vouge Studio highlighted in accent color.
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyHeatmap({ data, accentColor }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Find max units for color scaling
  const maxUnits = Math.max(...data.map(d => d.units), 1);
  
  // Color intensity levels (5 levels)
  const getColor = (units) => {
    const intensity = units / maxUnits;
    if (intensity === 0) return '#f1f5f9';
    if (intensity < 0.2) return '#e0e7ff';
    if (intensity < 0.4) return '#c7d2fe';
    if (intensity < 0.6) return '#a5b4fc';
    if (intensity < 0.8) return '#818cf8';
    return accentColor;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
        {/* Header row */}
        <div></div>
        {days.map(day => (
          <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
            {day}
          </div>
        ))}
        
        {/* Data rows */}
        {Array.from({ length: 13 }, (_, week) => (
          <React.Fragment key={week}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>
              W{week + 1}
            </div>
            {days.map((_, dow) => {
              const cell = data.find(d => d.week === week && d.day_of_week === dow);
              const units = cell?.units || 0;
              return (
                <div
                  key={`${week}-${dow}`}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    backgroundColor: getColor(units),
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    color: units > maxUnits * 0.6 ? '#fff' : '#475569',
                    fontWeight: 500,
                  }}
                  title={`${units} units`}
                >
                  {units > 0 && Math.round(units)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: '#64748b' }}>
        <span>Low demand</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((level, i) => (
          <div
            key={i}
            style={{
              width: 20,
              height: 20,
              backgroundColor: getColor(level * maxUnits),
              borderRadius: 3,
              border: '1px solid #e2e8f0'
            }}
          />
        ))}
        <span>High demand</span>
      </div>
    </div>
  );
}
