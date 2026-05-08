// Motion system tokens — single source for durations & easings
export const DURATION = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
  cinematic: 1.0,
};

// easeOutQuint / easeOutExpo / easeInOutCubic
export const EASE = {
  out: [0.22, 1, 0.36, 1],
  outExpo: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
};

export const stagger = (delay = 0.06, initial = 0.1) => ({
  animate: {
    transition: { staggerChildren: delay, delayChildren: initial },
  },
});

export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.outExpo } },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.slow, ease: EASE.out } },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE.out } },
};
