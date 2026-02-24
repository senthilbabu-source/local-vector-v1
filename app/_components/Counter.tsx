'use client';

import { useState, useEffect } from 'react';
import { useReveal } from './use-reveal';

interface CounterProps {
  end: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export default function Counter({ end, prefix = '', suffix = '', duration = 1800 }: CounterProps) {
  const [ref, visible] = useReveal(0.3);
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let current = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      current += step;
      if (current >= end) {
        setVal(end);
        clearInterval(id);
      } else {
        setVal(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(id);
  }, [visible, end, duration]);

  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString()}{suffix}
    </span>
  );
}
