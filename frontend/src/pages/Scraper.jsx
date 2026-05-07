import { useEffect, useMemo, useRef, useState } from 'react';
import { Radio, TrendingUp, TrendingDown } from 'lucide-react';

import { useProduct } from '../context/ProductContext';

/* ─── Log message → CSS class ───────────────────────────────── */
function logClassFor(type) {
  switch (type) {
    case 'SUCCESS':
    case 'TIER_RESULT':
    case 'MP_DONE':
      return 'sp-log--success';
    case 'ERROR':
      return 'sp-log--error';
    case 'RESULT':
      return 'sp-log--result';
    case 'SUMMARY':
      return 'sp-log--summary';
    case 'DONE':
      return 'sp-log--done';
    case 'TIER_ATTEMPT':
    case 'MP_START':
    case 'INFO':
    default:
      return 'sp-log--info';
  }
}

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');

const tsNow = () => {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function Scraper() {
  const { activeProduct } = useProduct();
  const productId = activeProduct?.id || activeProduct?.product_id;
  const ourPrice  = Number(activeProduct?.price ?? activeProduct?.current_price ?? 0);
  const searchQuery = activeProduct?.search_query
    || `${activeProduct?.name || 'product'} ${activeProduct?.brand || ''}`.trim();

  const [logs, setLogs]           = useState([]);
  const [results, setResults]     = useState([]);
  const [summary, setSummary]     = useState(null);
  const [isScanning, setScanning] = useState(false);
  const [hasScanned, setScanned]  = useState(false);
  const [sourceBadge, setSource]  = useState(null); // 'live' | 'sample'

  const esRef       = useRef(null);
  const terminalRef = useRef(null);

  // Auto-scroll terminal to bottom whenever a new log arrives
  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  // Cleanup any open EventSource on unmount or product change
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [productId]);

  const startScan = () => {
    if (!productId || isScanning) return;

    // Reset state
    setLogs([]);
    setResults([]);
    setSummary(null);
    setSource(null);
    setScanning(true);
    setScanned(true);

    // Open SSE stream
    const baseURL = import.meta.env.VITE_API_URL || '';
    const url = `${baseURL}/api/scraper/stream/${productId}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const ts = tsNow();
        const message = msg.message || msg.type;

        setLogs((prev) => [...prev, { ts, type: msg.type, message }]);

        if (msg.type === 'RESULT') {
          setResults((prev) => [...prev, msg]);
        }
        if (msg.type === 'SUMMARY') {
          setSummary(msg);
          // Source badge inference
          const src = (msg.source_badge || '').toLowerCase();
          if (src.includes('🟢') || src.includes('serpapi') || src.includes('live')) {
            setSource('live');
          } else if (src.includes('⚪') || src.includes('sample') || src.includes('static')) {
            setSource('sample');
          } else {
            setSource('live');
          }
        }
        if (msg.type === 'DONE') {
          setScanning(false);
          es.close();
          esRef.current = null;
        }
      } catch (err) {
        console.error('SSE parse error:', err, evt.data);
      }
    };

    es.onerror = (err) => {
      console.error('SSE error:', err);
      setLogs((prev) => [
        ...prev,
        { ts: tsNow(), type: 'ERROR', message: 'Connection lost. Try again.' },
      ]);
      setScanning(false);
      es.close();
      esRef.current = null;
    };
  };

  // Sort results: cheapest first
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => (a.price || 0) - (b.price || 0));
  }, [results]);

  return (
    <div className="sp">
      {/* Section 1 — Header */}
      <div className="sp__header">
        <div className="sp__header-left">
          <div className="sp__supra">Scanning competitors for:</div>
          <div className="sp__product-name">{activeProduct?.name || '—'}</div>
          <div className="sp__query">{searchQuery}</div>
        </div>

        <div className="sp__header-right">
          {sourceBadge === 'live' && (
            <span className="badge-success">LIVE · Google Shopping</span>
          )}
          {sourceBadge === 'sample' && (
            <span className="badge-neutral">SAMPLE DATA</span>
          )}

          <button
            type="button"
            className="btn-primary sp__scan-btn"
            onClick={startScan}
            disabled={isScanning || !productId}
          >
            {isScanning ? (
              <>
                <span className="sp-spinner" aria-hidden="true" />
                Scanning…
              </>
            ) : (
              <>
                <Radio size={14} />
                Scan Competitors
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section 2 — Terminal */}
      <div className="sp-terminal">
        <div className="sp-terminal__top">
          <span className="sp-terminal__dot" style={{ background: '#EF4444' }} />
          <span className="sp-terminal__dot" style={{ background: '#F59E0B' }} />
          <span className="sp-terminal__dot" style={{ background: '#22C55E' }} />
          <span className="sp-terminal__sep" />
          <span className="sp-terminal__title">competitor-scanner</span>
        </div>

        <div className="sp-terminal__body" ref={terminalRef}>
          {!hasScanned ? (
            <div className="sp-terminal__empty">
              <Radio size={32} />
              <div className="sp-terminal__empty-title">
                Click &lsquo;Scan Competitors&rsquo; to start
              </div>
              <div className="sp-terminal__empty-sub">
                Will search for: {searchQuery}
              </div>
            </div>
          ) : (
            logs.map((line, i) => {
              const isLast = i === logs.length - 1;
              return (
                <div key={i} className={`sp-log ${logClassFor(line.type)}`}>
                  <span className="sp-log__ts">{line.ts}</span>
                  <span className="sp-log__msg">
                    {line.message}
                    {isLast && isScanning && <span className="sp-cursor" aria-hidden="true" />}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Section 3 — Results (after scan) */}
      {summary && results.length > 0 && (
        <div className="sp-results">
          {/* Market stats */}
          <div className="sp-stats">
            <div className="card-sm sp-stat">
              <div className="sp-stat__label">Min Price</div>
              <div className="sp-stat__value">₹{fmt(summary.min_price)}</div>
            </div>
            <div className="card-sm sp-stat">
              <div className="sp-stat__label">Avg Price</div>
              <div className="sp-stat__value">₹{fmt(summary.avg_price)}</div>
            </div>
            <div className="card-sm sp-stat">
              <div className="sp-stat__label">Max Price</div>
              <div className="sp-stat__value">₹{fmt(summary.max_price)}</div>
            </div>
            <div className="card-sm sp-stat">
              <div className="sp-stat__label">Listings Found</div>
              <div className="sp-stat__value">{summary.count}</div>
            </div>
          </div>

          {/* Listings table */}
          <div className="card sp-table-card">
            <div className="sp-table-card__head">
              <h3 className="sp-table-card__title">Competitor Listings</h3>
              {sourceBadge === 'live' && (
                <span className="badge-success">Live data</span>
              )}
              {sourceBadge === 'sample' && (
                <span className="badge-neutral">Sample data</span>
              )}
            </div>

            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Product</th>
                    <th>Price</th>
                    <th>vs Vouge Studio</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r, i) => {
                    const diff = r.diff_pct != null
                      ? Number(r.diff_pct)
                      : ourPrice > 0
                        ? ((Number(r.price) - ourPrice) / ourPrice) * 100
                        : 0;
                    const cheaper = diff < 0;
                    const title = (r.title || r.merchant_title || r.message || '').toString();
                    const truncated = title.length > 50 ? title.slice(0, 50) + '…' : title;
                    return (
                      <tr key={i}>
                        <td className="sp-table__platform">{r.marketplace || r.platform || '—'}</td>
                        <td className="sp-table__product" title={title}>{truncated || r.merchant}</td>
                        <td className="sp-table__price">₹{fmt(r.price)}</td>
                        <td>
                          <span className={`sp-table__delta ${cheaper ? 'sp-table__delta--down' : 'sp-table__delta--up'}`}>
                            {cheaper ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                            {cheaper ? '' : '+'}{diff.toFixed(1)}% {cheaper ? 'cheaper' : 'pricier'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
