// ---------------------------------------------------------------------------
// Section 7: "Reality Score Dashboard Preview" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel, Badge } from '../_components/MarketingShared';

export default function DashboardPreview() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
      <div className="m-reveal">
        <SectionLabel color="var(--m-green)">THE COMMAND CENTER</SectionLabel>

        <h2
          className="m-display"
          style={{ maxWidth: 760, marginBottom: 20 }}
        >
          Your AI presence in one dashboard. Updated weekly. Plain English.
        </h2>

        <p
          style={{
            maxWidth: 640,
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 48,
          }}
        >
          No jargon. No vanity metrics. Just a clear picture of how AI sees your
          business — and what to fix first.
        </p>
      </div>

      {/* ---- Mock Dashboard Card ---- */}
      <div
        className="m-reveal-scale"
        style={{
          maxWidth: 880,
          margin: '0 auto',
          background: 'var(--m-bg-primary)',
          border: '1px solid var(--m-border-base)',
          borderRadius: 16,
          boxShadow: '0 4px 32px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderBottom: '1px solid var(--m-border-base)',
            background: 'var(--m-bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#DC2626',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--m-amber)',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--m-green)',
                display: 'inline-block',
              }}
            />
          </div>
          <span
            className="m-mono"
            style={{ fontSize: 12, color: 'var(--m-text-muted)' }}
          >
            localvector.ai/dashboard
          </span>
          <Badge variant="green">LIVE</Badge>
        </div>

        {/* Dashboard body */}
        <div style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
          {/* Reality Score hero */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              marginBottom: 32,
            }}
          >
            {/* Gauge ring */}
            <div
              style={{
                position: 'relative',
                width: 96,
                height: 96,
                flexShrink: 0,
              }}
            >
              <svg width="96" height="96" viewBox="0 0 96 96">
                {/* Track */}
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="var(--m-border-base)"
                  strokeWidth="8"
                />
                {/* Progress — 84% of full circle */}
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="var(--m-green)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${0.84 * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                  transform="rotate(-90 48 48)"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  className="m-mono"
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: 'var(--m-text-primary)',
                  }}
                >
                  84
                </span>
              </div>
            </div>

            <div>
              <p
                className="m-mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  color: 'var(--m-text-muted)',
                  marginBottom: 4,
                }}
              >
                REALITY SCORE
              </p>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--m-text-primary)',
                  margin: 0,
                }}
              >
                84 <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--m-text-muted)' }}>/ 100</span>
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--m-green)',
                  fontWeight: 500,
                  margin: '4px 0 0',
                }}
              >
                +6 pts this week
              </p>
            </div>
          </div>

          {/* 2x2 mini stat cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            <DashboardMiniCard
              title="Reality Score"
              description="Your business's AI health in one number. Combines visibility, accuracy, and data quality."
              accent="var(--m-green)"
              value="84/100"
            />
            <DashboardMiniCard
              title="Hallucination Feed"
              description="Every factual error AI is making about your business, ranked by revenue impact."
              accent="var(--m-red)"
              value="3 active"
            />
            <DashboardMiniCard
              title="Competitor Intercept"
              description="See exactly who AI recommends instead of you — and the specific reasons why."
              accent="var(--m-amber)"
              value="2 threats"
            />
            <DashboardMiniCard
              title="Share of Voice"
              description="Track how often your business appears in AI recommendations vs. your top 3 competitors."
              accent="var(--m-green)"
              value="34%"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Helper sub-component ---- */

function DashboardMiniCard({
  title,
  description,
  accent,
  value,
}: {
  title: string;
  description: string;
  accent: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: 'var(--m-bg-secondary)',
        borderRadius: 10,
        padding: '16px 18px',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--m-text-primary)',
            margin: 0,
          }}
        >
          {title}
        </p>
        <span
          className="m-mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: accent,
          }}
        >
          {value}
        </span>
      </div>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--m-text-muted)',
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}
