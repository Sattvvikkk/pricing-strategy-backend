import { useState, useEffect } from 'react';
import { useProduct } from '../context/ProductContext';
import API from '../api/client';
import {
  Package, Tag, Ruler, Shirt, Droplets, Palette,
  ExternalLink, ChevronRight, Loader2
} from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ProductDetails() {
  const { activeProduct } = useProduct();
  const [salesHistory, setSalesHistory] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const productId = activeProduct?.id || 'vs-essential-cotton-tee';

  useEffect(() => {
    if (activeProduct) {
      setLoadingSales(true);
      API.get(`/api/products/${productId}/sales-history`)
        .then(res => {
          setSalesHistory(res.data.data);
          setLoadingSales(false);
        })
        .catch(() => setLoadingSales(false));
    }
  }, [productId, activeProduct]);

  if (!activeProduct && loadingSales) {
    return (
      <div className="main-content">
        <div className="loading-center">
          <Loader2 size={28} className="spinning" />
          <p>Loading product details…</p>
        </div>
      </div>
    );
  }

  if (!activeProduct) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <Package size={48} strokeWidth={1} />
          <h3>No Product Selected</h3>
          <p>Select a product from the sidebar or paste a product URL to get started.</p>
        </div>
      </div>
    );
  }

  const p = activeProduct;
  const specs = p.specifications || {};
  const sizeChart = p.size_chart || {};
  const sizes = p.sizes || Object.keys(sizeChart);
  const stock = p.stock || 300;

  // Calculate gross margin percentage
  const grossMargin = p.cost_price > 0 ? ((p.price - p.cost_price) / p.price) * 100 : 0;
  const marginColor = grossMargin >= 40 ? '#10b981' : grossMargin >= 25 ? '#f59e0b' : '#ef4444';
  const marginLabel = grossMargin >= 40 ? 'HIGH' : grossMargin >= 25 ? 'MEDIUM' : 'LOW';

  // Stock level badge
  const stockLevel = stock >= 350 ? 'HIGH STOCK' : stock >= 100 ? 'MEDIUM STOCK' : 'LOW STOCK';
  const stockColor = stock >= 350 ? '#10b981' : stock >= 100 ? '#f59e0b' : '#ef4444';

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

  return (
    <div className="main-content">
      <div className="page-header">
        <h2>Product Details</h2>
        <p>Complete specifications and pricing data for the active product</p>
      </div>

      {/* Product Identity Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Placeholder Image */}
          <div style={{
            width: 120,
            height: 120,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '3rem',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {(p.brand || 'V')[0].toUpperCase()}
          </div>

          {/* Product Info */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 20,
              background: '#e0e7ff',
              color: '#4338ca',
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: 8,
            }}>
              {p.brand}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {p.name}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
              {p.category}
            </p>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span><Tag size={14} style={{ display: 'inline', marginRight: 4 }} /> SKU: {p.sku}</span>
              <span><Package size={14} style={{ display: 'inline', marginRight: 4 }} /> Stock: {stock} units</span>
            </div>
          </div>

          {/* Stock Badge */}
          <div style={{
            padding: '8px 16px',
            borderRadius: 20,
            background: `${stockColor}20`,
            color: stockColor,
            fontSize: '0.85rem',
            fontWeight: 700,
            border: `2px solid ${stockColor}`,
          }}>
            {stockLevel}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Pricing Information
        </h3>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            ₹{p.price}
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
            Cost: ₹{p.cost_price}
          </div>
          <div style={{
            padding: '6px 14px',
            borderRadius: 20,
            background: `${marginColor}20`,
            color: marginColor,
            fontSize: '0.85rem',
            fontWeight: 700,
            border: `1px solid ${marginColor}`,
          }}>
            Gross Margin: {grossMargin.toFixed(1)}% ({marginLabel})
          </div>
        </div>
      </div>

      {/* Specifications Table */}
      {Object.keys(specs).length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            <Ruler size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Specifications
          </h3>
          <table className="data-table">
            <tbody>
              {Object.entries(specs).map(([key, val]) => (
                <tr key={key}>
                  <td style={{ fontWeight: 600, color: 'var(--text-secondary)', width: '40%' }}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td style={{ color: 'var(--text-primary)' }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sizes */}
      {sizes.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            <Shirt size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Available Sizes
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sizes.map(s => (
              <span key={s} style={{
                padding: '8px 16px',
                borderRadius: 20,
                background: '#f1f5f9',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid #e2e8f0',
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sales History Chart */}
      <div className="card chart-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Sales History (Last 90 Days)
        </h3>
        {loadingSales ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading sales history…
          </div>
        ) : salesHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={salesHistory}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} interval={10} />
              <YAxis yAxisId="left" {...axisStyle} label={{ value: 'Units Sold', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" {...axisStyle} orientation="right" label={{ value: 'Revenue (₹)', angle: 90, position: 'insideRight' }} />
              <Tooltip contentStyle={ttStyle} />
              <Legend />
              <Bar yAxisId="right" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue (₹)" opacity={0.6} />
              <Line yAxisId="left" type="monotone" dataKey="units_sold" stroke="#10b981" strokeWidth={2.5} dot={false} name="Units Sold" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No sales history data available
          </div>
        )}
      </div>

      {/* Care Instructions */}
      {p.care && p.care.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            <Droplets size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Care Instructions
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {p.care.map((c, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, color: 'var(--text-secondary)' }}>
                <ChevronRight size={13} style={{ marginTop: 2, color: 'var(--accent)' }} />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Available Colors */}
      {p.available_colors && p.available_colors.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
            <Palette size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Available Colors
          </h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {p.available_colors.map(c => (
              <span key={c} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                background: '#f1f5f9',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 500,
                border: c.toLowerCase() === (specs.color || '').toLowerCase() ? '2px solid #6366f1' : '1px solid #e2e8f0',
              }}>
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: getColorHex(c),
                  border: '1px solid rgba(0,0,0,0.1)',
                }} />
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getColorHex(name) {
  const map = {
    white: '#f0f0f0', black: '#1a1a1a', grey: '#888', gray: '#888',
    red: '#e74c3c', blue: '#3498db', green: '#27ae60', yellow: '#f1c40f',
    navy: '#2c3e50', brown: '#8b4513', pink: '#e84393', beige: '#d2b48c',
    cream: '#fffdd0', olive: '#808000', teal: '#008080', charcoal: '#36454f',
    burgundy: '#800020', purple: '#8e44ad', plum: '#8e4585', orange: '#e67e22',
    'dark plum purple': '#8e4585', 'forest green': '#228b22', 'light blue': '#87ceeb',
  };
  const key = name.toLowerCase();
  return map[key] || '#888';
}
