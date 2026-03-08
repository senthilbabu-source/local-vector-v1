'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up from 0 to `value` when scrolled into view.
 * Uses requestAnimationFrame with easeOutCubic.
 */
export default function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 1200,
  style,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();
          animate();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);

    function animate() {
      const start = performance.now();
      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} style={style}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}
