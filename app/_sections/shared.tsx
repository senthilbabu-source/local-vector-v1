// ---------------------------------------------------------------------------
// Shared helper components extracted from landing page (Sub-task D)
// Server Components — no 'use client'
// ---------------------------------------------------------------------------

import React from 'react';

export function SectionLabel({ children, color = '#00F5A0' }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      className="text-xs font-bold uppercase mb-3"
      style={{
        color,
        letterSpacing: '0.14em',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
      }}
    >
      {children}
    </p>
  );
}

// ── MetricCard — animated fill-bar gauge (CSS keyframe, no JS) ───────────

export function MetricCard({
  icon,
  iconColor,
  title,
  subtitle,
  score,
  outOf,
  barColor,
  description,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  score: number;
  outOf: number;
  barColor: string;
  description: string;
}) {
  const pct = Math.round((score / outOf) * 100);
  return (
    <div className="lv-card">
      <div className={['flex items-center gap-3 mb-4', iconColor].join(' ')}>
        {icon}
        <div>
          <p className="text-sm font-semibold text-white leading-tight">{title}</p>
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
      </div>

      <p className="text-4xl font-bold text-white tabular-nums">
        {score}
        <span className="text-lg text-slate-600 font-normal">/{outOf}</span>
      </p>

      <div className="mt-3 h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: barColor,
            '--bar-w': `${pct}%`,
            animation: 'fill-bar 1.4s cubic-bezier(0.4,0,0.2,1) 0.3s both',
          } as React.CSSProperties}
        />
      </div>

      <p className="mt-4 text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ── PricingCard ───────────────────────────────────────────────────────────

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  ctaStyle,
  highlighted,
  badge,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaStyle: 'green' | 'outline';
  highlighted: boolean;
  badge?: string;
}) {
  return (
    <div
      className="lv-card relative flex flex-col h-full overflow-hidden"
      style={highlighted ? { border: '1px solid rgba(0,245,160,0.3)' } : undefined}
    >
      {badge && (
        <div
          className="absolute text-xs font-bold uppercase"
          style={{
            top: 12,
            right: 12,
            color: '#050A15',
            background: '#00F5A0',
            padding: '3px 10px',
            borderRadius: 100,
            letterSpacing: '0.06em',
            fontSize: 10,
          }}
        >
          {badge}
        </div>
      )}

      <p
        className="text-xs font-bold uppercase text-slate-500 mb-3"
        style={{ letterSpacing: '0.1em' }}
      >
        {name}
      </p>
      <div className="mb-1">
        <span
          className="text-4xl font-extrabold text-white"
          style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
        >
          {price}
        </span>
        {period && <span className="text-sm text-slate-500">{period}</span>}
      </div>
      <p className="text-sm text-slate-400 mb-6">{description}</p>

      <div className="flex-1">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2 mb-2.5">
            <span className="text-sm leading-5 shrink-0" style={{ color: '#00F5A0' }}>&check;</span>
            <span className="text-sm text-slate-400 leading-5">{f}</span>
          </div>
        ))}
      </div>

      <a
        href={ctaHref}
        className={ctaStyle === 'green' ? 'lv-btn-green' : 'lv-btn-outline'}
        style={{ width: '100%', marginTop: 20, fontSize: 13, textAlign: 'center', display: 'block' }}
      >
        {cta}
      </a>
    </div>
  );
}
