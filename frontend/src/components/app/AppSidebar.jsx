import { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, Radio, Globe, BrainCircuit, Cpu,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useProduct } from '../../context/ProductContext';

const NAV_ITEMS = [
  { to: '/app',                  label: 'Dashboard',        Icon: LayoutDashboard, end: true },
  { to: '/app/analytics',        label: 'Analytics',        Icon: BarChart2 },
  { to: '/app/intelligence',     label: 'Intelligence Hub', Icon: Cpu },
  { to: '/app/strategy',         label: 'Strategy Builder', Icon: BrainCircuit },
  { to: '/app/scraper',          label: 'Scraper',          Icon: Radio },
  { to: '/app/marketplace',      label: 'Marketplace',      Icon: Globe },
];

const FILTERS = ['All', 'T-Shirts', 'Jeans', 'Dresses', 'Jackets'];

function getInitials(email = '') {
  if (!email) return 'U';
  const name = email.split('@')[0] || '';
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || 'U').toUpperCase();
}

function matchesFilter(product, filter) {
  if (filter === 'All') return true;
  const cat = (product?.category || product?.product_type || '').toLowerCase();
  const name = (product?.name || product?.title || '').toLowerCase();
  const f = filter.toLowerCase().replace('-', '');
  return cat.includes(f.replace('s', '')) || name.includes(f.replace('s', ''));
}

export default function AppSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { catalog, activeProduct, setActiveProduct } = useProduct();

  const [filter, setFilter] = useState('All');

  const filteredProducts = useMemo(() => {
    return (catalog || []).filter((p) => matchesFilter(p, filter));
  }, [catalog, filter]);

  const onPickProduct = (product) => {
    setActiveProduct(product);
    const id = product?.id || product?.product_id;
    if (id) navigate(`/app/products/${id}`);
  };

  const email = user?.email || 'demo@vougestudio.com';
  const initials = getInitials(email);

  return (
    <aside className="pe-sidebar">
      {/* Top — logo */}
      <div className="pe-sidebar__top">
        <div className="pe-sidebar__brand">
          <span className="pe-sidebar__mark" />
          <span className="pe-sidebar__brand-text">PriceEngine</span>
        </div>
        <div className="pe-sidebar__sublabel">Vouge Studio · Pro</div>
      </div>

      {/* Main nav */}
      <div className="pe-sidebar__section">
        <div className="pe-sidebar__label">Main</div>
        <nav className="pe-sidebar__nav">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `pe-nav-item ${isActive ? 'pe-nav-item--active' : ''}`
              }
            >
              <Icon size={16} className="pe-nav-item__icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Products section */}
      <div className="pe-sidebar__section pe-sidebar__products">
        <div className="pe-sidebar__label">Products</div>

        <div className="pe-sidebar__filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`pe-filter-pill ${filter === f ? 'pe-filter-pill--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <ul className="pe-sidebar__product-list">
          {filteredProducts.map((p) => {
            const id = p.id || p.product_id;
            const isActive = activeProduct && (activeProduct.id || activeProduct.product_id) === id;
            const name = p.name || p.title || 'Untitled';
            const price = p.price ?? p.current_price;
            return (
              <li
                key={id}
                onClick={() => onPickProduct(p)}
                className={`pe-product-item ${isActive ? 'pe-product-item--active' : ''}`}
              >
                <div className="pe-product-item__name">{name}</div>
                {price != null && (
                  <div className="pe-product-item__price">₹{price}</div>
                )}
              </li>
            );
          })}
          {filteredProducts.length === 0 && (
            <li className="pe-product-item pe-product-item--empty">
              No products
            </li>
          )}
        </ul>
      </div>

      {/* Bottom — user */}
      <div className="pe-sidebar__bottom">
        <div className="pe-sidebar__user">
          <div className="pe-sidebar__avatar" aria-hidden="true">{initials}</div>
          <div className="pe-sidebar__email" title={email}>{email}</div>
        </div>
      </div>
    </aside>
  );
}
