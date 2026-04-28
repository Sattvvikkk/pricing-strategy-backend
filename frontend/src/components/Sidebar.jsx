import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useProduct } from '../context/ProductContext';
import {
  LayoutDashboard, BarChart3, Store, ChevronDown,
  Link2, Search, Package, Loader2, X, ShoppingBag, Info, Radar
} from 'lucide-react';

export default function Sidebar() {
  const {
    catalog, activeProduct, selectProduct,
    urlInput, setUrlInput, urlError, lookupByUrl, loading
  } = useProduct();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    lookupByUrl(urlInput);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>⬡ <span className="logo-dot">Price</span>Engine</h1>
        <span>AI-Driven Pricing SaaS</span>
      </div>

      {/* ── Product Selector ─────────────────────────────────── */}
      <div className="product-selector">
        <div className="product-selector-label">
          <ShoppingBag size={13} />
          <span>ACTIVE PRODUCT</span>
        </div>

        <button
          className="product-selector-btn"
          onClick={() => setSelectorOpen(!selectorOpen)}
          id="product-selector-toggle"
        >
          {activeProduct ? (
            <div className="product-selector-active">
              {activeProduct.image && (
                <img src={activeProduct.image} alt="" className="product-thumb" />
              )}
              <div className="product-selector-info">
                <span className="product-name">{activeProduct.name}</span>
                <span className="product-brand">{activeProduct.brand} • ₹{activeProduct.price}</span>
              </div>
            </div>
          ) : (
            <span className="product-placeholder">Select a product…</span>
          )}
          <ChevronDown size={14} className={`chevron ${selectorOpen ? 'open' : ''}`} />
        </button>

        {selectorOpen && (
          <div className="product-dropdown">
            {/* Tab Toggle */}
            <div className="dropdown-tabs">
              <button
                className={`dropdown-tab ${!urlMode ? 'active' : ''}`}
                onClick={() => setUrlMode(false)}
              >
                <Package size={13} /> Catalog
              </button>
              <button
                className={`dropdown-tab ${urlMode ? 'active' : ''}`}
                onClick={() => setUrlMode(true)}
              >
                <Link2 size={13} /> Paste URL
              </button>
            </div>

            {urlMode ? (
              <form onSubmit={handleUrlSubmit} className="url-form">
                <div className="url-input-wrap">
                  <Search size={14} className="url-icon" />
                  <input
                    type="text"
                    placeholder="Paste product URL..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="url-input"
                    id="product-url-input"
                    autoFocus
                  />
                  {urlInput && (
                    <button type="button" className="url-clear" onClick={() => setUrlInput('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button type="submit" className="url-submit" disabled={loading || !urlInput.trim()}>
                  {loading ? <Loader2 size={14} className="spinning" /> : 'Analyze'}
                </button>
                {urlError && <p className="url-error">{urlError}</p>}
              </form>
            ) : (
              <div className="catalog-list">
                {catalog.map(p => (
                  <button
                    key={p.id}
                    className={`catalog-item ${activeProduct?.id === p.id ? 'selected' : ''}`}
                    onClick={() => { selectProduct(p.id); setSelectorOpen(false); }}
                  >
                    {p.image && <img src={p.image} alt="" className="catalog-thumb" />}
                    <div className="catalog-item-info">
                      <span className="catalog-item-name">{p.name}</span>
                      <span className="catalog-item-meta">{p.brand} • ₹{p.price}</span>
                    </div>
                    {activeProduct?.id === p.id && (
                      <span className="catalog-active-dot" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
          <LayoutDashboard size={18} /> Dashboard
        </NavLink>
        <NavLink to="/product" className={({ isActive }) => isActive ? 'active' : ''}>
          <Info size={18} /> Product Details
        </NavLink>
        <NavLink to="/scraper" className={({ isActive }) => isActive ? 'active' : ''}>
          <Radar size={18} /> Scraper
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
          <BarChart3 size={18} /> Analytics
        </NavLink>
        <NavLink to="/marketplace" className={({ isActive }) => isActive ? 'active' : ''}>
          <Store size={18} /> Marketplace
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <span>PriceEngine v1.0</span>
      </div>
    </aside>
  );
}
