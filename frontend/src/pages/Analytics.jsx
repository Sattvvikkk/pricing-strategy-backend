import { useState, useEffect } from 'react';
import API from '../api/client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, AreaChart, Area
} from 'recharts';

export default function Analytics() {
  const [priceTrend, setPriceTrend] = useState([]);
  const [demandPrice, setDemandPrice] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [elasticity, setElasticity] = useState([]);
  const [compData, setCompData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get('/api/analytics/price-trend'),
      API.get('/api/analytics/demand-price'),
      API.get('/api/analytics/revenue'),
      API.get('/api/analytics/elasticity'),
      API.get('/api/analytics/competitor-comparison'),
    ]).then(([pt, dp, rv, el, comp]) => {
      setPriceTrend(pt.data.data.map(d => ({ ...d, date: d.date.slice(5) })));
      setDemandPrice(dp.data.data);
      setRevenue(rv.data.data.map(d => ({ ...d, date: d.date.slice(5) })));
      setElasticity(el.data.data);
      setCompData(comp.data.data.map(d => ({ ...d, date: d.date?.slice(5) })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const ttStyle = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    color: '#0F172A',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    fontSize: '0.82rem',
  };
  const axisStyle = { stroke: '#CBD5E1', fontSize: 11 };
  const gridStyle = { strokeDasharray: '3 3', stroke: 'rgba(0,0,0,0.05)' };

  if (loading) return <div className="main-content"><p style={{ color: 'var(--text-secondary)' }}>Loading analytics...</p></div>;

  return (
    <div className="main-content">
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Historical trends, demand analysis, and elasticity curves</p>
      </div>

      <div className="chart-grid">
        {/* Price Trend */}
        <div className="card chart-card">
          <h3 style={{fontSize:'0.9rem',fontWeight:700,color:'var(--text-primary)',marginBottom:18,display:'flex',alignItems:'center',gap:7}}>
            <span style={{color:'var(--accent)'}}>↗</span> Price vs Time
            <span style={{marginLeft:'auto',fontSize:'0.72rem',fontWeight:500,color:'var(--text-muted)'}}>6 months</span>
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={priceTrend}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} interval={20} />
              <YAxis {...axisStyle} />
              <Tooltip contentStyle={ttStyle} />
              <Line type="monotone" dataKey="price" stroke="#7F56D9" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="price_ma_14" stroke="#0086C9" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Demand vs Price */}
        <div className="card chart-card">
          <h3 style={{fontSize:'0.9rem',fontWeight:700,color:'var(--text-primary)',marginBottom:18,display:'flex',alignItems:'center',gap:7}}>
            <span style={{color:'var(--accent)'}}>◉</span> Demand vs Price
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="price" name="Price" {...axisStyle} />
              <YAxis dataKey="units_sold" name="Units Sold" {...axisStyle} />
              <Tooltip contentStyle={ttStyle} />
              <Scatter data={demandPrice} fill="#7F56D9" opacity={0.55} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Trend */}
        <div className="card chart-card">
          <h3 style={{fontSize:'0.9rem',fontWeight:700,color:'var(--text-primary)',marginBottom:18,display:'flex',alignItems:'center',gap:7}}>
            <span style={{color:'var(--green)'}}>₹</span> Revenue Trend
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenue}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} interval={20} />
              <YAxis {...axisStyle} />
              <Tooltip contentStyle={ttStyle} />
              <Area type="monotone" dataKey="revenue" fill="rgba(3,152,85,0.08)" stroke="#039855" strokeWidth={1.5} />
              <Line type="monotone" dataKey="revenue_ma_7" stroke="#B54708" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Elasticity Curve */}
        <div className="card chart-card">
          <h3 style={{fontSize:'0.9rem',fontWeight:700,color:'var(--text-primary)',marginBottom:18,display:'flex',alignItems:'center',gap:7}}>
            <span style={{color:'var(--red)'}}>⌁</span> Elasticity Curve
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={elasticity}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="price" {...axisStyle} />
              <YAxis yAxisId="left" {...axisStyle} />
              <YAxis yAxisId="right" orientation="right" {...axisStyle} />
              <Tooltip contentStyle={ttStyle} />
              <Line yAxisId="left" type="monotone" dataKey="demand" stroke="#7F56D9" strokeWidth={2.5} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#039855" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Competitor Comparison */}
      {compData.length > 0 && (
        <div className="card chart-card">
          <h3 style={{fontSize:'0.9rem',fontWeight:700,color:'var(--text-primary)',marginBottom:18,display:'flex',alignItems:'center',gap:7}}>
            <span style={{color:'var(--accent)'}}>⊞</span> Competitor Price Comparison
            <span style={{marginLeft:'auto',fontSize:'0.72rem',fontWeight:500,color:'var(--text-muted)'}}>over time</span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={compData}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} interval={20} />
              <YAxis {...axisStyle} />
              <Tooltip contentStyle={ttStyle} />
              <Line type="monotone" dataKey="our_price" stroke="#7F56D9" strokeWidth={3} dot={false} name="Our Price" />
              <Line type="monotone" dataKey="Amazon" stroke="#FF9900" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Flipkart" stroke="#2874F0" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Myntra" stroke="#FF3F6C" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Ajio" stroke="#7C3AED" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
