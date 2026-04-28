import { useState, useEffect, useRef, useCallback } from 'react';
import { useProduct } from '../context/ProductContext';
import {
  Radar, Play, CheckCircle2, XCircle, Clock, Star, ExternalLink,
  ShieldCheck, TrendingUp, TrendingDown, Minus, Package, Tag,
  Loader2, ChevronDown, ChevronRight, BarChart3, Zap, Award,
  AlertTriangle, Terminal, Wifi, Database, Shield, Globe, Activity
} from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────────────────── */
const LOG_COLORS = {
  system: '#6366F1',
  success: '#10B981',
  info: '#0EA5E9',
  network: '#06B6D4',
  crawl: '#F59E0B',
  data: '#059669',
  product: '#475569',
  error: '#F43F5E',
};

function formatTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

/* ── Component ───────────────────────────────────────────────────────── */
export default function Scraper() {
  const { activeProduct } = useProduct();

  // States
  const [phase, setPhase] = useState('idle'); // idle | scraping | done
  const [logs, setLogs] = useState([]);
  const [marketplaces, setMarketplaces] = useState([
    { name: 'Amazon', icon: '🛒', domain: 'amazon.in', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
    { name: 'Flipkart', icon: '🏪', domain: 'flipkart.com', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
    { name: 'Myntra', icon: '👕', domain: 'myntra.com', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
    { name: 'Ajio', icon: '🏬', domain: 'ajio.com', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
  ]);
  const [scrapeResult, setScrapeResult] = useState(null);
  const [expandedMP, setExpandedMP] = useState({});
  const [expandedProduct, setExpandedProduct] = useState({});
  const [currentPhaseLabel, setCurrentPhaseLabel] = useState('');
  const [totalBytes, setTotalBytes] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeMP, setActiveMP] = useState(-1);

  // Refs
  const terminalRef = useRef(null);
  const eventSourceRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const marketplaceColors = {
    Amazon: '#ff9900', Flipkart: '#2874f0', Myntra: '#ff3f6c', Ajio: '#3e3e52',
  };

  /* ── Add log line ────────────────────────────────────────────────── */
  const addLog = useCallback((level, message) => {
    setLogs(prev => [...prev, { time: formatTime(), level, message, id: Date.now() + Math.random() }]);
  }, []);

  /* ── Auto-scroll terminal ────────────────────────────────────────── */
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  /* ── Elapsed timer ───────────────────────────────────────────────── */
  useEffect(() => {
    if (phase === 'scraping') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  /* ── Run Scraper via SSE ─────────────────────────────────────────── */
  const runScrape = () => {
    // Reset
    setPhase('scraping');
    setLogs([]);
    setScrapeResult(null);
    setExpandedMP({});
    setExpandedProduct({});
    setTotalBytes(0);
    setTotalProducts(0);
    setElapsedTime(0);
    setActiveMP(-1);
    setCurrentPhaseLabel('Initializing...');
    setMarketplaces([
      { name: 'Amazon', icon: '🛒', domain: 'amazon.in', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
      { name: 'Flipkart', icon: '🏪', domain: 'flipkart.com', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
      { name: 'Myntra', icon: '👕', domain: 'myntra.com', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
      { name: 'Ajio', icon: '🏬', domain: 'ajio.com', status: 'waiting', progress: 0, productsFound: 0, durationMs: 0 },
    ]);

    // Build URL (no auth required)
    const productId = activeProduct?.id || '';
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const url = `${baseUrl}/api/scraper/stream?product_id=${productId}`;

    // Connect EventSource
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    es.onerror = () => {
      es.close();
      if (phase !== 'done') {
        addLog('error', '✗ Connection lost — retrying...');
      }
    };
  };

  /* ── Handle SSE events ───────────────────────────────────────────── */
  const handleSSEEvent = useCallback((data) => {
    switch (data.type) {
      case 'init':
        setCurrentPhaseLabel('Initializing Scraper Engine');
        break;

      case 'log':
        addLog(data.level, data.message);
        break;

      case 'phase':
        setCurrentPhaseLabel(data.message);
        break;

      case 'marketplace_start':
        setActiveMP(data.index);
        setCurrentPhaseLabel(`Scraping ${data.name}...`);
        setMarketplaces(prev => prev.map((mp, i) =>
          i === data.index ? { ...mp, status: 'scraping', progress: 0 } : mp
        ));
        break;

      case 'crawl_progress':
        setTotalBytes(prev => prev + (data.bytes || 0));
        setMarketplaces(prev => prev.map((mp, i) =>
          i === data.marketplace_index
            ? { ...mp, progress: Math.round(((data.page_index + 1) / data.total_pages) * 100) }
            : mp
        ));
        break;

      case 'marketplace_done':
        setMarketplaces(prev => prev.map((mp, i) =>
          i === data.index
            ? {
                ...mp,
                status: data.status === 'completed' ? 'done' : 'failed',
                progress: 100,
                productsFound: data.products_found || 0,
                durationMs: data.duration_ms || 0,
              }
            : mp
        ));
        if (data.products_found) {
          setTotalProducts(prev => prev + data.products_found);
        }
        break;

      case 'complete':
        setPhase('done');
        setScrapeResult(data.result);
        setCurrentPhaseLabel('Scrape Complete');
        setActiveMP(-1);
        // Auto-expand all marketplaces
        const expanded = {};
        data.result.marketplaces?.forEach(mp => { expanded[mp.marketplace] = true; });
        setExpandedMP(expanded);
        // Close SSE
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;

      default:
        break;
    }
  }, [addLog]);

  /* ── Cleanup ─────────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleMP = (mp) => setExpandedMP(prev => ({ ...prev, [mp]: !prev[mp] }));
  const toggleProduct = (key) => setExpandedProduct(prev => ({ ...prev, [key]: !prev[key] }));

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="main-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Marketplace Scraper</h2>
          <p>Scrape and compare competitor products across all marketplaces</p>
        </div>
        <button
          onClick={runScrape}
          className="scraper-run-btn"
          disabled={phase === 'scraping'}
          id="run-scraper-btn"
        >
          {phase === 'scraping' ? (
            <><Loader2 size={16} className="spinning" /> Scraping...</>
          ) : (
            <><Radar size={16} /> Run Scraper</>
          )}
        </button>
      </div>

      {/* Active Product Banner */}
      {activeProduct && (
        <div className="scraper-product-banner">
          <div className="scraper-product-info">
            {activeProduct.image && (
              <img src={activeProduct.image} alt="" className="scraper-product-img" />
            )}
            <div>
              <div className="scraper-product-brand">{activeProduct.brand}</div>
              <div className="scraper-product-name">{activeProduct.name}</div>
              <div className="scraper-product-price">₹{activeProduct.price}</div>
            </div>
          </div>
          <div className="scraper-product-badge">
            <ShieldCheck size={14} /> Reference Product
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CINEMATIC SCRAPING EXPERIENCE
          ═══════════════════════════════════════════════════════════════ */}
      {(phase === 'scraping' || phase === 'done') && (
        <div className="scraper-live-view">
          {/* Status Header Bar */}
          <div className="scraper-status-bar">
            <div className="status-bar-left">
              <div className={`status-indicator ${phase === 'scraping' ? 'active' : 'complete'}`}>
                <span className="status-dot"></span>
                <span>{phase === 'scraping' ? 'LIVE' : 'COMPLETE'}</span>
              </div>
              <span className="status-phase">{currentPhaseLabel}</span>
            </div>
            <div className="status-bar-right">
              <div className="status-stat">
                <Clock size={12} />
                <span>{elapsedTime}s</span>
              </div>
              <div className="status-stat">
                <Database size={12} />
                <span>{totalBytes}KB</span>
              </div>
              <div className="status-stat">
                <Package size={12} />
                <span>{totalProducts} products</span>
              </div>
            </div>
          </div>

          {/* Main Content: Terminal + Progress Side by Side */}
          <div className="scraper-live-grid">
            {/* Light Log Panel */}
            <div className="scraper-terminal">
              <div className="terminal-header" style={{background:'#F8FAFC', borderBottom:'1px solid #E2E8F0'}}>
                <div className="terminal-dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <span className="terminal-title" style={{color:'#64748B'}}>
                  <Terminal size={12} /> scraper-engine — log
                </span>
                <div className="terminal-badge">
                  {phase === 'scraping' && <Activity size={11} className="spinning" />}
                  {phase === 'scraping' ? 'Running' : 'Finished'}
                </div>
              </div>
              <div className="terminal-body" ref={terminalRef} style={{background:'#FAFBFC', color:'#334155'}}>
                {logs.map((log) => (
                  <div key={log.id} className="terminal-line">
                    <span className="terminal-time" style={{color:'#94A3B8'}}>{log.time}</span>
                    <span
                      className="terminal-msg"
                      style={{ color: LOG_COLORS[log.level] || '#475569' }}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
                {phase === 'scraping' && (
                  <div className="terminal-cursor">
                    <span className="cursor-blink" style={{color:'#6366F1'}}>█</span>
                  </div>
                )}
              </div>
            </div>

            {/* Marketplace Progress Cards */}
            <div className="scraper-progress-panel">
              <div className="progress-panel-title">
                <Globe size={14} />
                <span>Marketplace Status</span>
              </div>
              {marketplaces.map((mp, idx) => (
                <div
                  key={mp.name}
                  className={`mp-progress-card ${mp.status === 'scraping' ? 'active' : ''} ${mp.status === 'done' ? 'done' : ''} ${mp.status === 'failed' ? 'failed' : ''}`}
                >
                  <div className="mp-progress-header">
                    <div className="mp-progress-left">
                      <span className="mp-progress-icon">{mp.icon}</span>
                      <div>
                        <div className="mp-progress-name">{mp.name}</div>
                        <div className="mp-progress-domain">{mp.domain}</div>
                      </div>
                    </div>
                    <div className="mp-progress-status-badge">
                      {mp.status === 'waiting' && <span className="badge-waiting">Waiting</span>}
                      {mp.status === 'scraping' && (
                        <span className="badge-scraping">
                          <Wifi size={10} className="spinning" /> Crawling
                        </span>
                      )}
                      {mp.status === 'done' && (
                        <span className="badge-done">
                          <CheckCircle2 size={10} /> Done
                        </span>
                      )}
                      {mp.status === 'failed' && (
                        <span className="badge-failed">
                          <XCircle size={10} /> Failed
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="mp-progress-bar-wrap">
                    <div
                      className="mp-progress-bar-fill"
                      style={{
                        width: `${mp.progress}%`,
                        background: mp.status === 'done'
                          ? 'var(--green)'
                          : mp.status === 'failed'
                          ? 'var(--red)'
                          : `linear-gradient(90deg, ${marketplaceColors[mp.name]}, ${marketplaceColors[mp.name]}88)`,
                      }}
                    ></div>
                  </div>
                  {/* Stats Row */}
                  {(mp.status === 'done' || mp.status === 'failed') && (
                    <div className="mp-progress-stats">
                      <span>{mp.productsFound} products</span>
                      <span>{(mp.durationMs / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Network Activity Viz */}
              {phase === 'scraping' && (
                <div className="network-activity" style={{background:'#F1F5F9', border:'1px solid #E2E8F0'}}>
                  <div className="network-title" style={{color:'#64748B'}}>
                    <Activity size={12} /> Network Activity
                  </div>
                  <div className="network-bars">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="network-bar"
                        style={{
                          animationDelay: `${i * 0.08}s`,
                          height: `${Math.random() * 60 + 20}%`,
                          background: 'linear-gradient(0deg, #6366F1, #06B6D4)',
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          RESULTS (after scraping is done)
          ═══════════════════════════════════════════════════════════════ */}

      {/* Analysis Overview */}
      {scrapeResult && phase === 'done' && scrapeResult.analysis && (
        <div className="scraper-analysis" style={{ animationDelay: '0.2s' }}>
          <h3 className="scraper-section-title"><BarChart3 size={16} /> Competitive Analysis</h3>
          <div className="scraper-analysis-grid">
            <div className="analysis-card">
              <div className="analysis-label">Our Price</div>
              <div className="analysis-value accent">₹{scrapeResult.analysis.our_price}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-label">Market Average</div>
              <div className="analysis-value">₹{scrapeResult.analysis.overall_avg_price}</div>
              <div className={`analysis-badge ${scrapeResult.analysis.our_price <= scrapeResult.analysis.overall_avg_price ? 'positive' : 'negative'}`}>
                {scrapeResult.analysis.our_price <= scrapeResult.analysis.overall_avg_price ? (
                  <><TrendingDown size={12} /> Below Avg</>
                ) : (
                  <><TrendingUp size={12} /> Above Avg</>
                )}
              </div>
            </div>
            <div className="analysis-card">
              <div className="analysis-label">Price Range</div>
              <div className="analysis-value">₹{scrapeResult.analysis.overall_min_price} – ₹{scrapeResult.analysis.overall_max_price}</div>
            </div>
            <div className="analysis-card">
              <div className="analysis-label">Position</div>
              <div className="analysis-value">{scrapeResult.analysis.price_position}</div>
              <div className="analysis-sub">
                {scrapeResult.analysis.competitors_cheaper} cheaper • {scrapeResult.analysis.competitors_pricier} pricier
              </div>
            </div>
          </div>

          {/* Key Insights Row */}
          {scrapeResult.analysis.best_match && (
            <div className="scraper-insights-row">
              <div className="insight-card">
                <Award size={16} className="insight-icon best" />
                <div>
                  <div className="insight-title">Best Match</div>
                  <div className="insight-val">{scrapeResult.analysis.best_match.brand} — {scrapeResult.analysis.best_match.match_score}% match</div>
                  <div className="insight-price">₹{scrapeResult.analysis.best_match.price}</div>
                </div>
              </div>
              {scrapeResult.analysis.cheapest && (
                <div className="insight-card">
                  <Tag size={16} className="insight-icon cheap" />
                  <div>
                    <div className="insight-title">Cheapest</div>
                    <div className="insight-val">{scrapeResult.analysis.cheapest.brand}</div>
                    <div className="insight-price">₹{scrapeResult.analysis.cheapest.price}</div>
                  </div>
                </div>
              )}
              {scrapeResult.analysis.most_reviewed && (
                <div className="insight-card">
                  <Star size={16} className="insight-icon popular" />
                  <div>
                    <div className="insight-title">Most Reviewed</div>
                    <div className="insight-val">{scrapeResult.analysis.most_reviewed.brand}</div>
                    <div className="insight-price">{scrapeResult.analysis.most_reviewed.review_count.toLocaleString()} reviews</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Marketplace Results */}
      {scrapeResult && phase === 'done' && scrapeResult.marketplaces?.map(mp => (
        <div key={mp.marketplace} className="scraper-marketplace">
          <button className="scraper-mp-header" onClick={() => toggleMP(mp.marketplace)}>
            <div className="scraper-mp-left">
              <span className="mp-icon">{{'Amazon':'🛒','Flipkart':'🏪','Myntra':'👕','Ajio':'🏬'}[mp.marketplace]}</span>
              <span className="mp-name">{mp.marketplace}</span>
              <span className="mp-count">{mp.products_found} products</span>
            </div>
            <div className="scraper-mp-right">
              <div className="mp-stat-pills">
                <span className="mp-pill">Avg ₹{mp.stats.avg_price}</span>
                <span className="mp-pill">⭐ {mp.stats.avg_rating}</span>
                <span className="mp-pill">{mp.stats.avg_discount}% off</span>
                <span className={`mp-pill ${mp.stats.avg_vs_ours > 0 ? 'higher' : 'lower'}`}>
                  {mp.stats.avg_vs_ours > 0 ? '+' : ''}{mp.stats.avg_vs_ours}% vs ours
                </span>
              </div>
              {expandedMP[mp.marketplace] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </button>

          {expandedMP[mp.marketplace] && (
            <div className="scraper-mp-body">
              {mp.products.map((prod, idx) => {
                const pKey = `${mp.marketplace}-${idx}`;
                const isExpanded = expandedProduct[pKey];
                return (
                  <div key={pKey} className={`scraped-product ${isExpanded ? 'expanded' : ''}`}>
                    <div className="scraped-product-header" onClick={() => toggleProduct(pKey)}>
                      <div className="scraped-product-main">
                        <div className="scraped-product-rank">#{idx + 1}</div>
                        <div className="scraped-product-info">
                          <div className="scraped-product-title">
                            <span className="scraped-brand">{prod.brand}</span>
                            <span className="scraped-name">{prod.name}</span>
                          </div>
                          <div className="scraped-product-meta-row">
                            <span className="scraped-price">₹{prod.price}</span>
                            <span className="scraped-original">₹{prod.original_price}</span>
                            <span className="scraped-discount">{prod.discount}% off</span>
                            <span className="scraped-rating">⭐ {prod.rating}</span>
                            <span className="scraped-reviews">{prod.review_count.toLocaleString()} reviews</span>
                          </div>
                        </div>
                      </div>
                      <div className="scraped-product-right">
                        <div className={`match-badge ${prod.match_score >= 70 ? 'high' : prod.match_score >= 45 ? 'mid' : 'low'}`}>
                          {prod.match_score}% match
                        </div>
                        <div className={`price-diff-badge ${prod.price_diff > 0 ? 'higher' : prod.price_diff < 0 ? 'lower' : 'same'}`}>
                          {prod.price_diff > 0 ? <TrendingUp size={12} /> : prod.price_diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                          {prod.price_diff > 0 ? '+' : ''}₹{prod.price_diff}
                        </div>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="scraped-product-details">
                        <div className="scraped-detail-grid">
                          {/* Specs Comparison */}
                          <div className="scraped-detail-section">
                            <h4><Package size={14} /> Specifications</h4>
                            <div className="spec-compare-grid">
                              {Object.entries(prod.specifications).map(([key, val]) => {
                                const ourVal = activeProduct?.specifications?.[key];
                                const isMatch = ourVal && ourVal.toLowerCase() === val.toLowerCase();
                                return (
                                  <div key={key} className={`spec-compare-row ${isMatch ? 'match' : 'diff'}`}>
                                    <span className="spec-compare-key">{key}</span>
                                    <span className="spec-compare-theirs">{val}</span>
                                    <span className="spec-compare-ours">{ourVal || '—'}</span>
                                    <span className="spec-compare-status">
                                      {isMatch ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Details Sidebar */}
                          <div className="scraped-detail-section">
                            <h4><Zap size={14} /> Details</h4>
                            <div className="scraped-detail-list">
                              <div className="detail-row">
                                <span>Delivery</span><span>{prod.delivery}</span>
                              </div>
                              <div className="detail-row">
                                <span>Sellers</span><span>{prod.seller_count}</span>
                              </div>
                              <div className="detail-row">
                                <span>In Stock</span>
                                <span className={prod.in_stock ? 'stock-yes' : 'stock-no'}>
                                  {prod.in_stock ? 'Yes' : 'Out of Stock'}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span>Sizes</span>
                                <span className="sizes-inline">{prod.sizes_available.join(', ')}</span>
                              </div>
                            </div>
                            <a href={prod.url} target="_blank" rel="noopener noreferrer" className="scraped-view-link">
                              View on {mp.marketplace} <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Empty state */}
      {phase === 'idle' && (
        <div className="scraper-empty">
          <Radar size={52} strokeWidth={1} />
          <h3>Ready to Scan</h3>
          <p>Click <strong>Run Scraper</strong> to crawl Amazon, Flipkart, Myntra, and Ajio for competitor product data and pricing intelligence.</p>
        </div>
      )}
    </div>
  );
}
