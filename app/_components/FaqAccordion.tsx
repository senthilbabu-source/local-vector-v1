'use client';

import { useState } from 'react';
import { useReveal } from './use-reveal';

interface FaqAccordionProps {
  q: string;
  a: string;
  delay?: number;
}

export default function FaqAccordion({ q, a, delay = 0 }: FaqAccordionProps) {
  const [open, setOpen] = useState(false);
  const [ref, visible] = useReveal(0.15);

  return (
    <div
      ref={ref}
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9', paddingRight: 20 }}>
          {q}
        </span>
        <span
          aria-hidden
          style={{
            color: '#00F5A0',
            fontSize: 20,
            flexShrink: 0,
            transition: 'transform 0.3s',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? 300 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(.16,1,.3,1), opacity 0.3s',
          opacity: open ? 1 : 0,
        }}
      >
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#94A3B8', paddingBottom: 20, maxWidth: 680 }}>
          {a}
        </p>
      </div>
    </div>
  );
}
