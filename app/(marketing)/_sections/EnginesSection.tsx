// ---------------------------------------------------------------------------
// Section 4: "The Intelligence Engines" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel } from '../_components/MarketingShared';

const ENGINES = [
  {
    number: 1,
    title: 'FEAR ENGINE',
    subtitle: 'The AI Hallucination Auditor',
    accentColor: '#DC2626',
    body: 'We send the exact questions your customers ask to ChatGPT, Perplexity, and Gemini. Then we compare every answer against your verified business data. When the AI gets it wrong \u2014 wrong hours, wrong address, wrong services \u2014 you get a Red Alert with a revenue impact estimate for every single error.',
    whatYouSee:
      '"ChatGPT told a customer you close at 9 PM. You close at 11 PM. Estimated lost revenue: $420/month."',
  },
  {
    number: 2,
    title: 'GREED ENGINE',
    subtitle: 'Competitor Intelligence',
    accentColor: '#D97706',
    body: 'We ask AI models "Who\'s the best [your category] in [your area]?" and reverse-engineer exactly why a competitor won the recommendation instead of you. You get a specific gap analysis \u2014 not generic advice \u2014 with actionable items you can fix this week.',
    whatYouSee:
      '"Competitor X wins because they have structured hours data and 12 more recent reviews mentioning outdoor seating. You don\'t mention outdoor seating anywhere AI can read."',
  },
  {
    number: 3,
    title: 'MAGIC ENGINE',
    subtitle: 'AI-Readable Menu & Schema Generator',
    accentColor: 'var(--m-green)',
    body: 'AI can\'t read your PDF menu or service list. It can\'t parse that image of your offerings. Upload a photo or PDF and we convert it to JSON-LD, llms.txt, and ai-config.json \u2014 the formats AI models actually consume. One click to publish.',
    whatYouSee:
      '"Your services are now readable by ChatGPT, Gemini, and Perplexity. 47 items structured. Published to your site in 3 seconds."',
  },
] as const;

const BACKGROUND_ENGINES = [
  'AI Crawler Analytics',
  'First Mover Alerts',
  'Occasion Engine',
  'Sentiment Tracker',
  'Voice Search Readiness',
  'Agent Readiness Score',
  'AI Answer Sandbox',
];

export default function EnginesSection() {
  return (
    <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
      <div className="m-reveal">
        <SectionLabel color="var(--m-green)">HOW IT WORKS</SectionLabel>

        <h2
          className="m-display"
          style={{ maxWidth: 800, marginBottom: 20 }}
        >
          <span className="m-text-shimmer">Detect the lies. Intercept the competition.</span>{' '}
          Force the truth. Prove the fix worked.
        </h2>

        <p
          style={{
            maxWidth: 680,
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 56,
          }}
        >
          LocalVector runs 10 intelligence engines under the hood. On the homepage
          we highlight the three that explain the core value fastest.
        </p>
      </div>

      {/* Engine cards */}
      <div className="m-grid3 m-reveal-stagger">
        {ENGINES.map((engine) => (
          <div
            key={engine.number}
            className="m-card m-reveal"
            style={{
              borderTop: `4px solid ${engine.accentColor}`,
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Number badge */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: engine.accentColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {engine.number}
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--m-text-primary)',
                margin: 0,
              }}
            >
              {engine.title}
            </h3>

            {/* Subtitle */}
            <p
              className="m-mono"
              style={{
                fontSize: 13,
                color: engine.accentColor,
                fontWeight: 600,
                margin: 0,
              }}
            >
              {engine.subtitle}
            </p>

            {/* Body */}
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: 'var(--m-text-secondary)',
                margin: 0,
              }}
            >
              {engine.body}
            </p>

            {/* What you see */}
            <div style={{ marginTop: 'auto' }}>
              <p
                className="m-mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--m-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                What you see
              </p>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--m-text-secondary)',
                  fontStyle: 'italic',
                  margin: 0,
                  padding: '12px 16px',
                  background: 'var(--m-bg-secondary)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${engine.accentColor}`,
                }}
              >
                {engine.whatYouSee}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Background engines teaser */}
      <div
        style={{
          marginTop: 56,
          padding: '36px 32px',
          background: '#F8FAFC',
          borderRadius: 12,
          border: '1px solid var(--m-border-base)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--m-text-primary)',
            marginBottom: 12,
          }}
        >
          And 7 more engines running in the background.
        </p>
        <p
          className="m-mono"
          style={{
            fontSize: 13,
            color: 'var(--m-text-muted)',
            lineHeight: 1.8,
            marginBottom: 20,
          }}
        >
          {BACKGROUND_ENGINES.join(' \u00B7 ')}
        </p>
        <a
          href="/how-it-works"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--m-green)',
            textDecoration: 'none',
          }}
        >
          See All 10 Engines &rarr;
        </a>
      </div>

      {/* Bottom line */}
      <p
        style={{
          maxWidth: 680,
          marginTop: 48,
          fontStyle: 'italic',
          color: 'var(--m-text-secondary)',
          fontSize: 15,
          lineHeight: 1.7,
        }}
      >
        Every engine runs on a daily schedule. You see problems in plain English.
        You fix them in minutes — not months.
      </p>
    </section>
  );
}
