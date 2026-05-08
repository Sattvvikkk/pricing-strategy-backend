import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, Tooltip,
  BarChart, Bar,
} from 'recharts';
import {
  Database, Globe, Package, BrainCircuit, DollarSign, Bot, Sliders,
  ChevronLeft, ChevronRight, Check, ArrowUpRight, Info, Sparkles,
} from 'lucide-react';
import { fadeUp, stagger, EASE, DURATION } from '../motion/tokens';

const STEPS = [
  { id: 'ingest', label: 'Data Ingestion', icon: Database, title: 'Step 1 - Connect Your Data Sources', description: 'Activate scrapers and feeds for marketplaces, internal data, and ad platforms.', deepLink: '/app/scraper', deepLinkLabel: 'Open Scraper Engine' },
  { id: 'marketplace', label: 'Marketplace', icon: Globe, title: 'Step 2 - Marketplace Intelligence', description: 'Visualize price trends, market share, and top movers.', deepLink: '/app/marketplace', deepLinkLabel: 'Open Marketplace Insights' },
  { id: 'inventory', label: 'Product Health', icon: Package, title: 'Step 3 - Product & Inventory Health', description: 'Stock levels, deadstock risk, sell-through, and margin signals.', deepLink: '/app/inventory', deepLinkLabel: 'Open Inventory Optimization' },
  { id: 'forecast', label: 'Forecasting', icon: BrainCircuit, title: 'Step 4 - ML Forecasting & Insights', description: 'Demand, elasticity, competitor reaction, and customer segments.', deepLink: '/app/ml', deepLinkLabel: 'Open ML Engine' },
  { id: 'pricing', label: 'Pricing', icon: DollarSign, title: 'Step 5 - Dynamic Pricing Engine', description: 'AI-recommended price moves with revenue/margin impact.', deepLink: '/app/competitor-reaction', deepLinkLabel: 'Open Competitor Reaction' },
  { id: 'strategy', label: 'Strategy', icon: Bot, title: 'Step 6 - AI Strategy Builder', description: 'Generate a multi-pronged strategy from a natural-language goal.', deepLink: '/app/ai-copilot', deepLinkLabel: 'Open AI Copilot' },
  { id: 'simulate', label: 'Simulation', icon: Sliders, title: 'Step 7 - Scenario Simulation', description: 'Move sliders. See projected revenue, margin, sell-through.', deepLink: '/app/simulator', deepLinkLabel: 'Open Scenario Simulator' },
];

function StepIngest() {
  const sources = [
    { name: 'Amazon', status: 'live', last: '2m ago', rows: '12,482' },
    { name: 'Flipkart', status: 'live', last: '4m ago', rows: '8,931' },
    { name: 'Shopify', status: 'live', last: '1m ago', rows: '4,203' },
    { name: 'Google Ads', status: 'idle', last: '1h ago', rows: '612' },
  ];
  return (
    <div className="ip-cards">
      {sources.map((s) => (
        <div key={s.name} className={`ip-source ip-source--${s.status}`}>
          <div className="ip-source__head">
            <span className="ip-source__name">{s.name}</span>
            <span className={`ip-source__dot ip-source__dot--${s.status}`} />
          </div>
          <div className="ip-source__meta">
            <span>{s.rows} rows</span>
            <span>{s.last}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepMarketplace() {
  const stats = [
    { label: 'Avg Market Price', value: '2,450', sub: 'across 12 SKUs' },
    { label: 'Your Avg Price', value: '2,640', sub: '+7.7% premium' },
    { label: 'Top Mover', value: 'Sneakers', sub: '+18% W/W' },
    { label: 'Search Demand', value: 'High', sub: 'Weekend spike' },
  ];
  return (
    <div className="ip-cards">
      {stats.map((s) => (
        <div key={s.label} className="ip-stat">
          <div className="ip-stat__label">{s.label}</div>
          <div className="ip-stat__value">{s.value}</div>
          <div className="ip-stat__sub">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function StepInventory() {
  const items = [
    { name: 'Cotton Tee - Black', stock: 432, status: 'Healthy', margin: 'Good' },
    { name: 'Slim-Fit Denim', stock: 87, status: 'Low-Stock', margin: 'Fair' },
    { name: 'Floral Maxi Dress', stock: 612, status: 'Overstock', margin: 'Poor' },
    { name: 'Bomber Jacket', stock: 244, status: 'Healthy', margin: 'Good' },
  ];
  return (
    <div className="ip-table">
      <div className="ip-table__row ip-table__row--head">
        <span>Product</span><span>Stock</span><span>Status</span><span>Margin</span>
      </div>
      {items.map((i) => (
        <div key={i.name} className="ip-table__row">
          <span>{i.name}</span>
          <span>{i.stock}</span>
          <span className={`ip-pill ip-pill--${i.status.toLowerCase()}`}>{i.status.replace('-', ' ')}</span>
          <span className={`ip-pill ip-pill--${i.margin.toLowerCase()}`}>{i.margin}</span>
        </div>
      ))}
    </div>
  );
}

const FORECAST_SERIES = [
  { d: 'Mon', y: 42 }, { d: 'Tue', y: 48 }, { d: 'Wed', y: 51 },
  { d: 'Thu', y: 47 }, { d: 'Fri', y: 58 }, { d: 'Sat', y: 72 }, { d: 'Sun', y: 78 },
];
const ELASTICITY_SERIES = [
  { p: '-10%', q: 18 }, { p: '-5%', q: 9 }, { p: '0%', q: 0 },
  { p: '+5%', q: -7 }, { p: '+10%', q: -14 },
];

function MiniChart({ kind }) {
  if (kind === 'area') {
    return (
      <ResponsiveContainer width="100%" height={56}>
        <AreaChart data={FORECAST_SERIES} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="miniA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ceed6f" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#ceed6f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="y" stroke="#a3d540" strokeWidth={1.75} fill="url(#miniA)" />
          <XAxis dataKey="d" hide />
          <Tooltip cursor={false} contentStyle={{ background: '#0d1f18', border: '1px solid rgba(206,237,111,0.2)', borderRadius: 6, fontSize: 11, color: '#e9efe9' }} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={56}>
      <BarChart data={ELASTICITY_SERIES} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Bar dataKey="q" fill="#ceed6f" radius={[2, 2, 0, 0]} />
        <XAxis dataKey="p" hide />
        <Tooltip cursor={false} contentStyle={{ background: '#0d1f18', border: '1px solid rgba(206,237,111,0.2)', borderRadius: 6, fontSize: 11, color: '#e9efe9' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StepForecast() {
  const items = [
    { title: 'Demand Forecast', value: '+28%', sub: 'Weekend spike', conf: 92, chart: 'area', why: 'Historical weekend pattern + Google Trends spike +41%' },
    { title: 'Price Elasticity', value: '-1.5', sub: '5% drop to +8% volume', conf: 87, chart: 'bar', why: 'Computed from 90-day price/sales regression (R²=0.82)' },
    { title: 'Competitor Reaction', value: '34%', sub: 'Price war probability', conf: 76, chart: 'area', why: 'Competitor X cut prices in 3 of last 5 similar windows' },
    { title: 'Customer Segments', value: '4', sub: '23% loyal premium', conf: 89, chart: 'bar', why: 'K-means on RFM + price-sensitivity (silhouette=0.61)' },
  ];
  return (
    <motion.div className="ip-cards" variants={stagger(0.06)} initial="initial" animate="animate">
      {items.map((f) => (
        <motion.div key={f.title} className="ip-forecast" variants={fadeUp}>
          <div className="ip-forecast__title">
            {f.title}
            <span className="ip-why" tabIndex={0} aria-label={`Why: ${f.why}`}>
              <Info size={12} />
              <span className="ip-why__pop">{f.why}</span>
            </span>
          </div>
          <div className="ip-forecast__value">{f.value}</div>
          <div className="ip-forecast__sub">{f.sub}</div>
          <div className="ip-forecast__chart"><MiniChart kind={f.chart} /></div>
          <div className="ip-forecast__conf">
            <span>Confidence</span>
            <span className="ip-forecast__conf-value">{f.conf}%</span>
          </div>
          <div className="ip-confbar">
            <motion.span
              className="ip-confbar__fill"
              initial={{ width: 0 }}
              animate={{ width: `${f.conf}%` }}
              transition={{ duration: 1, ease: EASE.outExpo, delay: 0.2 }}
            />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function StepPricing() {
  const moves = [
    { sku: 'Cotton Tee - Black', from: 799, to: 849, impact: '+12% revenue', dir: 'up' },
    { sku: 'Slim-Fit Denim', from: 1899, to: 1799, impact: '+18% volume', dir: 'down' },
    { sku: 'Floral Maxi Dress', from: 1299, to: 999, impact: 'Clear stock', dir: 'down' },
  ];
  return (
    <div className="ip-pricing">
      {moves.map((m) => (
        <div key={m.sku} className="ip-price-row">
          <div className="ip-price-row__sku">{m.sku}</div>
          <div className="ip-price-row__prices">
            <span className="ip-price-row__from">Rs.{m.from}</span>
            <ArrowUpRight size={14} className={`ip-price-row__arrow ip-price-row__arrow--${m.dir}`} />
            <span className="ip-price-row__to">Rs.{m.to}</span>
          </div>
          <div className="ip-price-row__impact">{m.impact}</div>
        </div>
      ))}
      <div className="ip-reasoning">
        <div className="ip-reasoning__title">AI Reasoning</div>
        <ul>
          <li>Competitor average price up 4% this week</li>
          <li>Forecast demand spike for weekend (+28%)</li>
          <li>Inventory turnover healthy (30-day supply)</li>
          <li>Historical elasticity: 5% hike to +8% profit</li>
        </ul>
      </div>
    </div>
  );
}

function StepStrategy() {
  return (
    <div className="ip-strategy">
      <div className="ip-strategy__prompt">
        <div className="ip-strategy__prompt-label">Goal</div>
        <div className="ip-strategy__prompt-text">Maximize profit margin this month.</div>
      </div>
      <div className="ip-strategy__plan">
        <div className="ip-strategy__plan-title">AI-Generated Strategy</div>
        <div className="ip-strategy__plan-items">
          <div className="ip-strategy__plan-item">
            <span className="ip-strategy__plan-num">1</span>
            <div>
              <div className="ip-strategy__plan-head">Raise prices on premium SKUs (+5%)</div>
              <div className="ip-strategy__plan-desc">High elasticity buffer; competitor avg up 4%</div>
            </div>
          </div>
          <div className="ip-strategy__plan-item">
            <span className="ip-strategy__plan-num">2</span>
            <div>
              <div className="ip-strategy__plan-head">Bundle slow-movers with hero products</div>
              <div className="ip-strategy__plan-desc">Clears overstock; lifts AOV ~12%</div>
            </div>
          </div>
          <div className="ip-strategy__plan-item">
            <span className="ip-strategy__plan-num">3</span>
            <div>
              <div className="ip-strategy__plan-head">Shift ad spend to top-margin segments</div>
              <div className="ip-strategy__plan-desc">Premium loyal cluster (23% base)</div>
            </div>
          </div>
        </div>
        <div className="ip-strategy__impact">
          <div><span>Revenue</span><strong className="positive">+18%</strong></div>
          <div><span>Margin</span><strong className="positive">+22%</strong></div>
          <div><span>Confidence</span><strong>87%</strong></div>
        </div>
      </div>
    </div>
  );
}

function StepSimulate() {
  return (
    <div className="ip-simulate">
      <div className="ip-simulate__intro">
        Adjust pricing, ad spend, and inventory to project outcomes in real time.
      </div>
      <div className="ip-simulate__compare">
        <div className="ip-simulate__col">
          <div className="ip-simulate__col-label">Before</div>
          <div className="ip-simulate__metrics">
            <div><span>Revenue</span><strong>Rs.12L</strong></div>
            <div><span>Margin</span><strong>18%</strong></div>
            <div><span>Sell-through</span><strong>61%</strong></div>
          </div>
        </div>
        <div className="ip-simulate__arrow">&rarr;</div>
        <div className="ip-simulate__col ip-simulate__col--after">
          <div className="ip-simulate__col-label">After</div>
          <div className="ip-simulate__metrics">
            <div><span>Revenue</span><strong>Rs.14.2L</strong></div>
            <div><span>Margin</span><strong>22%</strong></div>
            <div><span>Sell-through</span><strong>83%</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEP_CONTENT = {
  ingest: StepIngest,
  marketplace: StepMarketplace,
  inventory: StepInventory,
  forecast: StepForecast,
  pricing: StepPricing,
  strategy: StepStrategy,
  simulate: StepSimulate,
};

export default function IntelligencePipeline() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const step = STEPS[active];
  const StepContent = STEP_CONTENT[step.id];
  const ActiveIcon = step.icon;

  return (
    <div className="ip-page">
      {/* Header */}
      <div className="ip-header">
        <div>
          <div className="ip-header__eyebrow">Intelligence Pipeline</div>
          <h1 className="ip-header__title">AI Command Center</h1>
          <p className="ip-header__sub">
            Follow the guided workflow from raw data to executable strategy. Each step unlocks the next.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="ip-stepper" role="tablist" aria-label="Intelligence pipeline steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === active;
          const isDone = i < active;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'step' : undefined}
              className={`ip-step ${isActive ? 'ip-step--active' : ''} ${isDone ? 'ip-step--done' : ''}`}
              onClick={() => setActive(i)}
            >
              <span className="ip-step__circle">
                {isDone ? <Check size={14} /> : <Icon size={14} />}
              </span>
              <span className="ip-step__label">
                <span className="ip-step__index">{String(i + 1).padStart(2, '0')}</span>
                <span className="ip-step__text">{s.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Step Panel */}
      <div className="ip-panel">
        <div className="ip-panel__head">
          <div className="ip-panel__head-left">
            <span className="ip-panel__icon"><ActiveIcon size={18} /></span>
            <div>
              <h2 className="ip-panel__title">{step.title}</h2>
              <p className="ip-panel__desc">{step.description}</p>
            </div>
          </div>
          <button
            type="button"
            className="ip-deep-link"
            onClick={() => navigate(step.deepLink)}
          >
            {step.deepLinkLabel}
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="ip-panel__body">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DURATION.base, ease: EASE.out }}
            >
              <StepContent />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="ip-panel__foot">
          <button
            type="button"
            className="ip-btn ip-btn--ghost"
            onClick={() => setActive((i) => Math.max(0, i - 1))}
            disabled={active === 0}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <div className="ip-panel__progress">
            Step {active + 1} of {STEPS.length}
          </div>
          <button
            type="button"
            className="ip-btn ip-btn--primary"
            onClick={() => setActive((i) => Math.min(STEPS.length - 1, i + 1))}
            disabled={active === STEPS.length - 1}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
