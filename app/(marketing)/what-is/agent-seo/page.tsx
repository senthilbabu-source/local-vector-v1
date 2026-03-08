// ---------------------------------------------------------------------------
// "What is Agent SEO?" — AEO Content Page (uncontested query cluster)
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is Agent SEO (AAO)? | How AI Agents Book Appointments & Take Actions | LocalVector.ai',
  description:
    'Agent SEO (also called Assistive Agent Optimization or AAO) is the practice of making your local business discoverable and actionable by AI agents like OpenAI Operator, Google Jarvis, and Apple Intelligence.',
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Agent SEO?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Agent SEO (also called Assistive Agent Optimization or AAO) is the practice of structuring your business\'s digital presence so that AI agents can not only find your business but take action on a customer\'s behalf — booking an appointment, scheduling a service, or checking availability.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can AI book an appointment at my business?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, if your website has the right structured data. AI agents need ReserveAction or ScheduleAction schema, structured hours, and CAPTCHA-free booking flows. LocalVector\'s Agent Readiness Score measures all 6 capabilities and generates the missing schema automatically.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is ReserveAction schema?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ReserveAction is a Schema.org type that provides AI agents with a machine-parseable reservation link. When present, AI agents like Siri or Google Assistant can complete a booking without the customer ever visiting your website.',
      },
    },
  ],
};

const CAPABILITIES = [
  { name: 'Structured Hours', need: 'OpeningHoursSpecification schema', why: 'Agent must confirm you\'re open before attempting a booking', status: 'check' as const },
  { name: 'Service/Menu Schema', need: 'Service, Menu, or Product JSON-LD', why: 'Agent must know what you offer before recommending you', status: 'check' as const },
  { name: 'ReserveAction', need: 'ReserveAction or ScheduleAction + url', why: 'Agent needs a machine-parseable booking or appointment link', status: 'x' as const },
  { name: 'OrderAction', need: 'OrderAction + target property', why: 'Agent needs a machine-parseable order or request endpoint', status: 'x' as const },
  { name: 'Accessible CTAs', need: 'Buttons labeled in HTML text', why: 'Agents can\'t read icons; they need semantic text', status: 'warn' as const },
  { name: 'CAPTCHA-Free Flows', need: 'Booking completable without CAPTCHA', why: 'Agents can\'t solve CAPTCHAs', status: 'check' as const },
];

export default function AgentSEOPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="AGENT SEO EXPLAINED"
        title={<>What is Agent SEO?<br /><span style={{ fontSize: '0.65em', fontWeight: 700, color: 'var(--m-text-secondary)' }}>(And Why Your Business Needs It in 2026)</span></>}
        subtitle="The next shift after 'AI recommends' is 'AI acts.' Here's what that means for your business."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Agent SEO</strong> (also called <strong style={{ color: 'var(--m-text-primary)' }}>Assistive Agent Optimization</strong> or <strong style={{ color: 'var(--m-text-primary)' }}>AAO</strong>) is the practice of structuring your business&apos;s digital presence so that AI agents &mdash; systems like OpenAI Operator, Google Jarvis, and Apple Intelligence Actions &mdash; can not only <em>find</em> your business but <em>take action</em> on a customer&apos;s behalf. That means booking an appointment, scheduling a service call, or checking availability without the customer ever having to visit your website.
          </p>
        </div>
      </section>

      {/* The Shift */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>THE SHIFT</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            From &ldquo;AI recommends&rdquo; to &ldquo;AI acts&rdquo;
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Until 2025, AI search was primarily informational: a customer asked ChatGPT for a recommendation, and ChatGPT answered with names and descriptions. The customer still had to act.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            That&apos;s changing. AI agents can now complete the full transaction. A customer says:
          </p>

          <blockquote
            style={{
              margin: '0 0 24px',
              paddingLeft: 24,
              borderLeft: '4px solid var(--m-green)',
            }}
          >
            <p
              style={{
                fontSize: 'clamp(17px, 2vw, 20px)',
                fontStyle: 'italic',
                lineHeight: 1.65,
                color: 'var(--m-text-primary)',
                margin: 0,
              }}
            >
              &ldquo;Book me a teeth cleaning at a dental clinic near me for Saturday at 10 AM.&rdquo;
            </p>
          </blockquote>

          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            The AI agent &mdash; if your business is agent-ready &mdash; completes the appointment without the customer opening a new app. If your business isn&apos;t agent-ready, the agent books your competitor.
          </p>
        </div>
      </section>

      {/* 6 Capabilities */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal">
          <SectionLabel>THE 6 CAPABILITIES</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            What AI agents check
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 800, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--m-border-base)' }}>
                <th style={thStyle}>Capability</th>
                <th style={thStyle}>What the agent needs</th>
                <th style={thStyle}>Why it matters</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap, i) => (
                <tr key={cap.name} style={{ borderBottom: i < CAPABILITIES.length - 1 ? '1px solid var(--m-border-base)' : 'none' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{cap.name}</td>
                  <td style={tdStyle}>
                    <code className="m-mono" style={{ fontSize: 13, color: 'var(--m-green-dark)', background: 'var(--m-green-light)', padding: '2px 6px', borderRadius: 4 }}>
                      {cap.need}
                    </code>
                  </td>
                  <td style={tdStyle}>{cap.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mock Score Card */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>AGENT READINESS SCORE</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            LocalVector scores your agent readiness automatically
          </h2>
        </div>

        <div className="m-card m-reveal" style={{ maxWidth: 500, borderRadius: 12, borderLeft: '4px solid var(--m-green)' }}>
          <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-text-muted)', marginBottom: 12 }}>
            AGENT READINESS SCORE
          </p>
          <p className="m-display" style={{ fontSize: 48, color: 'var(--m-amber)', marginBottom: 20 }}>
            42<span style={{ fontSize: 20, color: 'var(--m-text-muted)' }}>/100</span>
          </p>

          <ScoreRow label="Structured Hours" status="check" />
          <ScoreRow label="Service/Menu Schema" status="check" />
          <ScoreRow label="ReserveAction" status="x" />
          <ScoreRow label="OrderAction" status="x" />
          <ScoreRow label="Accessible CTAs" status="warn" />
          <ScoreRow label="CAPTCHA-Free Flows" status="check" last />

          <p style={{ fontSize: 14, color: 'var(--m-text-secondary)', marginTop: 16 }}>
            &ldquo;3 of 6 agent capabilities are machine-accessible.&rdquo;
          </p>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760, marginTop: 32 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            No other local business tool has this score. LocalVector generates the missing schema with one click.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            <RelatedLink href="/what-is/aeo">What is AEO?</RelatedLink>
            <RelatedLink href="/what-is/geo">What is GEO?</RelatedLink>
            <RelatedLink href="/how-it-works">How It Works</RelatedLink>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="m-section"
        style={{
          background: 'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
        }}
      >
        <div className="m-reveal">
          <h2 className="m-display" style={{ maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', marginBottom: 20 }}>
            Check your Agent Readiness Score
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            Find out if AI agents can book your business. Free scan. 8 seconds.
          </p>
          <a href="/scan" className="m-btn-primary" style={{ textDecoration: 'none' }}>
            Start Free AI Audit &rarr;
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

/* ---- Helpers ---- */

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontWeight: 600,
  color: 'var(--m-text-primary)',
  fontSize: 14,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--m-text-secondary)',
  fontSize: 14,
  lineHeight: 1.5,
  verticalAlign: 'top',
};

function ScoreRow({ label, status, last = false }: { label: string; status: 'check' | 'x' | 'warn'; last?: boolean }) {
  const icons = {
    check: { symbol: '\u2713', color: 'var(--m-green)' },
    x: { symbol: '\u2717', color: '#DC2626' },
    warn: { symbol: '\u26A0', color: 'var(--m-amber)' },
  };
  const { symbol, color } = icons[status];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid var(--m-border-base)',
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--m-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{symbol}</span>
    </div>
  );
}

function RelatedLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-block',
        padding: '6px 14px',
        borderRadius: 6,
        background: 'var(--m-green-light)',
        color: 'var(--m-green-dark)',
        fontSize: 14,
        fontWeight: 600,
        textDecoration: 'none',
        border: '1px solid var(--m-border-green)',
      }}
    >
      {children}
    </a>
  );
}
