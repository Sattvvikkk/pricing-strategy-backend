import { useEffect, useRef } from 'react';

/**
 * Lightweight canvas-based animated network of nodes.
 * Cinematic background suitable for the landing hero.
 * Honors prefers-reduced-motion.
 */
export default function ParticleField({
  density = 0.00012, // particles per pixel
  linkDistance = 130,
  color = '26, 58, 46', // RGB triple, matches Erudia forest green
  accent = '206, 237, 111',
  className = '',
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let particles = [];
    let mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(40, Math.min(160, Math.floor(w * h * density)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.6,
      }));
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);

      // Update + draw nodes
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Subtle mouse attraction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const md = Math.hypot(dx, dy);
        if (md < 140) {
          p.vx += (dx / md) * 0.0025;
          p.vy += (dy / md) * 0.0025;
        }
        // Damping
        p.vx *= 0.995;
        p.vy *= 0.995;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, 0.55)`;
        ctx.fill();
      }

      // Draw links
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < linkDistance) {
            const alpha = (1 - d / linkDistance) * 0.35;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
        // Mouse links (accent)
        const mdx = a.x - mouse.x;
        const mdy = a.y - mouse.y;
        const md = Math.hypot(mdx, mdy);
        if (md < 160) {
          const alpha = (1 - md / 160) * 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${accent}, ${alpha})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
      }

      if (!reduce) rafRef.current = requestAnimationFrame(tick);
    };

    resize();
    if (reduce) {
      // Single static frame
      tick();
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }

    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [density, linkDistance, color, accent]);

  return <canvas ref={canvasRef} className={`particle-field ${className}`} aria-hidden="true" />;
}
