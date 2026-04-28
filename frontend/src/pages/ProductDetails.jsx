import { useProduct } from '../context/ProductContext';
import {
  Package, Tag, Ruler, Shirt, Droplets, Palette,
  ExternalLink, ChevronRight, Loader2
} from 'lucide-react';

export default function ProductDetails() {
  const { activeProduct, detailLoading } = useProduct();

  if (detailLoading) {
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
  const sizes = Object.keys(sizeChart);

  return (
    <div className="main-content">
      <div className="page-header">
        <h2>Product Details</h2>
        <p>Complete specifications and pricing data for the active product</p>
      </div>

      {/* Hero Card */}
      <div className="product-hero">
        <div className="product-hero-image">
          {p.image ? (
            <img src={p.image} alt={p.name} />
          ) : (
            <div className="product-hero-placeholder">
              <Shirt size={64} strokeWidth={1} />
            </div>
          )}
        </div>
        <div className="product-hero-info">
          <div className="product-hero-brand">{p.brand}</div>
          <h2 className="product-hero-name">{p.name}</h2>
          <p className="product-hero-desc">{p.description}</p>
          <div className="product-hero-price">
            <span className="hero-price">₹{p.price}</span>
            {p.cost_price > 0 && (
              <span className="hero-cost">Cost: ₹{p.cost_price} • Margin: {Math.round((1 - p.cost_price / p.price) * 100)}%</span>
            )}
          </div>
          <div className="product-hero-meta">
            <span className="meta-pill"><Tag size={12} /> {p.category}</span>
            <span className="meta-pill"><Package size={12} /> SKU: {p.sku}</span>
            {p.concept && <span className="meta-pill">{p.concept}</span>}
          </div>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="product-link">
              View on {p.brand} <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      <div className="product-grid">
        {/* Specifications */}
        {Object.keys(specs).length > 0 && (
          <div className="card product-section">
            <h3 className="section-title"><Ruler size={16} /> Specifications</h3>
            <div className="specs-grid">
              {Object.entries(specs).map(([key, val]) => (
                <div key={key} className="spec-row">
                  <span className="spec-key">{key.replace(/_/g, ' ')}</span>
                  <span className="spec-val">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Size Chart */}
        {sizes.length > 0 && (
          <div className="card product-section">
            <h3 className="section-title"><Shirt size={16} /> Size Chart</h3>
            <table className="data-table size-table">
              <thead>
                <tr>
                  <th>Size</th>
                  {sizeChart[sizes[0]] && Object.keys(sizeChart[sizes[0]]).map(dim => (
                    <th key={dim}>{dim.charAt(0).toUpperCase() + dim.slice(1)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map(sz => (
                  <tr key={sz}>
                    <td style={{ fontWeight: 600 }}>{sz}</td>
                    {Object.values(sizeChart[sz]).map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {p.sizes && (
              <div className="available-sizes">
                <span className="sizes-label">Available:</span>
                {p.sizes.map(s => (
                  <span key={s} className="size-chip">{s}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Care Instructions */}
        {p.care && p.care.length > 0 && (
          <div className="card product-section">
            <h3 className="section-title"><Droplets size={16} /> Care Instructions</h3>
            <ul className="care-list">
              {p.care.map((c, i) => (
                <li key={i}>
                  <ChevronRight size={13} className="care-icon" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Available Colors */}
        {p.available_colors && p.available_colors.length > 0 && (
          <div className="card product-section">
            <h3 className="section-title"><Palette size={16} /> Available Colors</h3>
            <div className="color-chips">
              {p.available_colors.map(c => (
                <span
                  key={c}
                  className={`color-chip ${c.toLowerCase() === (specs.color || '').toLowerCase() ? 'active-color' : ''}`}
                >
                  <span
                    className="color-dot"
                    style={{ background: getColorHex(c) }}
                  />
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
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
