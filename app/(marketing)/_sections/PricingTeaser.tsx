// ---------------------------------------------------------------------------
// Section 8: "Pricing Teaser" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel } from '../_components/MarketingShared';

export default function PricingTeaser() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
      <div className="m-reveal">
        <SectionLabel>PRICING</SectionLabel>

        <h2
          className="m-display"
          style={{ maxWidth: 780, marginBottom: 48 }}
        >
          Cheaper than one customer AI sent somewhere else. Honest pricing, no
          surprises.
        </h2>
      </div>

      <div className="m-grid3 m-reveal-stagger">
        {/* ---- Card 1: Free ---- */}
        <PricingCard
          name="The Audit"
          price="Free"
          description="One-time AI hallucination scan. No account needed. See exactly what AI says about your business today."
          ctaLabel="Run Free Audit"
          ctaHref="/scan"
          ctaClass="m-btn-secondary"
        />

        {/* ---- Card 2: Starter ---- */}
        <PricingCard
          name="Starter"
          price="$79/mo"
          description="AI audits every 3 days. Email alerts. Reality Score dashboard. Magic Menu. Protect one location."
          ctaLabel="Get Started"
          ctaHref="/signup"
          ctaClass="m-btn-secondary"
        />

        {/* ---- Card 3: AI Shield (Most Popular) ---- */}
        <PricingCard
          name="AI Shield"
          price="$229/mo"
          description="Daily audits. Competitor Intercept. Share of Voice tracking. Everything in Starter, plus the offense."
          ctaLabel="Get AI Shield"
          ctaHref="/signup"
          ctaClass="m-btn-primary"
          popular
        />
      </div>

      {/* ---- Agency note ---- */}
      <p
        style={{
          maxWidth: 680,
          marginTop: 40,
          color: 'var(--m-text-secondary)',
          fontSize: 15,
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: 'var(--m-text-primary)' }}>Agency — Brand Fortress:</strong>{' '}
        10 locations, white-label reports, team seats, API access.{' '}
        <a
          href="mailto:hello@localvector.ai"
          style={{
            color: 'var(--m-green)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Talk to Us &rarr;
        </a>
      </p>

      {/* ---- Footer text ---- */}
      <p
        style={{
          marginTop: 32,
          color: 'var(--m-text-muted)',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        14-day free trial on all paid plans. No contracts. Cancel anytime.
      </p>

      <a
        href="/pricing"
        style={{
          display: 'inline-block',
          marginTop: 12,
          color: 'var(--m-green)',
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        View full pricing details &rarr;
      </a>
    </section>
  );
}

/* ---- Helper sub-component ---- */

function PricingCard({
  name,
  price,
  description,
  ctaLabel,
  ctaHref,
  ctaClass,
  popular = false,
}: {
  name: string;
  price: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  ctaClass: string;
  popular?: boolean;
}) {
  return (
    <div
      className="m-card m-reveal"
      style={{
        borderRadius: 12,
        position: 'relative',
        border: popular ? '2px solid var(--m-green)' : '1px solid var(--m-border-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {popular && (
        <span
          className="m-mono"
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--m-green)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '4px 14px',
            borderRadius: 100,
            whiteSpace: 'nowrap',
          }}
        >
          MOST POPULAR
        </span>
      )}

      <p
        className="m-mono"
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: 'var(--m-text-muted)',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        {name}
      </p>

      <p
        className="m-display"
        style={{ fontSize: 'clamp(28px, 4vw, 36px)', marginBottom: 16 }}
      >
        {price}
      </p>

      <p
        style={{
          color: 'var(--m-text-secondary)',
          fontSize: 15,
          lineHeight: 1.65,
          marginBottom: 24,
          flex: 1,
        }}
      >
        {description}
      </p>

      <a
        href={ctaHref}
        className={ctaClass}
        style={{ textAlign: 'center', textDecoration: 'none' }}
      >
        {ctaLabel} &rarr;
      </a>
    </div>
  );
}
