'use client';

import { useReveal } from './use-reveal';

interface BarProps {
  /** Fill percentage (0–100) */
  pct: number;
  /** Bar color (hex or CSS color) */
  color: string;
  /** Delay before animation starts (ms) */
  delay?: number;
}

/**
 * Animated progress bar — fills on scroll-reveal.
 * DESIGN-SYSTEM.md compliant: height 6, borderRadius 3, CSS transition only.
 */
export default function Bar({ pct, color, delay = 0 }: BarProps) {
  const [ref, visible] = useReveal(0.2);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden"
      style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}
    >
      <div
        style={{
          width: visible ? `${pct}%` : '0%',
          height: '100%',
          borderRadius: 3,
          background: color,
          transition: `width 1.2s cubic-bezier(.16,1,.3,1) ${delay}ms`,
        }}
      />
    </div>
  );
}
