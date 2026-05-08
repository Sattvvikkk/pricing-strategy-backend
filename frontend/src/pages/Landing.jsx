import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, TrendingUp, BrainCircuit, Zap, Activity } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import ParticleField from '../components/ParticleField';
import FloatingAnalytics from '../components/FloatingAnalytics';
import AnimatedCounter from '../components/AnimatedCounter';
import { fadeUp, fadeIn, stagger, EASE, DURATION } from '../motion/tokens';

const HIGHLIGHTS = [
  { Icon: TrendingUp,   label: 'Forecast demand & elasticity' },
  { Icon: BrainCircuit, label: 'AI-generated pricing strategy' },
  { Icon: Zap,          label: 'Autonomous execution rules' },
];

const METRICS = [
  { value: 1284,  suffix: '',  label: 'Active SKUs tracked' },
  { value: 18,    suffix: '%', label: 'Avg revenue lift' },
  { value: 87,    suffix: '%', label: 'AI confidence' },
  { value: 24,    suffix: '/7', label: 'Live monitoring' },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="lp">
      {/* Cinematic background */}
      <ParticleField className="lp__particles" />
      <div className="lp__grid" aria-hidden="true" />
      <div className="lp__blob lp__blob--a" aria-hidden="true" />
      <div className="lp__blob lp__blob--b" aria-hidden="true" />
      <div className="lp__vignette" aria-hidden="true" />
      <FloatingAnalytics />

      <motion.header
        className="lp__nav"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.slow, ease: EASE.outExpo }}
      >
        <div className="lp__brand">
          <BrandLogo size={32} className="lp__brand-logo" />
          <span className="lp__brand-text">NextGen BI</span>
        </div>
        <span className="lp__chip">
          <Activity size={12} strokeWidth={2.25} /> v3.0 · Erudia Edition
        </span>
      </motion.header>

      <motion.main
        className="lp__main"
        variants={stagger(0.08, 0.2)}
        initial="initial"
        animate="animate"
      >
        <motion.span className="lp__eyebrow" variants={fadeUp}>
          <Sparkles size={14} strokeWidth={2} /> AI Commerce Intelligence
        </motion.span>

        <motion.h1 className="lp__title" variants={fadeUp}>
          <span className="lp__title-line">Predict markets,</span>
          <span className="lp__title-line">optimize pricing,</span>
          <span className="lp__title-line">
            <em className="lp__title-em">automate strategy.</em>
          </span>
        </motion.h1>

        <motion.p className="lp__sub" variants={fadeUp}>
          A guided, single-path workflow from raw data to executable strategy &mdash;
          powered by ML forecasting, multi-agent reasoning, and a real-time decision engine.
        </motion.p>

        <motion.div variants={fadeUp} className="lp__cta-row">
          <button type="button" className="lp__cta" onClick={() => navigate('/app')}>
            <span className="lp__cta-bg" aria-hidden="true" />
            <span className="lp__cta-text">
              Launch Intelligence Dashboard
              <ArrowRight size={18} strokeWidth={2.25} />
            </span>
          </button>
        </motion.div>

        <motion.ul className="lp__highlights" variants={fadeUp}>
          {HIGHLIGHTS.map(({ Icon, label }) => (
            <li key={label} className="lp__highlight">
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </li>
          ))}
        </motion.ul>

        <motion.div className="lp__metrics" variants={fadeIn}>
          {METRICS.map((m) => (
            <div className="lp__metric" key={m.label}>
              <AnimatedCounter
                value={m.value}
                suffix={m.suffix}
                className="lp__metric-value"
              />
              <span className="lp__metric-label">{m.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.main>

      <motion.footer
        className="lp__foot"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: DURATION.slow }}
      >
        <span>Built for Vouge Studio</span>
        <span className="lp__foot-dot" aria-hidden="true">·</span>
        <span>Pro Plan · Unlimited SKUs</span>
      </motion.footer>
    </div>
  );
}
