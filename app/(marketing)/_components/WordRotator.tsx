'use client';

import { useEffect, useState } from 'react';

/**
 * Cycles through a list of words with a slide-up + fade animation.
 * CSS-driven transitions — lightweight, no heavy deps.
 */
export default function WordRotator({
  words,
  interval = 2400,
  style,
}: {
  words: string[];
  interval?: number;
  style?: React.CSSProperties;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Respect reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setVisible(true);
      }, 300);
    }, interval);

    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <span
      style={{
        display: 'inline-block',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        ...style,
      }}
    >
      {words[index]}
    </span>
  );
}
