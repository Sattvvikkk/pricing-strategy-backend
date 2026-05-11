import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Layers, Compass, Sparkles, ChevronDown, Check,
  Star, Tag, Store, Truck, X, ArrowUpRight, TrendingUp, Package,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';

import {
  CATEGORIES, MARKETPLACES, SKU_OPTIONS, SCAN_DEPTHS, SIMILARITY_MODES, generateCompetitorProducts, marketplaceSummary,
  BRANDS_BY_MARKETPLACE
} from '../data/marketplaceData';
import { useProduct } from '../context/ProductContext';
import { useBuiltMarketplaces } from '../context/BuiltMarketplacesContext';
import '../styles/marketplace-intelligence.css';

const EASE = [0.16, 1, 0.3, 1];

// ---- Phase 0: Cinematic setup environment -----------------------------------
function FloatingParticles() {
  // 18 deterministic floating nodes
  const nodes = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      x: (i * 73) % 100,
      y: (i * 47) % 100,
      size: 4 + (i % 5) * 2,
      delay: (i * 0.4) % 6,
      duration: 9 + (i % 7),
    }));
  }, []);
  return (
    <div className="mi-particles" aria-hidden="true">
      {nodes.map((n) => (
        <motion.span
          key={n.id}
          className="mi-particle"
          style={{ left: `${n.x}%`, top: `${n.y}%`, width: n.size, height: n.size }}
          animate={{ y: [0, -20, 0], opacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: n.duration, delay: n.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="mi-orb mi-orb--1" />
      <div className="mi-orb mi-orb--2" />
      <div className="mi-orb mi-orb--3" />
    </div>
  );
}

function MarketplaceCard({ mp, selected, onToggle }) {
  return (
    <motion.button
      type="button"
      className={`mi-mp ${selected ? 'is-on' : ''}`}
      onClick={onToggle}
      style={{ '--accent': mp.accent, '--glow': mp.glow }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="mi-mp__pulse" />
      <div className="mi-mp__head">
        <span className="mi-mp__name">{mp.name}</span>
        {selected ? <span className="mi-mp__check"><Check size={12} /></span> : null}
      </div>
      <div className="mi-mp__tagline">{mp.tagline}</div>
      <div className="mi-mp__desc">{mp.description}</div>
      <div className="mi-mp__metrics">
        <div><dt>Density</dt><dd>{mp.metrics.density}</dd></div>
        <div><dt>Visibility</dt><dd>{mp.metrics.visibility}</dd></div>
        <div><dt>Tilt</dt><dd>{mp.metrics.tilt}</dd></div>
      </div>
    </motion.button>
  );
}

// Product Drawer Component - shows the user's own catalog products filtered by category
function ProductDrawer({ isOpen, onClose, category, products, onSelectProduct, selectedProduct }) {

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="product-drawer-overlay"
          className="mi-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="mi-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mi-drawer__header">
              <div className="mi-drawer__title">
                <Package size={20} />
                <span>Select Product - {category}</span>
              </div>
              <button className="mi-drawer__close" onClick={onClose}>
                <X size={20} />
              </button>
            </div>
            
            <div className="mi-drawer__content">
              {products.length === 0 ? (
                <div className="mi-drawer__empty">
                  <Package size={28} />
                  <p>No products in <strong>{category}</strong> in your catalogue.</p>
                  <span>Add products to this category in the Overview page.</span>
                </div>
              ) : (
                <div className="mi-product-grid">
                  {products.map((product) => {
                    const skuLabel = product.sku || product.id;
                    const price = product.landing_cost ?? product.mrp ?? product.selling_price ?? product.cost_price;
                    const isSelected = selectedProduct?.id === product.id;
                    return (
                      <button
                        type="button"
                        key={product.id}
                        className={`mi-product-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(product);
                        }}
                      >
                        {isSelected && (
                          <div className="mi-product-card__selected-badge">
                            <Check size={12} />
                          </div>
                        )}
                        <div className="mi-product-card__image">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="mi-product-card__image-fallback">
                              {(product.name || 'V').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="mi-product-card__details">
                          <div className="mi-product-card__brand">{product.category}</div>
                          <div className="mi-product-card__title">{product.name}</div>
                          <div className="mi-product-card__sku">SKU: {skuLabel}</div>

                          {price ? (
                            <div className="mi-product-card__price-row">
                              <div className="mi-product-card__price">₹{price}</div>
                              {product.stock_on_hand != null && (
                                <span className="mi-product-card__discount">{product.stock_on_hand} in stock</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SetupScreen({ config, setConfig, onBuild }) {
  const { catalog, setActiveProduct } = useProduct();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Categories present in the user's catalogue (from Overview page).
  const catalogCategories = useMemo(() => {
    const set = new Set();
    catalog.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [catalog]);

  // Products in the currently chosen category.
  const productsInCategory = useMemo(() => {
    if (!config.category) return [];
    return catalog.filter((p) => p.category === config.category);
  }, [catalog, config.category]);

  const toggleMarketplace = (id) => {
    setConfig((c) => ({
      ...c,
      marketplaces: c.marketplaces.includes(id)
        ? c.marketplaces.filter((x) => x !== id)
        : [...c.marketplaces, id],
    }));
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setActiveProduct(product);
    setConfig((c) => ({
      ...c,
      sku: product.sku || product.id,
      product,
    }));
    // Brief delay so user sees the selection check badge before drawer closes
    setTimeout(() => setIsDrawerOpen(false), 300);
  };

  const openDrawer = () => {
    setIsDrawerOpen(true);
  };

  return (
    <motion.div
      className="mi-setup"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <FloatingParticles />

      <div className="mi-setup__inner">
        <motion.div
          className="mi-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: EASE }}
        >
          <div className="mi-hero__eyebrow">Marketplace Intelligence</div>
          <h1 className="mi-hero__title">Build a live marketplace around your product.</h1>
          <p className="mi-hero__sub">
            Explore category positioning, competitor catalogues, pricing structures,
            and marketplace visibility across leading fashion platforms.
          </p>
        </motion.div>

        <motion.div
          className="mi-panel"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7, ease: EASE }}
        >
          {/* Row 1: Category + SKU */}
          <div className="mi-row">
            <div className="mi-field">
              <label>Category</label>
              <div className="mi-chiprow">
                {(catalogCategories.length ? catalogCategories : CATEGORIES).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`mi-chip ${config.category === c ? 'is-on' : ''}`}
                    onClick={() => {
                      setConfig((x) => ({
                        ...x,
                        category: c,
                        sku: (SKU_OPTIONS[c] && SKU_OPTIONS[c][0]) || '',
                        product: null,
                      }));
                      setSelectedProduct(null);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mi-field mi-field--narrow">
              <label>Product</label>
              <div className="mi-product-selector" onClick={openDrawer}>
                <div className="mi-product-selector__content">
                  {selectedProduct ? (
                    <>
                      {selectedProduct.image ? (
                        <img
                          src={selectedProduct.image}
                          alt={selectedProduct.name}
                          className="mi-product-selector__image"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : null}
                      <div className="mi-product-selector__info">
                        <div className="mi-product-selector__title">{selectedProduct.name}</div>
                        <div className="mi-product-selector__sku">{selectedProduct.sku || selectedProduct.id}</div>
                        {selectedProduct.mrp ? (
                          <div className="mi-product-selector__price">₹{selectedProduct.landing_cost ?? selectedProduct.mrp}</div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="mi-product-selector__placeholder">
                      <Package size={20} />
                      <span>Choose a product</span>
                    </div>
                  )}
                </div>
                <ChevronDown size={14} className="mi-select__chev" />
              </div>
            </div>
          </div>

          {/* Row 2: Marketplaces */}
          <div className="mi-field">
            <label>Target Marketplaces</label>
            <div className="mi-mp-grid">
              {MARKETPLACES.map((mp) => (
                <MarketplaceCard
                  key={mp.id}
                  mp={mp}
                  selected={config.marketplaces.includes(mp.id)}
                  onToggle={() => toggleMarketplace(mp.id)}
                />
              ))}
            </div>
          </div>

          {/* Row 3: Scan depth + similarity */}
          <div className="mi-row">
            <div className="mi-field">
              <label>Scan Depth</label>
              <div className="mi-chiprow">
                {SCAN_DEPTHS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`mi-chip ${config.scanDepth === s.id ? 'is-on' : ''}`}
                    onClick={() => setConfig((x) => ({ ...x, scanDepth: s.id }))}
                    title={s.note}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mi-field">
              <label>Similarity Mode</label>
              <div className="mi-chiprow">
                {SIMILARITY_MODES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`mi-chip ${config.similarity === s.id ? 'is-on' : ''}`}
                    onClick={() => setConfig((x) => ({ ...x, similarity: s.id }))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mi-cta-row">
            <div className="mi-cta-summary">
              <span>{selectedProduct ? selectedProduct.name : 'No product selected'}</span>
              <em>{'\u00B7'}</em>
              <span>{config.marketplaces.length} marketplace{config.marketplaces.length === 1 ? '' : 's'}</span>
              <em>{'\u00B7'}</em>
              <span>{SCAN_DEPTHS.find((s) => s.id === config.scanDepth)?.label} scan</span>
            </div>
            <motion.button
              type="button"
              className="mi-build-btn"
              onClick={onBuild}
              disabled={config.marketplaces.length === 0 || !selectedProduct}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles size={14} />
              <span>{selectedProduct ? 'Build Marketplace' : 'Select a Product First'}</span>
            </motion.button>
          </div>
        </motion.div>
        
        {/* Product Drawer */}
        <ProductDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          category={config.category}
          products={productsInCategory}
          onSelectProduct={handleProductSelect}
          selectedProduct={selectedProduct}
        />
      </div>
    </motion.div>
  );
}

// ---- Phase 1-4: Cinematic build sequence -----------------------------------
const BUILD_PHASES = [
  { id: 1, label: 'Scanning marketplace catalogues',   icon: Compass, art: 'discovery',  duration: 2800 },
  { id: 2, label: 'Matching similar products',          icon: Layers,  art: 'matching',   duration: 2400 },
  { id: 3, label: 'Analyzing pricing & positioning',    icon: Search,  art: 'building',   duration: 2200 },
  { id: 4, label: 'Intelligence ready',                 icon: Sparkles, art: 'ready',     duration: 1200 },
];

/* Animated counter that ticks up from 0 to target */
function AnimatedCount({ target, duration = 2000, prefix = '', suffix = '' }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <span>{prefix}{count.toLocaleString('en-IN')}{suffix}</span>;
}

/* Mini SVG bar chart that animates in */
function MiniBarChart({ data, color = '#1A3A2E', delay = 0 }) {
  const max = Math.max(...data);
  return (
    <div className="mi-mini-chart">
      {data.map((v, i) => (
        <motion.div
          key={i}
          className="mi-mini-chart__bar"
          style={{ background: color }}
          initial={{ height: 0 }}
          animate={{ height: `${(v / max) * 100}%` }}
          transition={{ duration: 0.6, delay: delay + i * 0.06, ease: EASE }}
        />
      ))}
    </div>
  );
}

/* Mini SVG line sparkline */
function MiniSparkline({ data, color = '#1A3A2E', delay = 0 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120, h = 40;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mi-sparkline" preserveAspectRatio="none">
      <motion.polyline
        points={points}
        fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay, ease: 'easeInOut' }}
      />
      <motion.polyline
        points={`0,${h} ${points} ${w},${h}`}
        fill={`${color}15`} stroke="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: delay + 0.6 }}
      />
    </svg>
  );
}

/* Marketplace scanning card with progress bar */
function ScanCard({ name, accent, delay, progress }) {
  return (
    <motion.div
      className="mi-scan-card"
      style={{ '--accent': accent }}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <div className="mi-scan-card__head">
        <span className="mi-scan-card__dot" />
        <span className="mi-scan-card__name">{name}</span>
        <motion.span className="mi-scan-card__pct"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
        >
          <AnimatedCount target={progress} duration={1800} suffix="%" />
        </motion.span>
      </div>
      <div className="mi-scan-card__track">
        <motion.div
          className="mi-scan-card__fill"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 2, delay: delay + 0.2, ease: EASE }}
        />
      </div>
      <div className="mi-scan-card__stats">
        <span><AnimatedCount target={40 + (name.charCodeAt(0) % 160)} duration={1600} /> listings</span>
        <span><AnimatedCount target={3 + (name.charCodeAt(1) % 12)} duration={1200} /> brands</span>
      </div>
    </motion.div>
  );
}

/* Phase 1: Discovery — scanning marketplaces with live progress */
function DiscoveryPhase({ config }) {
  const mps = MARKETPLACES.filter(m => config.marketplaces.includes(m.id));
  return (
    <div className="mi-build-phase mi-build-phase--discovery">
      <div className="mi-build-phase__left">
        <motion.div className="mi-build-stat-grid"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        >
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={mps.length} duration={600} /></div>
            <div className="mi-build-stat__label">Marketplaces</div>
          </div>
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={847} duration={2200} /></div>
            <div className="mi-build-stat__label">Listings Found</div>
          </div>
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={96} duration={2000} suffix="%" /></div>
            <div className="mi-build-stat__label">Coverage</div>
          </div>
        </motion.div>
        <div className="mi-scan-cards">
          {mps.map((mp, i) => (
            <ScanCard key={mp.id} name={mp.name} accent={mp.accent}
              delay={0.3 + i * 0.25} progress={75 + (mp.id.charCodeAt(0) % 25)}
            />
          ))}
        </div>
      </div>
      <motion.div className="mi-build-phase__right"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <div className="mi-build-viz">
          <div className="mi-build-viz__title">Catalogue Depth</div>
          <MiniBarChart data={[65, 89, 45, 72, 93, 58, 81, 67]} color="#1A3A2E" delay={0.6} />
        </div>
        <div className="mi-build-viz">
          <div className="mi-build-viz__title">Discovery Rate</div>
          <MiniSparkline data={[10, 25, 38, 52, 61, 73, 80, 85, 92, 96]} color="#1A3A2E" delay={0.8} />
        </div>
      </motion.div>
    </div>
  );
}

/* Phase 2: Matching — product similarity with animated connections */
function MatchingPhase() {
  const matchData = [
    { label: 'Exact Match', count: 23, pct: 28, color: '#1A3A2E' },
    { label: 'Near Match', count: 45, pct: 54, color: '#3B6B54' },
    { label: 'Style Similar', count: 67, pct: 81, color: '#6B9B84' },
    { label: 'Price Band', count: 89, pct: 92, color: '#9BCBB4' },
  ];
  return (
    <div className="mi-build-phase mi-build-phase--matching">
      <div className="mi-build-phase__left">
        <motion.div className="mi-build-stat-grid"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        >
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={312} duration={1800} /></div>
            <div className="mi-build-stat__label">Products Matched</div>
          </div>
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={87} duration={1600} suffix="%" /></div>
            <div className="mi-build-stat__label">Similarity Score</div>
          </div>
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={24} duration={1200} /></div>
            <div className="mi-build-stat__label">Unique Brands</div>
          </div>
        </motion.div>
        <div className="mi-match-bars">
          {matchData.map((d, i) => (
            <motion.div key={d.label} className="mi-match-bar"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.5, ease: EASE }}
            >
              <div className="mi-match-bar__head">
                <span>{d.label}</span>
                <span className="mi-match-bar__count">{d.count}</span>
              </div>
              <div className="mi-match-bar__track">
                <motion.div className="mi-match-bar__fill" style={{ background: d.color }}
                  initial={{ width: '0%' }} animate={{ width: `${d.pct}%` }}
                  transition={{ duration: 1.2, delay: 0.5 + i * 0.15, ease: EASE }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <motion.div className="mi-build-phase__right"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <div className="mi-match-network">
          <svg viewBox="0 0 200 200" className="mi-match-network__svg">
            <motion.circle cx="100" cy="100" r="16" fill="#1A3A2E"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
            />
            <motion.text x="100" y="104" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="600"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            >YOU</motion.text>
            {[
              { x: 40, y: 40, c: '#ff3f6c', l: 'M' },
              { x: 160, y: 40, c: '#d4a157', l: 'A' },
              { x: 40, y: 160, c: '#ffae3d', l: 'Am' },
              { x: 160, y: 160, c: '#4d8eff', l: 'F' },
              { x: 100, y: 30, c: '#1A3A2E80' },
              { x: 30, y: 100, c: '#1A3A2E60' },
              { x: 170, y: 100, c: '#1A3A2E40' },
              { x: 100, y: 170, c: '#1A3A2E50' },
            ].map((n, i) => (
              <g key={i}>
                <motion.line x1="100" y1="100" x2={n.x} y2={n.y}
                  stroke={n.c} strokeWidth="1" strokeDasharray="4 4" opacity="0.4"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                />
                <motion.circle cx={n.x} cy={n.y} r={n.l ? 10 : 5} fill={n.c}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                />
                {n.l && (
                  <motion.text x={n.x} y={n.y + 3} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="600"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.1 }}
                  >{n.l}</motion.text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </motion.div>
    </div>
  );
}

/* Phase 3: Building — pricing landscape preview */
function BuildingPhase() {
  const priceData = [28, 32, 19, 45, 38, 21, 52, 34, 26, 41, 18, 36];
  const positions = ['Premium', 'Trend', 'Value', 'Bestseller'];
  return (
    <div className="mi-build-phase mi-build-phase--building">
      <div className="mi-build-phase__left">
        <motion.div className="mi-build-stat-grid"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        >
          <div className="mi-build-stat">
            <div className="mi-build-stat__value">{'\u20B9'}<AnimatedCount target={2847} duration={1600} /></div>
            <div className="mi-build-stat__label">Avg Competing Price</div>
          </div>
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={34} duration={1400} suffix="%" /></div>
            <div className="mi-build-stat__label">Avg Discount</div>
          </div>
          <div className="mi-build-stat">
            <div className="mi-build-stat__value"><AnimatedCount target={4} duration={800} />.2{'\u2605'}</div>
            <div className="mi-build-stat__label">Avg Rating</div>
          </div>
        </motion.div>
        <div className="mi-build-price-dist">
          <div className="mi-build-viz__title">Price Distribution</div>
          <MiniBarChart data={priceData} color="#1A3A2E" delay={0.3} />
          <div className="mi-build-price-labels">
            <span>{'\u20B9'}1,000</span><span>{'\u20B9'}3,000</span><span>{'\u20B9'}5,000</span>
          </div>
        </div>
      </div>
      <motion.div className="mi-build-phase__right"
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <div className="mi-build-viz__title">Positioning Mix</div>
        <div className="mi-build-positions">
          {positions.map((pos, i) => (
            <motion.div key={pos} className="mi-build-pos"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.12, duration: 0.5, ease: EASE }}
            >
              <div className="mi-build-pos__ring">
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E7EB" strokeWidth="2.5" />
                  <motion.circle cx="18" cy="18" r="15.9"
                    fill="none" stroke="#1A3A2E" strokeWidth="2.5"
                    strokeDasharray="100" strokeLinecap="round"
                    transform="rotate(-90 18 18)"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 100 - (20 + i * 18) }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.12, ease: EASE }}
                  />
                </svg>
                <span>{20 + i * 18}%</span>
              </div>
              <div className="mi-build-pos__label">{pos}</div>
            </motion.div>
          ))}
        </div>
        <div className="mi-build-viz" style={{ marginTop: 16 }}>
          <div className="mi-build-viz__title">Rating Distribution</div>
          <MiniSparkline data={[3.5, 3.8, 4.1, 4.3, 4.0, 4.2, 4.5, 4.1, 3.9, 4.4]} color="#1A3A2E" delay={0.6} />
        </div>
      </motion.div>
    </div>
  );
}

/* Phase 4: Ready — dramatic KPI reveal */
function ReadyPhase({ config }) {
  const kpis = [
    { label: 'Total Listings', value: '847', icon: '\uD83D\uDCCA' },
    { label: 'Price Points', value: '1,294', icon: '\uD83D\uDCB0' },
    { label: 'Brands Mapped', value: '38', icon: '\uD83C\uDFF7\uFE0F' },
    { label: 'Opportunities', value: '12', icon: '\uD83C\uDFAF' },
  ];
  return (
    <div className="mi-build-phase mi-build-phase--ready">
      <motion.div className="mi-ready-title"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <Sparkles size={24} />
        <h2>Marketplace Intelligence Ready</h2>
        <p>Analysis complete for <strong>{config.category}</strong> across {config.marketplaces.length} platforms</p>
      </motion.div>
      <div className="mi-ready-kpis">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} className="mi-ready-kpi"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.12, duration: 0.5, ease: EASE }}
          >
            <div className="mi-ready-kpi__icon">{kpi.icon}</div>
            <div className="mi-ready-kpi__value">{kpi.value}</div>
            <div className="mi-ready-kpi__label">{kpi.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function BuildSequence({ onComplete, config }) {
  const [phase, setPhase] = useState(1);
  useEffect(() => {
    const current = BUILD_PHASES[Math.min(phase - 1, BUILD_PHASES.length - 1)];
    if (phase >= BUILD_PHASES.length) {
      const t = setTimeout(onComplete, current.duration);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase((p) => p + 1), current.duration);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const current = BUILD_PHASES[Math.min(phase - 1, BUILD_PHASES.length - 1)];
  const Icon = current.icon;

  return (
    <motion.div
      className="mi-build"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <FloatingParticles />

      {/* Top bar: phase label + progress */}
      <div className="mi-build__topbar">
        <div className="mi-build__caption">
          <div className="mi-build__icon"><Icon size={16} /></div>
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="mi-build__label"
            >
              {current.label}
              <span className="mi-build__dots"><i /><i /><i /></span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mi-build__progress">
          {BUILD_PHASES.map((p) => (
            <span key={p.id} className={`mi-build__pip ${phase >= p.id ? 'is-on' : ''}`} />
          ))}
          <span className="mi-build__phase-num">Phase {Math.min(phase, BUILD_PHASES.length)}/{BUILD_PHASES.length}</span>
        </div>
      </div>

      {/* Phase-specific rich content */}
      <div className="mi-build__body">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mi-build__phase-content"
          >
            {current.art === 'discovery' && <DiscoveryPhase config={config} />}
            {current.art === 'matching' && <MatchingPhase />}
            {current.art === 'building' && <BuildingPhase />}
            {current.art === 'ready' && <ReadyPhase config={config} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---- Phase 5: Marketplace View ---------------------------------------------
const VIEW_TABS = [
  { id: 'overview',     label: 'Marketplace Overview' },
  { id: 'catalogue',    label: 'Competitor Catalogue' },
  { id: 'pricing',      label: 'Pricing Landscape' },
  { id: 'trends',       label: 'Category Trends' },
  { id: 'positioning',  label: 'Positioning Analysis' },
  { id: 'opportunity',  label: 'Opportunity Gaps' },
];

function MarketplaceOverview({ summaries, config }) {
  return (
    <div className="mi-grid mi-grid--2">
      {summaries.map(({ mp, summary }) => (
        <motion.div
          key={mp.id}
          className="mi-summary"
          style={{ '--accent': mp.accent, '--glow': mp.glow }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="mi-summary__head">
            <div>
              <div className="mi-summary__name">{mp.name}</div>
              <div className="mi-summary__tag">{mp.tagline}</div>
            </div>
            <div className="mi-summary__pulse" />
          </div>
          <dl className="mi-summary__stats">
            <div><dt>Similar Listings</dt><dd>{summary.listings}</dd></div>
            <div><dt>Avg Price</dt><dd>{'\u20B9'}{summary.avgPrice.toLocaleString('en-IN')}</dd></div>
            <div><dt>Price Range</dt><dd>{`\u20B9${summary.minPrice}-\u20B9${summary.maxPrice}`}</dd></div>
            <div><dt>Avg Discount</dt><dd>{summary.avgDiscount}%</dd></div>
            <div><dt>Avg Rating</dt><dd>{summary.avgRating}{'\u2605'}</dd></div>
            <div><dt>Total Reviews</dt><dd>{summary.totalReviews.toLocaleString('en-IN')}</dd></div>
            <div><dt>Top Brands</dt><dd>{summary.topBrands.slice(0, 2).join(', ')}</dd></div>
            <div><dt>Dominant Fit</dt><dd>{summary.dominantFit}</dd></div>
            <div><dt>Dominant Color</dt><dd>{summary.dominantColor}</dd></div>
            <div><dt>Bestsellers</dt><dd>{summary.bestsellerCount}</dd></div>
            <div><dt>New Arrivals</dt><dd>{summary.newArrivalCount}</dd></div>
            <div><dt>Avg Delivery</dt><dd>{summary.avgDelivery} days</dd></div>
          </dl>
          <div className="mi-summary__foot">
            <span className="mi-summary__chip">{summary.reviewDensity} review density</span>
            <span className="mi-summary__chip">{summary.competitionLevel} competition</span>
            <span className="mi-summary__chip">{config.category} active</span>
            <span className="mi-summary__chip">{summary.growthTrend} growth trend</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function CompetitorCatalogue({ products, marketplaces, onOpen, loading }) {
  const [filter, setFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filter !== 'all' && p.marketplace !== filter) return false;
      if (brandFilter !== 'all' && p.brand !== brandFilter) return false;
      return true;
    });
  }, [products, filter, brandFilter]);

  const brandsForFilter = useMemo(() => {
    if (filter === 'all') return [];
    const brandsInProducts = [...new Set(products.filter(p => p.marketplace === filter).map(p => p.brand))];
    return brandsInProducts.sort();
  }, [filter, products]);

  return (
    <div className="mi-cat">
      <div className="mi-cat__filters">
        <div className="mi-cat__filter-group">
          <span className="mi-cat__filter-label">Marketplace</span>
          <button
            type="button"
            className={`mi-pill ${filter === 'all' ? 'is-on' : ''}`}
            onClick={() => { setFilter('all'); setBrandFilter('all'); }}
          >
            All
          </button>
          {marketplaces.map((mp) => (
            <button
              key={mp.id}
              type="button"
              className={`mi-pill ${filter === mp.id ? 'is-on' : ''}`}
              style={{ '--accent': mp.accent }}
              onClick={() => { setFilter(mp.id); setBrandFilter('all'); }}
            >
              {mp.name}
            </button>
          ))}
        </div>
        {brandsForFilter.length > 0 ? (
          <div className="mi-cat__filter-group">
            <span className="mi-cat__filter-label">Brand</span>
            <button
              type="button"
              className={`mi-pill mi-pill--sm ${brandFilter === 'all' ? 'is-on' : ''}`}
              onClick={() => setBrandFilter('all')}
            >
              All
            </button>
            {brandsForFilter.map((b) => (
              <button
                key={b}
                type="button"
                className={`mi-pill mi-pill--sm ${brandFilter === b ? 'is-on' : ''}`}
                onClick={() => setBrandFilter(b)}
              >
                {b}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mi-cat__count">
        {loading ? (
          <span style={{ color: 'var(--mi-muted, #a8a89e)' }}>Fetching live competitor data…</span>
        ) : (
          <>{filtered.length} listings {filter !== 'all' ? `on ${marketplaces.find((m) => m.id === filter)?.name}` : 'across selected marketplaces'}</>
        )}
      </div>

      {loading ? (
        <div className="mi-cat__grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mi-card mi-card--skeleton" style={{ '--accent': '#333' }}>
              <div className="mi-card__media" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8 }} />
              <div className="mi-card__body">
                <div style={{ height: 10, width: '40%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 14, width: '80%', background: 'rgba(255,255,255,0.10)', borderRadius: 4, marginBottom: 10 }} />
                <div style={{ height: 18, width: '55%', background: 'rgba(255,255,255,0.12)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mi-cat__grid">
          {filtered.map((p, i) => {
            const mp = marketplaces.find((m) => m.id === p.marketplace);
            return (
              <motion.button
                type="button"
                key={p.id}
                className="mi-card"
                onClick={() => onOpen(p)}
                style={{ '--accent': mp?.accent || '#ceed6f' }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.02, 0.4), ease: EASE }}
                whileHover={{ y: -4 }}
              >
                <div className="mi-card__media">
                  <img src={p.image} alt={p.title} loading="lazy" />
                  <div className="mi-card__badges">
                    {p.bestseller ? <span className="mi-badge mi-badge--best">Bestseller</span> : null}
                    {p.newArrival ? <span className="mi-badge mi-badge--new">New Arrival</span> : null}
                  </div>
                  <div className="mi-card__mp">{mp?.name}</div>
                </div>
                <div className="mi-card__body">
                  <div className="mi-card__brand">{p.brand}</div>
                  <div className="mi-card__title">{p.title}</div>
                  <div className="mi-card__price">
                    <strong>{'\u20B9'}{p.price.toLocaleString('en-IN')}</strong>
                    <span className="mi-card__mrp">{'\u20B9'}{p.mrp.toLocaleString('en-IN')}</span>
                    <span className="mi-card__off">{p.discountPct}% off</span>
                  </div>
                  <div className="mi-card__meta">
                    <span><Star size={11} /> {p.rating}</span>
                    <span>{p.reviews.toLocaleString('en-IN')} reviews</span>
                  </div>
                  <div className="mi-card__pos">{p.positioning}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}


function PricingLandscape({ products, marketplaces }) {
  const data = useMemo(() => {
    return marketplaces.map((mp) => {
      const list = products.filter((p) => p.marketplace === mp.id);
      const sorted = [...list].sort((a, b) => a.price - b.price);
      const min = sorted[0]?.price || 0;
      const max = sorted[sorted.length - 1]?.price || 0;
      const median = sorted[Math.floor(sorted.length / 2)]?.price || 0;
      const avg = Math.round(list.reduce((s, p) => s + p.price, 0) / Math.max(1, list.length));
      return { name: mp.name, min, median, avg, max, fill: mp.accent };
    });
  }, [products, marketplaces]);

  const scatter = useMemo(() => {
    return products.map((p) => {
      const mp = marketplaces.find((m) => m.id === p.marketplace);
      return { ...p, fill: mp?.accent || '#ceed6f' };
    });
  }, [products, marketplaces]);

  return (
    <div className="mi-pricing">
      <div className="mi-block">
        <div className="mi-block__head">
          <h3>Price Range by Marketplace</h3>
          <span>min {'\u00B7'} median {'\u00B7'} avg {'\u00B7'} max ({'\u20B9'})</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#E6EDE5" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#0A1F14' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#0A1F14' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12, color: '#0A1F14' }}
              cursor={{ fill: 'rgba(26, 93, 58, 0.1)' }}
              formatter={(v, k) => [`\u20B9${v.toLocaleString('en-IN')}`, k]}
            />
            <Bar dataKey="min" name="Min">
              {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.35} />)}
            </Bar>
            <Bar dataKey="median" name="Median">
              {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.65} />)}
            </Bar>
            <Bar dataKey="avg" name="Avg">
              {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
            </Bar>
            <Bar dataKey="max" name="Max">
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mi-block">
        <div className="mi-block__head">
          <h3>Price vs Rating</h3>
          <span>each dot is a competing listing</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#E6EDE5" strokeDasharray="3 3" />
            <XAxis dataKey="price" type="number" name="Price"
              tick={{ fontSize: 10, fill: '#0A1F14' }}
              label={{ value: 'Price (₹)', fontSize: 10, fill: '#2D4A3E', position: 'insideBottom', offset: -2 }} />
            <YAxis dataKey="rating" type="number" name="Rating" domain={[3.5, 5]}
              tick={{ fontSize: 10, fill: '#0A1F14' }}
              label={{ value: 'Rating', fontSize: 10, fill: '#2D4A3E', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ background: '#FFFFFF', border: '1px solid #D4DDD3', borderRadius: 8, fontSize: 12, color: '#0A1F14' }}
              cursor={{ strokeDasharray: '3 3', fill: 'rgba(26, 93, 58, 0.1)' }}
              formatter={(v, n) => [n === 'price' ? `₹${v.toLocaleString('en-IN')}` : v, n]} />
            <Scatter data={scatter}>
              {scatter.map((s) => <Cell key={s.id} fill={s.fill} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryTrends({ products, marketplaces }) {
  // Visible-only data: top fits, top colors, top fabrics across catalogue
  const fits = useMemo(() => {
    const m = {};
    for (const p of products) m[p.fit] = (m[p.fit] || 0) + 1;
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [products]);
  const colors = useMemo(() => {
    const m = {};
    for (const p of products) m[p.color] = (m[p.color] || 0) + 1;
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [products]);
  const fabrics = useMemo(() => {
    const m = {};
    for (const p of products) m[p.fabric] = (m[p.fabric] || 0) + 1;
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [products]);

  return (
    <div className="mi-grid mi-grid--3">
      <TrendCard title="Dominant Fits" data={fits} />
      <TrendCard title="Color Distribution" data={colors} />
      <TrendCard title="Fabric Mix" data={fabrics} />
    </div>
  );
}

function TrendCard({ title, data }) {
  const max = data[0]?.count || 1;
  return (
    <div className="mi-block">
      <div className="mi-block__head"><h3>{title}</h3></div>
      <ul className="mi-trend">
        {data.map((d) => (
          <li key={d.name}>
            <div className="mi-trend__row">
              <span>{d.name}</span>
              <strong>{d.count}</strong>
            </div>
            <div className="mi-trend__bar">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${(d.count / max) * 100}%` }}
                transition={{ duration: 0.7, ease: EASE }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PositioningAnalysis({ products, marketplaces }) {
  const data = useMemo(() => {
    return marketplaces.map((mp) => {
      const list = products.filter((p) => p.marketplace === mp.id);
      const counts = {};
      for (const p of list) counts[p.positioning] = (counts[p.positioning] || 0) + 1;
      return { name: mp.name, accent: mp.accent, counts, total: list.length };
    });
  }, [products, marketplaces]);
  const positions = ['Premium Segment', 'Bestseller', 'Trend-Driven', 'Heavy Discounting', 'Fast Fashion', 'Minimalist Styling', 'Occasion Wear', 'Streetwear'];

  return (
    <div className="mi-block">
      <div className="mi-block__head">
        <h3>Positioning Mix per Marketplace</h3>
        <span>visible category tilt across competitors</span>
      </div>
      <div className="mi-pos">
        <div className="mi-pos__head">
          <span />
          {positions.map((p) => <span key={p}>{p}</span>)}
        </div>
        {data.map((row) => (
          <div className="mi-pos__row" key={row.name} style={{ '--accent': row.accent }}>
            <span className="mi-pos__name">{row.name}</span>
            {positions.map((p) => {
              const c = row.counts[p] || 0;
              const pct = row.total > 0 ? (c / row.total) * 100 : 0;
              return (
                <div className="mi-pos__cell" key={p} title={`${c} listings`}>
                  <motion.span
                    className="mi-pos__bar"
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 0.8, ease: EASE }}
                  />
                  <em>{c}</em>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunityGaps({ products, marketplaces, config }) {
  // Derive gaps from public data: under-represented price bands, fits, colors.
  const insights = useMemo(() => {
    const out = [];
    // Avg price across all
    const avg = Math.round(products.reduce((s, p) => s + p.price, 0) / Math.max(1, products.length));
    // Min discount band
    const lowDiscount = products.filter((p) => p.discountPct < 20).length;
    if (lowDiscount / products.length < 0.18) {
      out.push({
        title: 'Full-price territory is empty',
        body: `Only ${lowDiscount} of ${products.length} listings hold discount under 20%. A premium-priced ${config.category.toLowerCase()} drop could stand out visibly.`,
        tone: 'good',
      });
    }
    // Lead price band
    const sub1k = products.filter((p) => p.price < 1000).length;
    if (sub1k / products.length > 0.4) {
      out.push({
        title: 'Sub-₹1000 is saturated',
        body: `${sub1k} listings sit below ₹1000. Competing here means heavy discount density on Flipkart and Amazon.`,
        tone: 'warn',
      });
    }
    // Color whitespace
    const colors = ['Coral', 'Ivory', 'Charcoal', 'Indigo', 'Olive', 'Rust', 'Black', 'Sand', 'Cream', 'Stone', 'Forest'];
    const seen = new Set(products.map((p) => p.color));
    const missing = colors.filter((c) => !seen.has(c)).slice(0, 3);
    if (missing.length) {
      out.push({
        title: 'Color whitespace',
        body: `These colors are absent from competing catalogues: ${missing.join(', ')}.`,
        tone: 'good',
      });
    }
    // Bestseller share
    const bs = products.filter((p) => p.bestseller).length;
    out.push({
      title: 'Bestseller density',
      body: `${bs} of ${products.length} listings carry a "Bestseller" tag (${Math.round((bs / products.length) * 100)}%). Median competing price is around ₹${avg.toLocaleString('en-IN')}.`,
      tone: 'muted',
    });
    return out;
  }, [products, config]);

  return (
    <div className="mi-grid mi-grid--2">
      {insights.map((g) => (
        <motion.div
          className={`mi-gap mi-gap--${g.tone}`}
          key={g.title}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="mi-gap__title">{g.title}</div>
          <div className="mi-gap__body">{g.body}</div>
        </motion.div>
      ))}
    </div>
  );
}

function ProductDetailDrawer({ product, marketplaces, onClose }) {
  if (!product) return null;
  const mp = marketplaces.find((m) => m.id === product.marketplace);
  return (
    <AnimatePresence>
      <motion.div
        key="scrim"
        className="mi-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        key="drawer"
        className="mi-drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.4, ease: EASE }}
        style={{ '--accent': mp?.accent || '#ceed6f' }}
      >
        <button type="button" className="mi-drawer__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="mi-drawer__media">
          <img src={product.image} alt={product.title} />
        </div>
        <div className="mi-drawer__body">
          <div className="mi-drawer__brand">{product.brand}</div>
          <h2 className="mi-drawer__title">{product.title}</h2>
          <div className="mi-drawer__mp">
            <span style={{ background: mp?.accent }} /> {mp?.name}
          </div>
          <div className="mi-drawer__price">
            <strong>{'\u20B9'}{product.landing_cost?.toLocaleString('en-IN') ?? product.price?.toLocaleString('en-IN')}</strong>
            <span className="mi-drawer__mrp">{'\u20B9'}{product.mrp.toLocaleString('en-IN')}</span>
            <span className="mi-drawer__off">{product.discountPct}% off</span>
          </div>
          <div className="mi-drawer__rating">
            <Star size={14} /> {product.rating} {'\u00B7'} {product.reviews.toLocaleString('en-IN')} reviews
          </div>

          <div className="mi-drawer__tags">
            {product.bestseller ? <span className="mi-tag mi-tag--best">Bestseller</span> : null}
            {product.newArrival ? <span className="mi-tag mi-tag--new">New Arrival</span> : null}
            <span className="mi-tag">{product.positioning}</span>
          </div>

          <dl className="mi-drawer__dl">
            <div><dt>Category</dt><dd>{product.category}</dd></div>
            <div><dt>Color</dt><dd>{product.color}</dd></div>
            <div><dt>Fit</dt><dd>{product.fit}</dd></div>
            <div><dt>Fabric</dt><dd>{product.fabric}</dd></div>
            <div><dt>Sizes</dt><dd>{product.sizes.join(', ')}</dd></div>
            <div><dt>Seller</dt><dd><Store size={12} /> {product.seller}</dd></div>
            <div><dt>Delivery</dt><dd><Truck size={12} /> {product.delivery}</dd></div>
          </dl>

          <div className="mi-drawer__note">
            All fields above reflect publicly visible marketplace data only.
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

function MarketplaceView({ config, products, marketplaces, summaries, scraperMeta, loadingProducts, onReset }) {
  const [tab, setTab] = useState('overview');
  const [openProduct, setOpenProduct] = useState(null);

  return (
    <motion.div
      className="mi-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="mi-view__head">
        <div>
          <div className="mi-view__eyebrow">
            Marketplace built for{' '}
            <strong>{config.product?.name || config.sku}</strong>
            {config.product?.mrp ? ` — ₹${config.product.mrp}` : ''}
            {scraperMeta?.source_badge && (
              <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                {scraperMeta.source_badge}
              </span>
            )}
            {scraperMeta?.color && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>
                · Searching: {scraperMeta.color}{scraperMeta.fit ? ` ${scraperMeta.fit}` : ''}
              </span>
            )}
          </div>
          <h2 className="mi-view__title">{config.category} {'\u00B7'} {marketplaces.length} marketplaces</h2>
        </div>
        <button type="button" className="mi-view__reset" onClick={onReset}>
          <ArrowUpRight size={14} /> Build new
        </button>
      </div>

      <div className="mi-tabs" role="tablist">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`mi-tab ${tab === t.id ? 'is-on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mi-view__body">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {tab === 'overview' && <MarketplaceOverview summaries={summaries} config={config} />}
            {tab === 'catalogue' && <CompetitorCatalogue products={products} marketplaces={marketplaces} onOpen={setOpenProduct} loading={loadingProducts} />}
            {tab === 'pricing' && <PricingLandscape products={products} marketplaces={marketplaces} />}
            {tab === 'trends' && <CategoryTrends products={products} marketplaces={marketplaces} />}
            {tab === 'positioning' && <PositioningAnalysis products={products} marketplaces={marketplaces} />}
            {tab === 'opportunity' && <OpportunityGaps products={products} marketplaces={marketplaces} config={config} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <ProductDetailDrawer product={openProduct} marketplaces={marketplaces} onClose={() => setOpenProduct(null)} />
    </motion.div>
  );
}

// ---- Page entry ------------------------------------------------------------
export default function MarketplaceIntelligence() {
  const [config, setConfig] = useState({
    category: 'T-Shirts',
    sku: SKU_OPTIONS['T-Shirts'][0],
    marketplaces: ['myntra', 'ajio', 'amazon', 'flipkart'],
    scanDepth: 'standard',
    similarity: 'aesthetic',
  });
  const [phase, setPhase] = useState('setup'); // setup | building | view
  const [products, setProducts] = useState([]);
  const [scraperMeta, setScraperMeta] = useState(null); // { source_badge, query, color, fit }
  const [loadingProducts, setLoadingProducts] = useState(false);
  const { saveBuild } = useBuiltMarketplaces();

  const selectedMps = useMemo(
    () => MARKETPLACES.filter((m) => config.marketplaces.includes(m.id)),
    [config.marketplaces],
  );

  // ---- Fetch products from backend scraper when entering 'view' ----
  const fetchProducts = useCallback(async () => {
    if (phase !== 'view') return;
    setLoadingProducts(true);

    const countByDepth = { quick: 18, standard: 30, deep: 45 };
    const count = countByDepth[config.scanDepth] || 30;
    const product = config.product;

    // Build query from product name; extract color/fit from specifications or name
    const productName = product?.name || config.category;
    const color = product?.specifications?.color
      || product?.color
      || null;
    const fit = product?.specifications?.fit
      || product?.fit
      || null;
    const anchorPrice = product?.landing_cost ?? product?.mrp ?? product?.selling_price ?? product?.cost_price ?? null;

    const params = new URLSearchParams({
      q: productName,
      category: config.category,
      marketplaces: config.marketplaces.join(','),
      count: String(count),
      ...(color ? { color } : {}),
      ...(fit ? { fit } : {}),
      ...(anchorPrice ? { anchor_price: String(anchorPrice) } : {}),
    });

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/marketplace/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.results && data.results.length > 0) {
          // Group scraped products by marketplace so we can generate images
          // in BULK per marketplace. This ensures each card (index 0, 1, 2…)
          // gets a DIFFERENT image from the colour-matched pool rather than
          // every card reusing index-0 (the previous bug).
          const byMp = {};
          data.results.forEach((p) => {
            if (!byMp[p.marketplace]) byMp[p.marketplace] = [];
            byMp[p.marketplace].push(p);
          });

          const enriched = [];
          Object.entries(byMp).forEach(([mpId, mpProducts]) => {
            // Generate exactly as many images as there are products in this mp
            const generated = generateCompetitorProducts(
              mpId, config.category, mpProducts.length, product
            );
            mpProducts.forEach((p, i) => {
              enriched.push({
                ...p,
                image: generated[i]?.image || generated[0]?.image || '',
                hoverImage: generated[Math.min(i + 1, generated.length - 1)]?.image
                          || generated[0]?.image || '',
              });
            });
          });

          setProducts(enriched);

        setScraperMeta({
          source_badge: data.source_badge,
          query: data.query,
          color: data.color,
          fit: data.fit,
        });
      } else {
        // API returned empty — fallback to local generator
        const fallback = selectedMps.flatMap((mp) =>
          generateCompetitorProducts(mp.id, config.category, count, product)
        );
        setProducts(fallback);
        setScraperMeta({ source_badge: '⚪ Generated', query: productName });
      }
    } catch (err) {
      console.warn('[MarketplaceIntelligence] API error, using local fallback:', err);
      const fallback = selectedMps.flatMap((mp) =>
        generateCompetitorProducts(mp.id, config.category, count, product)
      );
      setProducts(fallback);
      setScraperMeta({ source_badge: '⚪ Generated', query: productName });
    } finally {
      setLoadingProducts(false);
    }
  }, [phase, config, selectedMps]);

  useEffect(() => {
    if (phase === 'view') {
      fetchProducts();
    } else {
      setProducts([]);
      setScraperMeta(null);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaries = useMemo(() => {
    return selectedMps.map((mp) => ({
      mp,
      summary: marketplaceSummary(mp.id, products.filter((p) => p.marketplace === mp.id)),
    })).filter((s) => s.summary);
  }, [selectedMps, products]);

  // Persist the build so StrategyBuilder can show only scanned products
  useEffect(() => {
    if (phase === 'view' && config.product?.id && products.length > 0 && !loadingProducts) {
      saveBuild({
        product: {
          id: config.product.id,
          name: config.product.name,
          sku: config.product.sku || config.sku,
          category: config.category,
          image: config.product.image,
          mrp: config.product.mrp,
          price: config.product.price ?? config.product.selling_price,
          cost_price: config.product.cost_price,
          specifications: config.product.specifications || {},
          stock: config.product.stock,
        },
        marketplaces: config.marketplaces,
        scanDepth: config.scanDepth,
        similarity: config.similarity,
        scraperMeta,
        summaries: summaries.map((s) => ({ mpId: s.mp.id, mpName: s.mp.name, ...s.summary })),
        competitorCount: products.length,
        avgCompetitorPrice: Math.round(
          products.reduce((a, p) => a + (p.price || 0), 0) / Math.max(products.length, 1)
        ),
        priceRange: {
          min: Math.min(...products.map((p) => p.price || 0)),
          max: Math.max(...products.map((p) => p.price || 0)),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, products.length, loadingProducts]);

  return (
    <div className="mi-page">
      <AnimatePresence mode="wait">
        {phase === 'setup' && (
          <SetupScreen
            key="setup"
            config={config}
            setConfig={setConfig}
            onBuild={() => setPhase('building')}
          />
        )}
        {phase === 'building' && (
          <BuildSequence key="building" onComplete={() => setPhase('view')} config={config} />
        )}
        {phase === 'view' && (
          <MarketplaceView
            key="view"
            config={config}
            products={products}
            marketplaces={selectedMps}
            summaries={summaries}
            scraperMeta={scraperMeta}
            loadingProducts={loadingProducts}
            onReset={() => setPhase('setup')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
