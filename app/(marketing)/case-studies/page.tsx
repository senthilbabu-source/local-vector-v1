// ---------------------------------------------------------------------------
// /case-studies — AI Hallucination Case Studies (Website Content Strategy v2.0)
//
// Light theme via (marketing) layout. Before/after format with real numbers.
// No auth required. Pure marketing page.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';
import { SectionLabel } from '../_components/MarketingShared';

export const metadata: Metadata = {
  title:
    'AI Hallucination Case Studies | Real Businesses, Real Recovery | LocalVector.ai',
  description:
    'Real before/after stories: how AI hallucinations cost dental clinics, salons, restaurants, and other local businesses real revenue — and how LocalVector detected and corrected them.',
};

// ---------------------------------------------------------------------------
// Case study data
// ---------------------------------------------------------------------------

interface StatRow {
  label: string;
  value: string;
  color?: string;
}

interface CaseStudy {
  number: number;
  badge: string;
  title: string;
  before: {
    rows: StatRow[];
  };
  after: {
    rows: StatRow[];
  };
  quote?: {
    text: string;
    attribution?: string;
  };
  note?: string;
}

const CASE_STUDIES: CaseStudy[] = [
  {
    number: 1,
    badge: 'CASE STUDY 01',
    title: 'The $9,600 Dental Practice (Austin Family Dentistry)',
    before: {
      rows: [
        { label: 'Business', value: 'Austin dental clinic, 12-year practice' },
        {
          label: 'AI Error',
          value: 'ChatGPT reporting "not accepting new patients"',
          color: '#DC2626',
        },
        { label: 'Duration', value: '4 months undetected', color: '#DC2626' },
        {
          label: 'Revenue impact',
          value: '-$2,400/month ($9,600 total)',
          color: '#DC2626',
        },
        {
          label: 'Discovery method',
          value: "By accident (patient mentioned it during a cleaning)",
        },
        {
          label: 'Money wasted',
          value: '$1,800 on Google Ads trying to boost new patient leads',
          color: '#DC2626',
        },
      ],
    },
    after: {
      rows: [
        {
          label: 'Detection time',
          value: '< 24 hours',
          color: 'var(--m-green)',
        },
        {
          label: 'AI Status corrected',
          value: '"Accepting New Patients"',
          color: 'var(--m-green)',
        },
        {
          label: 'Monthly AI mentions',
          value: '0 \u2192 38',
          color: 'var(--m-green)',
        },
        {
          label: 'Revenue recovered',
          value: '$2,400/month',
          color: 'var(--m-green)',
        },
      ],
    },
    quote: {
      text: 'We spent $1,800 on Google Ads thinking our marketing was broken. Turns out AI was telling every potential patient we weren\u2019t taking new ones. We were. We always were.',
      attribution: 'Austin Family Dentistry Owner',
    },
  },
  {
    number: 2,
    badge: 'CASE STUDY 02',
    title: 'Charcoal N Chill, Alpharetta GA (Founding Story)',
    before: {
      rows: [
        {
          label: 'Business',
          value: 'Hookah lounge & Indo-American fusion, Alpharetta GA',
        },
        {
          label: 'AI Error',
          value: 'Perplexity reporting "closed on Mondays"',
          color: '#DC2626',
        },
        {
          label: 'Duration',
          value: 'Unknown (discovered by founder)',
          color: '#DC2626',
        },
        {
          label: 'Revenue impact',
          value:
            '~$1,600/month (5 Monday covers \u00D7 $80 avg \u00D7 4 weeks)',
          color: '#DC2626',
        },
      ],
    },
    after: {
      rows: [
        {
          label: 'Detection',
          value: '24 hours',
          color: 'var(--m-green)',
        },
        {
          label: 'Fix',
          value: 'Magic Menu + GBP update',
          color: 'var(--m-green)',
        },
        {
          label: 'AI Health Score',
          value: '62 \u2192 91 in 30 days',
          color: 'var(--m-green)',
        },
        {
          label: 'Monday covers',
          value: 'Recovered',
          color: 'var(--m-green)',
        },
      ],
    },
    note: "The business that started it all. LocalVector\u2019s Tenant Zero.",
  },
  {
    number: 3,
    badge: 'CASE STUDY 03',
    title: 'Platform Data Poisoning (San Diego Hair Salon)',
    before: {
      rows: [
        { label: 'Business', value: 'Upscale hair salon, San Diego' },
        {
          label: 'AI Error',
          value:
            'ChatGPT quoting service prices 35% higher than actual (pulling from a third-party booking platform with inflated markup)',
          color: '#DC2626',
        },
        {
          label: 'Impact',
          value:
            'Clients calling to complain about "bait and switch" pricing, negative reviews mentioning price discrepancies',
          color: '#DC2626',
        },
      ],
    },
    after: {
      rows: [
        {
          label: 'Fix',
          value: 'llms.txt authority statement with real service pricing',
          color: 'var(--m-green)',
        },
        {
          label: 'Result',
          value:
            'AI crawlers now reference direct business data, not third-party markup',
          color: 'var(--m-green)',
        },
        {
          label: 'Client complaints',
          value: 'Pricing complaints dropped',
          color: 'var(--m-green)',
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CaseStudyCard({ study }: { study: CaseStudy }) {
  const sectionBg =
    study.number % 2 === 1 ? 'var(--m-bg-primary)' : 'var(--m-bg-secondary)';
  const revealDir =
    study.number % 2 === 1 ? 'm-reveal-left' : 'm-reveal-right';

  return (
    <section
      className="m-section"
      style={{
        background: sectionBg,
      }}
    >
      {/* Number badge + title */}
      <div className={revealDir} style={{ marginBottom: 40 }}>
        <span
          className="m-mono"
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#fff',
            background: '#0B1629',
            padding: '6px 16px',
            borderRadius: 100,
            marginBottom: 20,
            textTransform: 'uppercase',
          }}
        >
          {study.badge}
        </span>

        <h2
          className="m-display"
          style={{
            fontSize: 'clamp(24px, 3.5vw, 36px)',
            maxWidth: 700,
          }}
        >
          {study.title}
        </h2>
      </div>

      {/* Before / After cards */}
      <div
        className={revealDir}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
          gap: 24,
          marginBottom: study.quote || study.note ? 40 : 0,
        }}
      >
        {/* BEFORE card */}
        <div
          className="m-card"
          style={{
            borderLeft: '4px solid #DC2626',
            borderRadius: 12,
            padding: '28px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 18,
                color: '#DC2626',
                lineHeight: 1,
              }}
            >
              {'\u2717'}
            </span>
            <span
              className="m-mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#DC2626',
                textTransform: 'uppercase',
              }}
            >
              Before
            </span>
          </div>

          {study.before.rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                padding: '10px 0',
                borderBottom:
                  i < study.before.rows.length - 1
                    ? '1px solid var(--m-border-base)'
                    : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: 'var(--m-text-secondary)',
                  flexShrink: 0,
                  minWidth: 120,
                }}
              >
                {row.label}
              </span>
              <span
                className="m-mono"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: row.color || 'var(--m-text-primary)',
                  textAlign: 'right',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* AFTER card */}
        <div
          className="m-card"
          style={{
            borderLeft: '4px solid var(--m-green)',
            borderRadius: 12,
            padding: '28px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 18,
                color: 'var(--m-green)',
                lineHeight: 1,
                fontWeight: 700,
              }}
            >
              {'\u2713'}
            </span>
            <span
              className="m-mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--m-green)',
                textTransform: 'uppercase',
              }}
            >
              After LocalVector
            </span>
          </div>

          {study.after.rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                padding: '10px 0',
                borderBottom:
                  i < study.after.rows.length - 1
                    ? '1px solid var(--m-border-base)'
                    : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: 'var(--m-text-secondary)',
                  flexShrink: 0,
                  minWidth: 120,
                }}
              >
                {row.label}
              </span>
              <span
                className="m-mono"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: row.color || 'var(--m-text-primary)',
                  textAlign: 'right',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pull quote */}
      {study.quote && (
        <blockquote
          className={revealDir}
          style={{
            borderLeft: '4px solid var(--m-green)',
            margin: 0,
            padding: '20px 28px',
            background: 'var(--m-green-light)',
            borderRadius: '0 12px 12px 0',
            marginBottom: study.note ? 24 : 0,
          }}
        >
          <p
            style={{
              fontSize: 17,
              fontStyle: 'italic',
              lineHeight: 1.7,
              color: 'var(--m-text-primary)',
              margin: 0,
            }}
          >
            {'\u201C'}
            {study.quote.text}
            {'\u201D'}
          </p>
          {study.quote.attribution && (
            <p
              className="m-mono"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--m-text-muted)',
                marginTop: 12,
                marginBottom: 0,
              }}
            >
              {'\u2014'} {study.quote.attribution}
            </p>
          )}
        </blockquote>
      )}

      {/* Note */}
      {study.note && (
        <div
          className={revealDir}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            background: 'var(--m-amber-light)',
            border: '1px solid rgba(217,119,6,0.25)',
            borderRadius: 10,
          }}
        >
          <span
            style={{
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            *
          </span>
          <p
            style={{
              fontSize: 14,
              fontStyle: 'italic',
              color: 'var(--m-text-primary)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {study.note}
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CaseStudiesPage() {
  return (
    <>
      <MarketingNav />

      <PageHero
        label="REAL DAMAGE. REAL RECOVERY."
        labelColor="#DC2626"
        titleClassName="m-text-shimmer"
        title={
          <>
            AI hallucinations aren{'\u2019'}t hypothetical.{' '}
            <span style={{ color: 'var(--m-green)' }}>
              Here{'\u2019'}s what they cost
            </span>{' '}
            {'\u2014'} and how fast they were fixed.
          </>
        }
      />

      {/* Case studies */}
      {CASE_STUDIES.map((study) => (
        <CaseStudyCard key={study.number} study={study} />
      ))}

      {/* Summary stats bar */}
      <section
        className="m-section"
        style={{ background: '#0B1629' }}
      >
        <SectionLabel color="var(--m-green)">BY THE NUMBERS</SectionLabel>

        <div
          className="m-reveal"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 24,
            marginTop: 32,
          }}
        >
          {[
            { value: '$11,200+', label: 'Total revenue at risk across 3 local businesses' },
            { value: '24 hrs', label: 'Average detection time with LocalVector' },
            { value: '3 months', label: 'Longest an error went undetected without monitoring' },
            { value: '$0', label: 'Cost to run the first scan' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="m-reveal-scale"
              style={{
                textAlign: 'center',
                padding: '24px 16px',
              }}
            >
              <p
                className="m-display"
                style={{
                  fontSize: 'clamp(28px, 4vw, 42px)',
                  color: 'var(--m-green)',
                  marginBottom: 8,
                }}
              >
                {stat.value}
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: 'rgba(148,163,184,0.8)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{
          background:
            'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
          padding: '80px 24px',
        }}
      >
        <div
          className="m-reveal"
          style={{
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <h2
            className="m-display"
            style={{
              marginBottom: 20,
            }}
          >
            Is AI getting your business wrong?
          </h2>
          <p
            style={{
              color: 'var(--m-text-secondary)',
              fontSize: 17,
              lineHeight: 1.7,
              marginBottom: 32,
            }}
          >
            Find out in 8 seconds. No account. No credit card. Just the truth.
          </p>
          <a
            href="/scan"
            className="m-btn-primary"
            style={{ fontSize: 16, padding: '16px 36px' }}
          >
            Run Your Free Scan {'\u2192'}
          </a>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}
