// ---------------------------------------------------------------------------
// Shared marketing components — Light theme (Website Content Strategy v2.0)
// Server Components — no 'use client'
// ---------------------------------------------------------------------------

import React from 'react';

/** Section label — uppercase mono tag above H2s */
export function SectionLabel({
  children,
  color = 'var(--m-green)',
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <p className="m-label" style={{ color, marginBottom: 16 }}>
      {children}
    </p>
  );
}

/** Stat card with colored left border */
export function StatCard({
  value,
  body,
  borderColor,
}: {
  value: React.ReactNode;
  body: string;
  borderColor: string;
}) {
  return (
    <div
      className="m-card m-reveal"
      style={{ borderLeft: `4px solid ${borderColor}`, borderRadius: 12 }}
    >
      <div
        className="m-display"
        style={{ fontSize: 'clamp(28px, 4vw, 42px)', marginBottom: 8 }}
      >
        {value}
      </div>
      <p style={{ color: 'var(--m-text-secondary)', fontSize: 15, lineHeight: 1.65 }}>
        {body}
      </p>
    </div>
  );
}

/** Score row — used in self-audit comparison cards */
export function ScoreRow({
  label,
  value,
  color = 'var(--m-green)',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid var(--m-border-base)',
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--m-text-secondary)' }}>{label}</span>
      <span className="m-mono" style={{ fontSize: 14, fontWeight: 600, color }}>
        {value}
      </span>
    </div>
  );
}

/** Badge pill */
export function Badge({
  children,
  variant = 'green',
}: {
  children: React.ReactNode;
  variant?: 'green' | 'amber' | 'red' | 'muted';
}) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    green:  { bg: 'var(--m-green-light)', color: 'var(--m-green)', border: 'var(--m-border-green)' },
    amber:  { bg: 'var(--m-amber-light)', color: 'var(--m-amber)', border: 'rgba(217,119,6,0.25)' },
    red:    { bg: 'var(--m-red-light)', color: 'var(--m-red)', border: 'rgba(220,38,38,0.25)' },
    muted:  { bg: 'var(--m-bg-secondary)', color: 'var(--m-text-muted)', border: 'var(--m-border-base)' },
  };
  const s = styles[variant];
  return (
    <span
      className="m-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 100,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {children}
    </span>
  );
}

/** Comparison table check / cross */
export function Check() {
  return <span style={{ color: 'var(--m-green)', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{'\u2713'}</span>;
}
export function Cross() {
  return <span style={{ color: 'var(--m-red)', fontSize: 20, opacity: 0.6, lineHeight: 1 }}>{'\u2717'}</span>;
}
export function Dash() {
  return <span style={{ color: 'var(--m-text-muted)', fontSize: 18, lineHeight: 1 }}>{'\u2014'}</span>;
}
