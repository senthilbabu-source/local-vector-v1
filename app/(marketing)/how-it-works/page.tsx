// ---------------------------------------------------------------------------
// /how-it-works — How LocalVector.ai Works (10 Intelligence Engines)
//
// Light theme via (marketing) layout. Server Component — no 'use client'.
// Inline styles only (no Tailwind). CSS custom properties from .lv-marketing.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';
import { SectionLabel } from '../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'How LocalVector.ai Works | 10 AI Intelligence Engines for Local Business',
  description:
    'LocalVector.ai uses 10 intelligence engines to detect, diagnose, fix, and prove AI visibility for local businesses. Here\'s the complete explanation.',
};

// ---------------------------------------------------------------------------
// Loop steps
// ---------------------------------------------------------------------------

const LOOP_STEPS = ['DETECT', 'EXPLAIN', 'GUIDE', 'FIX', 'VERIFY', 'MEASURE'] as const;

// ---------------------------------------------------------------------------
// Engine data
// ---------------------------------------------------------------------------

interface Engine {
  num: number;
  name: string;
  description: string;
  details: string[];
  mock?: React.ReactNode;
}

const ENGINES: Engine[] = [
  {
    num: 1,
    name: 'Ground Truth',
    description: 'Establishing verified business data as the single source of truth.',
    details: [
      'Hours of operation verified against your Google Business Profile',
      'Address and phone number (NAP) validated across all platforms',
      'Amenities, parking, accessibility attributes confirmed',
      'Full menu or service list with prices, descriptions, and details',
      'Every AI response is compared against this verified baseline',
    ],
  },
  {
    num: 2,
    name: 'The Fear Engine (Hallucination Detection)',
    description:
      'Weekly and daily queries to ChatGPT, Perplexity, and Gemini — every response compared against your Ground Truth.',
    details: [
      'Automated queries across 5+ AI models on a recurring schedule',
      'Each response parsed for factual accuracy against verified data',
      'Severity classification: Critical / High / Medium',
      'Revenue impact estimated per alert based on category and severity',
      'Critical alerts trigger immediate email notifications',
    ],
  },
  {
    num: 3,
    name: 'The Greed Engine (Competitor Intelligence)',
    description:
      '"What\'s the best [category] in [city]?" — we ask the question your customers ask, and show you who AI recommends instead of you.',
    details: [
      'Share of Voice analysis across competitive queries',
      'Gap list with specific, ranked actions to close the gap',
      'Competitor attribute comparison (what they have that you don\'t)',
      'Intercept alerts when competitors gain AI visibility',
    ],
  },
  {
    num: 4,
    name: 'The Magic Engine (Structured Data Generator)',
    description:
      'Upload a PDF menu or service list. Get back JSON-LD, llms.txt, and ai-config.json — the canonical source AI models actually read.',
    details: [
      '8-step pipeline: OCR \u2192 Parse \u2192 Normalize \u2192 Categorize \u2192 Schema \u2192 Validate \u2192 Publish \u2192 Distribute',
      'JSON-LD MenuSection + MenuItem schema for Google',
      'llms.txt for ChatGPT, Claude, and Perplexity crawlers',
      'ai-config.json for agent-to-agent communication',
      'Automatic distribution to Google Business Profile',
    ],
  },
  {
    num: 5,
    name: 'NAP Sync (Listing Foundation)',
    description:
      'Monitoring the Big 6 platforms where AI models source local business data. One mismatch = one hallucination.',
    details: [
      'Google Business Profile, Apple Business Connect, Bing Places',
      'Yelp, TripAdvisor, Facebook — all monitored for discrepancies',
      'Name, Address, Phone consistency scoring across all platforms',
      'Fix instructions generated per platform when mismatches are found',
      'Health score updated after every sync cycle',
    ],
  },
  {
    num: 6,
    name: 'Share of Voice Tracking',
    description:
      '20 weekly queries that mirror what your customers ask AI. We track the percentage of times you\'re mentioned — and your trajectory over time.',
    details: [
      '20 curated queries per week across discovery, services, hours, and booking intents',
      'Percentage of AI mentions calculated per query and aggregated',
      'Trajectory tracking: are you gaining or losing AI visibility?',
      'Model-by-model breakdown (ChatGPT vs. Gemini vs. Perplexity)',
      'Competitor mention tracking in the same query set',
    ],
  },
  {
    num: 7,
    name: 'AI Crawler Analytics',
    description:
      'Which AI bots are visiting your website — and which ones aren\'t. If a bot can\'t crawl you, it can\'t recommend you.',
    details: [
      'Real-time monitoring of AI bot visits to your domain',
      'Coverage gap detection: bots that should visit but don\'t',
      'robots.txt audit to ensure you\'re not accidentally blocking AI crawlers',
      'Visit frequency and recency tracking per bot',
    ],
  },
  {
    num: 8,
    name: 'First Mover Alerts',
    description:
      'Uncontested queries where no business is cited by AI. These are opportunities to be the first answer.',
    details: [
      'Detection of queries where AI gives generic or no-citation answers',
      'Opportunity scoring based on query volume and intent',
      'Content recommendations to claim the uncited query',
      'Alert delivery before competitors discover the gap',
    ],
  },
  {
    num: 9,
    name: 'Occasion Engine',
    description:
      '30 cultural and seasonal occasions tracked. Alerts arrive weeks before peak so you can prepare content that AI will surface.',
    details: [
      'Valentine\'s Day, Mother\'s Day, Thanksgiving, New Year\'s Eve',
      'Diwali, Eid, Lunar New Year, Hanukkah, Cinco de Mayo',
      'Local events, sports seasons, graduation weeks',
      'Content calendar with AI-ready post templates per occasion',
      'Alerts timed 2\u20134 weeks before each occasion\'s peak search volume',
    ],
  },
  {
    num: 10,
    name: 'Agent Readiness Score',
    description:
      'Can an AI agent actually book an appointment, place an order, or find your hours? This score measures your machine-readability.',
    details: [
      '6 capabilities assessed: Structured Hours, Service/Menu Schema, ReserveAction, ScheduleAction, Accessible CTAs, CAPTCHA-Free Flows',
      'Each capability scored pass/fail with specific fix instructions',
      'Composite score out of 100',
      'Improvement tracking over time as you implement fixes',
    ],
  },
];

// ---------------------------------------------------------------------------
// Mock data for specific engines
// ---------------------------------------------------------------------------

const CRAWLER_MOCK = [
  { bot: 'GPTBot', visits: 47, status: true },
  { bot: 'OAI-SearchBot', visits: 23, status: true },
  { bot: 'ClaudeBot', visits: 12, status: true },
  { bot: 'PerplexityBot', visits: 0, status: false },
  { bot: 'Google-Extended', visits: 89, status: true },
  { bot: 'Bytespider', visits: 0, status: false },
];

const FIRST_MOVER_MOCK = [
  { query: '"best dentist for nervous patients in downtown Austin"', cited: 'No business cited' },
  { query: '"hair salon open late on Saturdays near me"', cited: 'No business cited' },
  { query: '"HVAC company with same-day emergency service in Brooklyn"', cited: 'No business cited' },
];

const AGENT_READINESS_MOCK = [
  { capability: 'Structured Hours', pass: true },
  { capability: 'Service/Menu Schema', pass: true },
  { capability: 'ReserveAction', pass: false },
  { capability: 'ScheduleAction', pass: false },
  { capability: 'Accessible CTAs', pass: true },
  { capability: 'CAPTCHA-Free Flows', pass: false },
];

const GREED_MOCK = [
  'Add "emergency services" to your GBP attributes',
  'Publish your updated holiday hours and seasonal specials',
  'Add before-and-after photos to your listing',
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HowItWorksPage() {
  return (
    <>
      <MarketingNav />

      <PageHero
        label="How It Works"
        title="A complete loop: detect the problem, quantify the cost, fix it, prove it worked."
        subtitle="LocalVector.ai isn't a dashboard you check once and forget. 10 intelligence engines find what AI gets wrong about your business, show you exactly what it costs, and guide you through the fix. You approve every change. We verify it worked."
      />

      {/* ── 6-Step Loop Visual ── */}
      <section
        className="m-section m-reveal"
        style={{
          background: 'var(--m-bg-primary)',
          paddingTop: 72,
          paddingBottom: 72,
        }}
      >
        <div style={{ maxWidth: 1120, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel>The Loop</SectionLabel>
          <h2
            className="m-display m-text-shimmer"
            style={{
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              marginBottom: 48,
              maxWidth: 600,
            }}
          >
            Six steps. Automated detection. Human-approved fixes.
          </h2>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: 'var(--m-text-secondary)',
              maxWidth: 560,
              marginBottom: 40,
            }}
          >
            Steps 1{'\u2013'}3 and 5{'\u2013'}6 run automatically on a schedule. Step 4 (Fix) is human-gated {'\u2014'} you review and approve every change before it goes live. Your business, your call.
          </p>

          <LoopVisual />
        </div>
      </section>

      {/* ── 10 Engine Sections ── */}
      {ENGINES.map((engine, i) => (
        <section
          key={engine.num}
          className="m-section m-reveal"
          style={{
            background: i % 2 === 0 ? 'var(--m-bg-secondary)' : 'var(--m-bg-primary)',
            paddingTop: 72,
            paddingBottom: 72,
          }}
        >
          <div style={{ maxWidth: 1120, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 48,
              }}
              className="m-engine-grid m-reveal-stagger m-stagger-grid"
            >
              {/* Engine header + description */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <EngineBadge num={engine.num} />
                  <div>
                    <SectionLabel>{`Engine ${engine.num}`}</SectionLabel>
                    <h2
                      className="m-display"
                      style={{
                        fontSize: 'clamp(22px, 3vw, 32px)',
                        marginBottom: 0,
                      }}
                    >
                      {engine.name}
                    </h2>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: 17,
                    lineHeight: 1.7,
                    color: 'var(--m-text-secondary)',
                    maxWidth: 640,
                    marginBottom: 24,
                  }}
                >
                  {engine.description}
                </p>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {engine.details.map((detail) => (
                    <li
                      key={detail}
                      style={{
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: 'var(--m-text-secondary)',
                        padding: '5px 0',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--m-green)',
                          fontWeight: 700,
                          fontSize: 14,
                          lineHeight: '24px',
                          flexShrink: 0,
                        }}
                      >
                        {'\u2713'}
                      </span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mock data for specific engines */}
              {engine.num === 3 && <GreedMock />}
              {engine.num === 7 && <CrawlerMock />}
              {engine.num === 8 && <FirstMoverMock />}
              {engine.num === 10 && <AgentReadinessMock />}
            </div>
          </div>
        </section>
      ))}

      {/* ── Bottom Loop Repeat ── */}
      <section
        className="m-section m-reveal"
        style={{
          background: 'var(--m-bg-secondary)',
          paddingTop: 72,
          paddingBottom: 72,
        }}
      >
        <div style={{ maxWidth: 1120, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <h2
            className="m-display m-text-shimmer"
            style={{
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              marginBottom: 16,
              textAlign: 'center',
              maxWidth: 700,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            The complete loop. Always watching. You approve.
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: 'var(--m-text-secondary)',
              textAlign: 'center',
              maxWidth: 600,
              marginLeft: 'auto',
              marginRight: 'auto',
              marginBottom: 48,
            }}
          >
            Detection, diagnosis, and verification run automatically. Fixes require your approval {'\u2014'} because it{'\u2019'}s your business. No other tool completes this full loop for local businesses.
          </p>

          <LoopVisual />
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          background: 'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
          padding: '80px 24px',
        }}
      >
        <h2
          className="m-display"
          style={{
            maxWidth: 700,
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: 20,
          }}
        >
          See what AI is getting wrong about your business.
        </h2>
        <p
          style={{
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 32,
            maxWidth: 500,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Run a free audit. No account required. Results in 8 seconds.
        </p>
        <a
          href="/scan"
          className="m-btn-primary"
          style={{ fontSize: 16, padding: '16px 36px' }}
        >
          Start Your First AI Audit {'\u2192'}
        </a>
      </section>

      <MarketingFooter />

      {/* ── Responsive styles ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 768px) {
              .m-engine-grid {
                grid-template-columns: 1fr 1fr !important;
              }
            }
            @media (max-width: 640px) {
              .m-loop-flow {
                flex-wrap: wrap !important;
                justify-content: center !important;
              }
              .m-loop-arrow {
                display: none !important;
              }
            }
          `,
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Loop visual — horizontal DETECT → EXPLAIN → GUIDE → FIX → VERIFY → MEASURE
// ---------------------------------------------------------------------------

function LoopVisual() {
  return (
    <div
      className="m-loop-flow"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        flexWrap: 'nowrap',
        overflowX: 'auto',
        padding: '20px 0',
      }}
    >
      {LOOP_STEPS.map((step, i) => (
        <div
          key={step}
          className={i % 2 === 0 ? 'm-reveal-left' : 'm-reveal-right'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 24px',
                background: step === 'FIX' ? 'transparent' : 'var(--m-green)',
                color: step === 'FIX' ? 'var(--m-green)' : '#fff',
                border: step === 'FIX' ? '2px dashed var(--m-green)' : '2px solid transparent',
                fontFamily: 'var(--font-bricolage-grotesque), sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(12px, 1.5vw, 15px)',
                letterSpacing: '0.04em',
                borderRadius: 10,
                whiteSpace: 'nowrap',
                boxShadow: step === 'FIX' ? 'none' : '0 2px 8px rgba(0,168,107,0.2)',
              }}
            >
              {step}
            </div>
            {step === 'FIX' && (
              <span
                className="m-mono"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--m-text-muted)',
                  letterSpacing: '0.04em',
                }}
              >
                YOU APPROVE
              </span>
            )}
          </div>
          {i < LOOP_STEPS.length - 1 && (
            <div
              className="m-loop-arrow"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
              }}
            >
              <svg
                width="32"
                height="16"
                viewBox="0 0 32 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M0 8H28M28 8L22 2M28 8L22 14"
                  stroke="#00A86B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Engine badge — circular green number
// ---------------------------------------------------------------------------

function EngineBadge({ num }: { num: number }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'var(--m-green)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-bricolage-grotesque), sans-serif',
        fontWeight: 800,
        fontSize: 18,
        flexShrink: 0,
      }}
    >
      {num}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock: Greed Engine action list
// ---------------------------------------------------------------------------

function GreedMock() {
  return (
    <div
      className="m-card m-reveal-scale"
      style={{
        borderRadius: 12,
        padding: 24,
        border: '1px solid var(--m-border-base)',
        alignSelf: 'start',
      }}
    >
      <p
        className="m-mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--m-text-muted)',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Example: Gap Actions
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, counterReset: 'gap' }}>
        {GREED_MOCK.map((action) => (
          <li
            key={action}
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--m-text-secondary)',
              padding: '8px 0',
              borderBottom: '1px solid var(--m-border-base)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
          >
            <span style={{ color: 'var(--m-green)', fontWeight: 700 }}>{'\u2192'}</span>
            {action}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock: Crawler analytics table
// ---------------------------------------------------------------------------

function CrawlerMock() {
  return (
    <div
      className="m-card"
      style={{
        borderRadius: 12,
        padding: 24,
        border: '1px solid var(--m-border-base)',
        alignSelf: 'start',
      }}
    >
      <p
        className="m-mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--m-text-muted)',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        AI Bot Activity (Last 30 Days)
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {CRAWLER_MOCK.map((row, i) => (
          <div
            key={row.bot}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < CRAWLER_MOCK.length - 1 ? '1px solid var(--m-border-base)' : 'none',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--m-text-primary)', fontWeight: 500 }}>{row.bot}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--m-text-muted)' }}>
                {row.visits} visit{row.visits !== 1 ? 's' : ''}
              </span>
              <span
                style={{
                  color: row.status ? 'var(--m-green)' : 'var(--m-red)',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {row.status ? '\u2713' : '\u2717'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock: First Mover uncited queries
// ---------------------------------------------------------------------------

function FirstMoverMock() {
  return (
    <div
      className="m-card m-reveal-scale"
      style={{
        borderRadius: 12,
        padding: 24,
        border: '1px solid var(--m-border-base)',
        alignSelf: 'start',
      }}
    >
      <p
        className="m-mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--m-text-muted)',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Unclaimed Queries
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {FIRST_MOVER_MOCK.map((row, i) => (
          <div
            key={i}
            style={{
              padding: '12px 0',
              borderBottom: i < FIRST_MOVER_MOCK.length - 1 ? '1px solid var(--m-border-base)' : 'none',
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--m-text-primary)',
                marginBottom: 4,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
            >
              {row.query}
            </p>
            <p
              className="m-mono"
              style={{
                fontSize: 12,
                color: 'var(--m-amber)',
                fontWeight: 600,
                margin: 0,
              }}
            >
              {'\u26A0'} {row.cited}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock: Agent Readiness score card
// ---------------------------------------------------------------------------

function AgentReadinessMock() {
  const passCount = AGENT_READINESS_MOCK.filter((c) => c.pass).length;
  const total = AGENT_READINESS_MOCK.length;
  const score = Math.round((passCount / total) * 100);

  return (
    <div
      className="m-card m-reveal-scale"
      style={{
        borderRadius: 12,
        padding: 24,
        border: '1px solid var(--m-border-base)',
        alignSelf: 'start',
      }}
    >
      <p
        className="m-mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--m-text-muted)',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Agent Readiness Score
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          marginBottom: 20,
        }}
      >
        <span
          className="m-display"
          style={{
            fontSize: 48,
            color: score >= 70 ? 'var(--m-green)' : score >= 40 ? 'var(--m-amber)' : 'var(--m-red)',
          }}
        >
          {score}
        </span>
        <span
          style={{
            fontSize: 20,
            color: 'var(--m-text-muted)',
            fontWeight: 400,
          }}
        >
          /100
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {AGENT_READINESS_MOCK.map((row, i) => (
          <div
            key={row.capability}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom:
                i < AGENT_READINESS_MOCK.length - 1 ? '1px solid var(--m-border-base)' : 'none',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--m-text-primary)' }}>{row.capability}</span>
            <span
              style={{
                color: row.pass ? 'var(--m-green)' : 'var(--m-red)',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {row.pass ? '\u2713' : '\u2717'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
