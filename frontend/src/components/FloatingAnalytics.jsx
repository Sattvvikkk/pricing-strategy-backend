import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react';

/**
 * Floating analytics cards that drift slowly, parallax to the mouse,
 * and lift/glow on hover. Pure SVG charts (no external libs).
 */

// ── SVG mini-charts ──────────────────────────────────────────────────────────

function LineSpark() {
  const points = '0,38 12,30 24,32 36,22 48,26 60,14 72,18 84,8 96,12 108,4';
  return (
    <svg viewBox="0 0 110 44" width="100%" height="44" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fa-line" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ceed6f" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ceed6f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${points} 108,44 0,44`} fill="url(#fa-line)" />
      <polyline
        points={points}
        fill="none"
        stroke="#ceed6f"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.split(' ').map((p, i) => {
        const [x, y] = p.split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r="1.4" fill="#ffffff" />;
      })}
    </svg>
  );
}

function BarsSpark() {
  const bars = [16, 28, 22, 36, 30, 42, 38];
  return (
    <svg viewBox="0 0 110 44" width="100%" height="44" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 16 + 2}
          y={44 - h}
          width="10"
          height={h}
          rx="1.5"
          fill="#a3d540"
          opacity={0.5 + (i / bars.length) * 0.5}
        />
      ))}
    </svg>
  );
}

function DonutSpark({ pct = 78 }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg viewBox="0 0 44 44" width="44" height="44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="#ceed6f"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="25" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffffff">
        {pct}%
      </text>
    </svg>
  );
}

function PulseSpark() {
  const path = 'M0,22 L16,22 L20,12 L26,32 L32,8 L40,30 L46,22 L110,22';
  return (
    <svg viewBox="0 0 110 44" width="100%" height="44" preserveAspectRatio="none">
      <path
        d={path}
        fill="none"
        stroke="#ceed6f"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Card definitions ─────────────────────────────────────────────────────────

const CARDS = [
  {
    id: 'revenue',
    Icon: TrendingUp,
    label: 'Revenue Trend',
    value: '+18.4%',
    sub: '7-day rolling',
    Chart: LineSpark,
    style: { top: '14%', left: '4%' },
    drift: { x: [0, 14, 0], y: [0, -12, 0], duration: 11 },
    parallax: 22,
  },
  {
    id: 'forecast',
    Icon: BarChart3,
    label: 'Demand Forecast',
    value: '1,284',
    sub: 'units / 7d',
    Chart: BarsSpark,
    style: { top: '24%', right: '5%' },
    drift: { x: [0, -16, 0], y: [0, 10, 0], duration: 13 },
    parallax: -28,
  },
  {
    id: 'confidence',
    Icon: PieChart,
    label: 'AI Confidence',
    value: 'High',
    sub: 'last 24h',
    Chart: () => <DonutSpark pct={87} />,
    chartInline: true,
    style: { bottom: '22%', left: '6%' },
    drift: { x: [0, 10, 0], y: [0, 14, 0], duration: 14 },
    parallax: 18,
  },
  {
    id: 'pulse',
    Icon: Activity,
    label: 'Market Pulse',
    value: 'Stable',
    sub: '4 markets live',
    Chart: PulseSpark,
    style: { bottom: '14%', right: '7%' },
    drift: { x: [0, -12, 0], y: [0, -16, 0], duration: 12 },
    parallax: -22,
  },
];

// ── Single floating card ─────────────────────────────────────────────────────

function FloatingCard({ card, mouseX, mouseY }) {
  // Parallax — translate card based on mouse position relative to viewport center
  const tx = useTransform(mouseX, (v) => v * card.parallax);
  const ty = useTransform(mouseY, (v) => v * card.parallax * 0.6);
  const sx = useSpring(tx, { stiffness: 60, damping: 18, mass: 0.5 });
  const sy = useSpring(ty, { stiffness: 60, damping: 18, mass: 0.5 });

  const { Icon, Chart, label, value, sub, drift, chartInline, style } = card;

  return (
    <motion.div
      className="fa-card"
      style={{ ...style, x: sx, y: sy }}
      animate={{
        x: [0, drift.x[1], 0],
        y: [0, drift.y[1], 0],
      }}
      transition={{
        duration: drift.duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      whileHover={{
        scale: 1.06,
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
      }}
    >
      <div className="fa-card__head">
        <span className="fa-card__icon"><Icon size={12} strokeWidth={2.25} /></span>
        <span className="fa-card__label">{label}</span>
      </div>
      <div className={`fa-card__body ${chartInline ? 'fa-card__body--inline' : ''}`}>
        <div className="fa-card__metric">
          <div className="fa-card__value">{value}</div>
          <div className="fa-card__sub">{sub}</div>
        </div>
        <div className="fa-card__chart">
          <Chart />
        </div>
      </div>
    </motion.div>
  );
}

// ── Container ────────────────────────────────────────────────────────────────

export default function FloatingAnalytics() {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    setMounted(true);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const onMove = (e) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Normalize: -0.5 .. 0.5
      mouseX.set((e.clientX / w - 0.5));
      mouseY.set((e.clientY / h - 0.5));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [mouseX, mouseY]);

  if (!mounted) return null;

  return (
    <div ref={ref} className="fa-layer" aria-hidden="true">
      {CARDS.map((c) => (
        <FloatingCard key={c.id} card={c} mouseX={mouseX} mouseY={mouseY} />
      ))}
    </div>
  );
}
