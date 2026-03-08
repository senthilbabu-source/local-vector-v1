'use client';

import { useEffect, useRef } from 'react';

/**
 * Lightweight IntersectionObserver wrapper that adds `.m-visible` to
 * `.m-reveal` children once they scroll into view. CSS handles the animation.
 */
export default function ScrollReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.querySelectorAll('.m-reveal, .m-reveal-left, .m-reveal-right, .m-reveal-scale, .m-underline-draw').forEach((node) => node.classList.add('m-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('m-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    el.querySelectorAll('.m-reveal, .m-reveal-left, .m-reveal-right, .m-reveal-scale, .m-underline-draw').forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
