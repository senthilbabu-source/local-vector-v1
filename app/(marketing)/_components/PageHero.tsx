// ---------------------------------------------------------------------------
// Shared Page Hero — used by inner marketing pages (not homepage)
// Staggered entrance animation via CSS class m-hero-animate.
// ---------------------------------------------------------------------------

import React from 'react';

export default function PageHero({
  label,
  labelColor = 'var(--m-green)',
  title,
  titleClassName = '',
  subtitle,
}: {
  label?: string;
  labelColor?: string;
  title: React.ReactNode;
  titleClassName?: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <section
      style={{
        position: 'relative',
        background: 'linear-gradient(160deg, #F5F7ED 0%, #E8F5EE 40%, #F0F4F8 100%)',
        overflow: 'hidden',
        paddingTop: 64,
        paddingBottom: 64,
      }}
    >
      {/* Grid overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(var(--m-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--m-text-primary) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.04,
          pointerEvents: 'none',
        }}
      />

      {/* Floating accent shapes */}
      <div
        aria-hidden="true"
        className="m-float-slow"
        style={{
          position: 'absolute',
          top: '15%',
          right: '8%',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,168,107,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        className="m-float-slow-reverse"
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '5%',
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,58,95,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="m-hero-animate"
        style={{
          maxWidth: 1120,
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: '0 24px',
          position: 'relative',
        }}
      >
        {label && (
          <p
            className="m-mono"
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: labelColor,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            {label}
          </p>
        )}

        <h1
          className={`m-display ${titleClassName}`.trim()}
          style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 800,
            color: '#0B1629',
            lineHeight: 1.1,
            maxWidth: 800,
            marginBottom: subtitle ? 20 : 0,
            letterSpacing: '-0.025em',
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              fontSize: 'clamp(16px, 1.5vw, 18px)',
              lineHeight: 1.7,
              color: '#475569',
              maxWidth: 640,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
