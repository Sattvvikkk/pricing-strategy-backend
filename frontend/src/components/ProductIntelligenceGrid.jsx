import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, ShieldCheck, ShieldAlert,
  Sparkles, Star, Package,
} from 'lucide-react';
import API from '../api/client';
import { stagger, fadeUp, EASE, DURATION } from '../motion/tokens';

const RISK_META = {
  low:    { Icon: ShieldCheck,   label: 'Healthy',   cls: 'pi-card__risk--low' },
  medium: { Icon: ShieldAlert,   label: 'Watch',     cls: 'pi-card__risk--med' },
  high:   { Icon: AlertTriangle, label: 'Action',    cls: 'pi-card__risk--high' },
};

/** Derive a status from real product data — no fake signals. */
function deriveStatus(p) {
  const margin = p.price > 0 ? ((p.price - p.cost_price) / p.price) * 100 : 0;
  let risk = 'low';
  if (p.stock < 100 || margin < 30) risk = 'medium';
  if (p.stock < 50 || margin < 20) risk = 'high';
  return { margin, risk };
}

export default function ProductIntelligenceGrid() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    API.get('/api/products')
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data?.products ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Products fetch failed:', err);
        setError('Could not load products');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Show top 6 by review count (real popularity signal)
  const top = [...products]
    .sort((a, b) => (b.reviews || 0) - (a.reviews || 0))
    .slice(0, 6);

  return (
    <section className="pi-grid-section">
      <div className="pi-grid-section__head">
        <div>
          <h2 className="pi-grid-section__title">Product Intelligence</h2>
          <p className="pi-grid-section__sub">
            Top SKUs ranked by engagement &mdash; live from your catalog.
          </p>
        </div>
        <span className="pi-grid-section__chip">
          <Sparkles size={12} strokeWidth={2.25} /> {products.length} SKUs
        </span>
      </div>

      {error ? (
        <div className="pi-empty">{error}</div>
      ) : loading ? (
        <div className="pi-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="pi-card pi-card--skel">
              <div className="pe-skel" style={{ height: 36, width: 36, borderRadius: 10 }} />
              <div className="pe-skel" style={{ height: 14, width: '70%', borderRadius: 4 }} />
              <div className="pe-skel" style={{ height: 12, width: '40%', borderRadius: 4 }} />
              <div className="pe-skel" style={{ height: 60, width: '100%', borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          className="pi-grid"
          variants={stagger(0.05, 0)}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.05 }}
        >
          {top.map((p) => {
            const { margin, risk } = deriveStatus(p);
            const Risk = RISK_META[risk];
            const initial = p.name?.charAt(0)?.toUpperCase() || 'P';
            return (
              <motion.article
                key={p.id}
                className="pi-card"
                variants={fadeUp}
                whileHover={{ y: -3, transition: { duration: DURATION.fast, ease: EASE.out } }}
              >
                <header className="pi-card__head">
                  <div className="pi-card__thumb" aria-hidden="true">{initial}</div>
                  <div className="pi-card__title-block">
                    <h3 className="pi-card__title">{p.name}</h3>
                    <span className="pi-card__cat">{p.category} · {p.sku}</span>
                  </div>
                  <span className={`pi-card__risk ${Risk.cls}`}>
                    <Risk.Icon size={12} strokeWidth={2.25} />
                    {Risk.label}
                  </span>
                </header>

                <dl className="pi-card__metrics">
                  <div className="pi-card__metric">
                    <dt>Price</dt>
                    <dd>₹{p.price?.toLocaleString('en-IN')}</dd>
                  </div>
                  <div className="pi-card__metric">
                    <dt>Stock</dt>
                    <dd>
                      <Package size={11} />
                      {p.stock?.toLocaleString()}
                    </dd>
                  </div>
                  <div className="pi-card__metric">
                    <dt>Margin</dt>
                    <dd className={margin >= 50 ? 'is-up' : margin >= 30 ? '' : 'is-down'}>
                      {margin.toFixed(0)}%
                    </dd>
                  </div>
                  <div className="pi-card__metric">
                    <dt>Rating</dt>
                    <dd>
                      <Star size={11} fill="currentColor" />
                      {p.rating?.toFixed(1)}
                    </dd>
                  </div>
                </dl>

                <div className="pi-card__rec">
                  <Sparkles size={13} strokeWidth={2} />
                  <span className="pi-card__rec-text">
                    {p.reviews?.toLocaleString()} reviews &middot; cost ₹{p.cost_price?.toLocaleString('en-IN')}
                  </span>
                </div>

                <footer className="pi-card__foot">
                  <div className="pi-card__confidence">
                    <span className="pi-card__confidence-label">Engagement</span>
                    <span className="pi-card__confidence-value">{p.reviews}</span>
                  </div>
                  <div className="pi-card__bar">
                    <motion.span
                      className="pi-card__bar-fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(100, ((p.reviews || 0) / 320) * 100)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: EASE.outExpo, delay: 0.2 }}
                    />
                  </div>
                  <CheckCircle2 size={14} className="pi-card__check" />
                </footer>
              </motion.article>
            );
          })}
        </motion.div>
      )}
    </section>
  );
}
