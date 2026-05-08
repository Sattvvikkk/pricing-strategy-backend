import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { ArrowRight, Sparkles, TrendingUp, BrainCircuit, Zap } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

const HIGHLIGHTS = [
  { Icon: TrendingUp,   label: 'Forecast demand & elasticity' },
  { Icon: BrainCircuit, label: 'AI-generated pricing strategy' },
  { Icon: Zap,          label: 'Autonomous execution rules' },
];

const METRIC_CARDS = [
  { label: 'Revenue Lift',  value: '+23.4%',   color: '#CEED6F', barW: '72%' },
  { label: 'Price Index',   value: '0.94',      color: '#4ade80', barW: '58%' },
  { label: 'Demand Score',  value: '87 / 100',  color: '#86efac', barW: '87%' },
  { label: 'Margin',        value: '41.2%',     color: '#CEED6F', barW: '65%' },
  { label: 'Competitor Δ',  value: '−₹120',     color: '#fbbf24', barW: '43%' },
];

const BAR_HEIGHTS = [28, 52, 40, 68, 44, 72, 56, 80, 62, 48, 76, 60];
const LINE_PTS = [
  [0,70],[16,55],[32,62],[48,38],[64,48],[80,25],
  [96,35],[112,18],[128,28],[144,10],[160,20],[176,5],
];
const linePath = LINE_PTS.map(([x,y],i) => `${i===0?'M':'L'}${x} ${y}`).join(' ');
const areaPath = linePath + ' L176 80 L0 80 Z';

/* ── Particle canvas ─────────────────────────────────────────── */
function useParticleCanvas(ref) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const W = canvas.width  = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: Math.random() * 0.45 + 0.1,
    }));
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(206,237,111,${0.11*(1-d/110)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(206,237,111,${p.a})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}

/* ── Wandering elements engine ───────────────────────────────── */
/* Directly drives DOM style.left / style.top at 60 fps.
   No React state updates — zero re-render overhead.            */
function useWanderingElements(containerRef) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wait a frame so elements are painted and have real dimensions
    let raf;
    const init = requestAnimationFrame(() => {
      const els = Array.from(container.querySelectorAll('.lp__floating'));
      if (!els.length) return;

      const W = window.innerWidth;
      const H = window.innerHeight;

      // Spread initial positions evenly so elements don't all stack
      const states = els.map((el, i) => {
        const cols = 3;
        const col  = i % cols;
        const row  = Math.floor(i / cols);
        const baseX = (col / cols) * W * 0.82 + 0.04 * W;
        const baseY = (row / 3)   * H * 0.70 + 0.06 * H;
        // Randomise speed & direction; keep slow for ambient feel
        const speed = 0.45 + Math.random() * 0.35;
        const angle = Math.random() * Math.PI * 2;
        return {
          x: baseX + (Math.random() - 0.5) * 80,
          y: baseY + (Math.random() - 0.5) * 60,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          // subtle wobble phase per element
          phase: Math.random() * Math.PI * 2,
        };
      });

      // Apply initial positions immediately so there's no jump
      states.forEach((s, i) => {
        els[i].style.left = `${s.x}px`;
        els[i].style.top  = `${s.y}px`;
      });

      let t = 0;
      function tick() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        t += 0.008;

        states.forEach((s, i) => {
          const el = els[i];
          if (!el) return;

          // Add gentle sine-wave nudge on top of linear drift
          s.x += s.vx + Math.sin(t + s.phase) * 0.12;
          s.y += s.vy + Math.cos(t + s.phase * 1.3) * 0.08;

          const elW = el.offsetWidth  || 160;
          const elH = el.offsetHeight || 80;

          // Elastic bounce off all four edges
          if (s.x < 0)        { s.x = 0;        s.vx =  Math.abs(s.vx); }
          if (s.x > W - elW)  { s.x = W - elW;  s.vx = -Math.abs(s.vx); }
          if (s.y < 0)        { s.y = 0;        s.vy =  Math.abs(s.vy); }
          if (s.y > H - elH)  { s.y = H - elH;  s.vy = -Math.abs(s.vy); }

          el.style.left = `${s.x}px`;
          el.style.top  = `${s.y}px`;
        });

        raf = requestAnimationFrame(tick);
      }

      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(init);
      cancelAnimationFrame(raf);
    };
  }, [containerRef]);
}

/* ── Component ───────────────────────────────────────────────── */
export default function Landing() {
  const navigate      = useNavigate();
  const canvasRef     = useRef(null);
  const containerRef  = useRef(null);

  useParticleCanvas(canvasRef);
  useWanderingElements(containerRef);

  return (
    <div className="lp" ref={containerRef}>

      {/* Particle canvas */}
      <canvas ref={canvasRef} className="lp__canvas" aria-hidden="true" />

      {/* Grid + colour blobs */}
      <div className="lp__grid"     aria-hidden="true" />
      <div className="lp__blob lp__blob--a" aria-hidden="true" />
      <div className="lp__blob lp__blob--b" aria-hidden="true" />

      {/* ── Floating metric cards ─── */}
      {METRIC_CARDS.map((card, i) => (
        <div
          key={card.label}
          className="lp__floating lp__metric-card"
          aria-hidden="true"
          style={{ animationDelay: `${i * 0.18}s` }}
        >
          <span className="lp__mc-label">{card.label}</span>
          <span className="lp__mc-value" style={{ color: card.color }}>{card.value}</span>
          <span className="lp__mc-bar">
            <span
              className="lp__mc-fill"
              style={{ background: card.color, '--w': card.barW }}
            />
          </span>
        </div>
      ))}

      {/* ── Line chart panel ─── */}
      <div
        className="lp__floating lp__chart-panel lp__chart-panel--line"
        aria-hidden="true"
        style={{ animationDelay: '0.9s' }}
      >
        <div className="lp__cp-header">
          <span className="lp__cp-dot" style={{ background: '#CEED6F' }} />
          <span className="lp__cp-title">Price Trend · 90d</span>
        </div>
        <svg viewBox="0 0 176 80" preserveAspectRatio="none" className="lp__cp-svg">
          <defs>
            <linearGradient id="lg-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#CEED6F" stopOpacity="0.28"/>
              <stop offset="100%" stopColor="#CEED6F" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#lg-area)" />
          <path d={linePath} fill="none" stroke="#CEED6F" strokeWidth="1.8" className="lp__svg-line" />
          {LINE_PTS.filter((_,i)=>i%3===0).map(([x,y]) => (
            <circle key={x} cx={x} cy={y} r="2.2" fill="#CEED6F" opacity="0.9" />
          ))}
        </svg>
      </div>

      {/* ── Bar chart panel ─── */}
      <div
        className="lp__floating lp__chart-panel lp__chart-panel--bar"
        aria-hidden="true"
        style={{ animationDelay: '1.1s' }}
      >
        <div className="lp__cp-header">
          <span className="lp__cp-dot" style={{ background: '#4ade80' }} />
          <span className="lp__cp-title">Demand Forecast</span>
        </div>
        <svg viewBox="0 0 132 80" preserveAspectRatio="none" className="lp__cp-svg">
          {BAR_HEIGHTS.map((h, i) => (
            <rect
              key={i}
              x={i * 11 + 1} y={80 - h}
              width={8} height={h} rx="2"
              fill={i % 3 === 0 ? '#CEED6F' : '#4ade80'}
              opacity="0.82"
              className="lp__bar-rect"
              style={{ '--delay': `${i * 0.06 + 1.1}s` }}
            />
          ))}
        </svg>
      </div>

      {/* ── Donut chart panel ─── */}
      <div
        className="lp__floating lp__chart-panel lp__chart-panel--donut"
        aria-hidden="true"
        style={{ animationDelay: '1.3s' }}
      >
        <div className="lp__cp-header">
          <span className="lp__cp-dot" style={{ background: '#86efac' }} />
          <span className="lp__cp-title">Segment Mix</span>
        </div>
        <svg viewBox="0 0 80 80" className="lp__cp-svg lp__cp-svg--donut">
          {[
            { pct:0.42, color:'#CEED6F', off:0    },
            { pct:0.28, color:'#4ade80', off:0.42 },
            { pct:0.18, color:'#86efac', off:0.70 },
            { pct:0.12, color:'#a3e635', off:0.88 },
          ].map(({ pct, color, off }, i) => {
            const r = 30, cx = 40, cy = 40, circ = 2 * Math.PI * r;
            return (
              <circle
                key={i} cx={cx} cy={cy} r={r}
                fill="none" stroke={color} strokeWidth="10"
                strokeDasharray={`${circ*pct} ${circ*(1-pct)}`}
                strokeDashoffset={-circ*off}
                className="lp__donut-ring"
                style={{ '--delay': `${i*0.18+1.3}s` }}
              />
            );
          })}
          <text x="40" y="45" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">42%</text>
        </svg>
      </div>

      {/* ── Data ticker (stays at bottom, not wandering) ─── */}
      <div className="lp__ticker" aria-hidden="true">
        <div className="lp__ticker-track">
          {[
            'SKU-2841 ↑₹42','Elasticity: −1.24','Competitor: Zara ↓5%',
            'Forecast: +18%','Margin: 41.2%','Stock: 234 units',
            'Score: 87/100','Lift: +₹1.2L','Action: INCREASE',
            'SKU-2841 ↑₹42','Elasticity: −1.24','Competitor: Zara ↓5%',
            'Forecast: +18%','Margin: 41.2%','Stock: 234 units',
          ].map((t,i) => <span key={i} className="lp__ticker-item">{t}</span>)}
        </div>
      </div>

      {/* ── Nav ─── */}
      <header className="lp__nav">
        <div className="lp__brand">
          <BrandLogo size={32} className="lp__brand-logo" />
          <span className="lp__brand-text">NextGen BI</span>
        </div>
        <span className="lp__chip">v3.0 · Erudia Edition</span>
      </header>

      {/* ── Hero ─── */}
      <main className="lp__main">
        <span className="lp__eyebrow">
          <Sparkles size={14} strokeWidth={2} /> AI Commerce Intelligence
        </span>

        <h1 className="lp__title">
          Predict markets, optimize pricing,<br />
          <em className="lp__title-em">automate strategy.</em>
        </h1>

        <p className="lp__sub">
          A guided, single-path workflow from raw data to executable strategy &mdash;
          powered by ML forecasting, multi-agent reasoning, and a real-time decision engine.
        </p>

        <button type="button" className="lp__cta" onClick={() => navigate('/app')}>
          Enter <ArrowRight size={18} strokeWidth={2.25} />
        </button>

        <ul className="lp__highlights">
          {HIGHLIGHTS.map(({ Icon, label }) => (
            <li key={label} className="lp__highlight">
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </main>

      <footer className="lp__foot">
        <span>Built for Vouge Studio</span>
        <span className="lp__foot-dot" aria-hidden="true">·</span>
        <span>Pro Plan · Unlimited SKUs</span>
      </footer>
    </div>
  );
}
