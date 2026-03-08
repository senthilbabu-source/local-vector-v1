// ---------------------------------------------------------------------------
// /changelog — Public Changelog (Sprint D Marketing)
//
// Shows product velocity and build history. Builds trust with prospects.
// Server Component — no 'use client'. Inline styles only.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';
import { SectionLabel } from '../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'Changelog — LocalVector.ai | Product Updates & New Features',
  description:
    'See what we ship every week. LocalVector.ai changelog tracks new features, ' +
    'improvements, and fixes to our AI visibility platform for local businesses.',
  openGraph: {
    title: 'Changelog — LocalVector.ai',
    description: 'See what we ship every week.',
  },
};

// ---------------------------------------------------------------------------
// Changelog entries — newest first
// ---------------------------------------------------------------------------

interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  highlights: string[];
  tag: 'feature' | 'improvement' | 'fix';
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'March 2026',
    version: 'v2.6',
    title: 'Community Monitoring + Perplexity Pages Detection',
    highlights: [
      'Nextdoor and Quora brand mention monitoring via Perplexity sonar-pro',
      'Automatic Perplexity Pages URL detection in SOV cited sources',
      'Root-cause linking for hallucination corrections',
      'Siri Readiness Score for Apple Intelligence visibility',
    ],
    tag: 'feature',
  },
  {
    date: 'March 2026',
    version: 'v2.5',
    title: 'Multi-Engine SOV + Distribution Pipeline',
    highlights: [
      'Grok (xAI) and You.com added as SOV engines for agency plans',
      'Google AI Overview monitoring with real Search Console data',
      'Menu distribution pipeline: auto-push to GBP, IndexNow, Apple BC',
      'TripAdvisor review fetcher + Reddit brand monitoring',
    ],
    tag: 'feature',
  },
  {
    date: 'March 2026',
    version: 'v2.4',
    title: 'Dashboard Intelligence & Coaching',
    highlights: [
      'AI coaching heroes on every dashboard page — plain-English guidance',
      'KPI sparklines, goal tracker, and error category breakdown',
      'Weekly report card email with score trends',
      'Share snapshot modal for team collaboration',
    ],
    tag: 'improvement',
  },
  {
    date: 'March 2026',
    version: 'v2.3',
    title: 'Sidebar Restructure + Revenue Intelligence',
    highlights: [
      'Dashboard reorganized into 5 outcome-based groups',
      'Per-issue revenue-at-risk estimates on every alert',
      'AI response teaser on dashboard with engine badges',
      'Quick win widget highlighting your most impactful next action',
    ],
    tag: 'improvement',
  },
  {
    date: 'March 2026',
    version: 'v2.2',
    title: 'Gamification + Urgency Engine',
    highlights: [
      'Health streak badges for consecutive clean scans',
      'Score milestone celebrations with confetti animations',
      'Smart urgency badges on alerts (best-fix-time detection)',
      'Platform fix links — direct deep links to GBP, Yelp, Apple Maps',
    ],
    tag: 'feature',
  },
  {
    date: 'March 2026',
    version: 'v2.1',
    title: 'Fix Guidance + Before/After Proof',
    highlights: [
      'Step-by-step fix guidance for every hallucination category',
      'Before/after cards showing correction impact over time',
      'Revenue recovered tracking on the Lost Sales page',
      'Score attribution popover explaining what changed your score',
    ],
    tag: 'feature',
  },
  {
    date: 'March 2026',
    version: 'v2.0',
    title: 'VAIO + AI Answer Simulation Sandbox',
    highlights: [
      'Voice & Conversational AI Optimization (VAIO) scoring',
      'AI Answer Simulation Sandbox — test changes before publishing',
      'Semantic authority mapping across knowledge graph platforms',
      'Autopilot content generation with human-in-the-loop approval',
    ],
    tag: 'feature',
  },
  {
    date: 'February 2026',
    version: 'v1.8',
    title: 'Multi-Model SOV + Benchmarks',
    highlights: [
      'Per-model citation tracking across 6 AI engines',
      'City + industry benchmark comparisons with percentile ranking',
      'pgvector semantic search for menu items and queries',
      'True token-by-token streaming for AI answer previews',
    ],
    tag: 'feature',
  },
  {
    date: 'February 2026',
    version: 'v1.6',
    title: 'White-Label + Team Management',
    highlights: [
      'Custom domain routing for agency clients',
      'Brand theming — colors, fonts, logos, powered-by toggle',
      'Role-based team seats with invitation flow',
      'Seat-based billing synced with Stripe',
    ],
    tag: 'feature',
  },
  {
    date: 'February 2026',
    version: 'v1.4',
    title: 'NAP Sync + Schema Expansion',
    highlights: [
      'Cross-platform NAP sync: GBP, Yelp, Apple Maps, Bing Places',
      'Auto-generated JSON-LD schemas: FAQ, Hours, LocalBusiness, Events',
      'Review Intelligence engine with brand voice profiling',
      'Apple Business Connect sync pipeline',
    ],
    tag: 'feature',
  },
  {
    date: 'February 2026',
    version: 'v1.0',
    title: 'LocalVector V1 Launch',
    highlights: [
      'AI hallucination detection across ChatGPT, Gemini, Perplexity, Copilot',
      'Reality Score dashboard with AI health scoring',
      'Share of Voice tracking with competitor analysis',
      'Magic Menu — PDF to AI-readable JSON-LD conversion',
      'Correction generator with one-click GBP content publishing',
    ],
    tag: 'feature',
  },
];

const TAG_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  feature: { bg: 'var(--m-green-light)', color: 'var(--m-green)', label: 'NEW FEATURE' },
  improvement: { bg: 'rgba(59,130,246,0.08)', color: 'rgb(59,130,246)', label: 'IMPROVEMENT' },
  fix: { bg: 'rgba(217,119,6,0.08)', color: 'rgb(217,119,6)', label: 'FIX' },
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ChangelogPage() {
  return (
    <div className="lv-marketing">
      <MarketingNav />

      <PageHero
        label="Changelog"
        title="What we ship, every week"
        subtitle="LocalVector moves fast. Here's a record of every major feature, improvement, and fix we've shipped since launch."
      />

      {/* ── Timeline ── */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--m-bg-primary)',
        }}
      >
        <div
          style={{
            maxWidth: 760,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {CHANGELOG.map((entry, i) => {
            const tagStyle = TAG_STYLES[entry.tag];
            return (
              <div
                key={i}
                className="m-reveal"
                style={{
                  position: 'relative',
                  paddingLeft: 32,
                  paddingBottom: i === CHANGELOG.length - 1 ? 0 : 48,
                  borderLeft: i === CHANGELOG.length - 1 ? 'none' : '2px solid var(--m-border-base)',
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: -7,
                    top: 4,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: i === 0 ? 'var(--m-green)' : 'var(--m-border-base)',
                    border: '2px solid var(--m-bg-primary)',
                  }}
                />

                {/* Date + version + tag */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    className="m-mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--m-text-muted)',
                    }}
                  >
                    {entry.date} &middot; {entry.version}
                  </span>
                  <span
                    className="m-mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      padding: '2px 8px',
                      borderRadius: 100,
                      background: tagStyle.bg,
                      color: tagStyle.color,
                    }}
                  >
                    {tagStyle.label}
                  </span>
                </div>

                {/* Title */}
                <h3
                  className="m-display"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--m-text-primary)',
                    marginBottom: 12,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {entry.title}
                </h3>

                {/* Highlights */}
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {entry.highlights.map((h, j) => (
                    <li
                      key={j}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: 'var(--m-text-secondary)',
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
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Subscribe CTA ── */}
      <section
        style={{
          padding: '64px 24px',
          background: 'var(--m-bg-secondary)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
          <SectionLabel>STAY UPDATED</SectionLabel>
          <h2
            className="m-display"
            style={{
              fontSize: 'clamp(24px, 3vw, 36px)',
              marginBottom: 16,
            }}
          >
            We ship fast. Don&apos;t miss a beat.
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: 'var(--m-text-secondary)',
              marginBottom: 32,
            }}
          >
            Follow our blog for in-depth articles, or run a free audit to see the latest
            capabilities in action.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/blog"
              className="m-btn-secondary"
              style={{ fontSize: 14, padding: '12px 24px' }}
            >
              Read the Blog
            </a>
            <a
              href="/scan"
              className="m-btn-primary"
              style={{ fontSize: 14, padding: '12px 24px' }}
            >
              Run Free AI Audit {'\u2192'}
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
