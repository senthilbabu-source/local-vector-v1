// ---------------------------------------------------------------------------
// "What is an AI Hallucination?" — AEO Content Page
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is an AI Hallucination? | Impact on Local Business | LocalVector.ai',
  description:
    "An AI hallucination is when an AI model states false information as fact. For local businesses, this means AI telling customers wrong hours, wrong prices, or that you're 'permanently closed' when you're not.",
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is an AI hallucination?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'An AI hallucination is when an artificial intelligence model generates information that is factually incorrect, but presents it with the same confidence as accurate information. For local businesses, this means AI telling customers wrong hours, wrong prices, or that a business is "permanently closed" when it is open.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do AI hallucinations affect local businesses?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AI hallucinations about local businesses are revenue events. A customer who asks ChatGPT "is this dentist accepting new patients?" and receives "they appear to be closed" will book elsewhere without verifying. A single "closed" hallucination running for 30 days costs a typical local business $1,400–$2,000 in lost revenue.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do you fix an AI hallucination about your business?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Fix the underlying data: update your Google Business Profile, publish structured data (JSON-LD schema and llms.txt), correct inconsistencies across directories, and convert PDF menus to structured format. AI models typically update within 7–14 days as crawlers refresh their data.',
      },
    },
  ],
};

export default function AIHallucinationPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="AI HALLUCINATIONS EXPLAINED"
        labelColor="#DC2626"
        title="What is an AI Hallucination?"
        subtitle="When AI states false information as fact — and what it means for your business."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            An <strong style={{ color: 'var(--m-text-primary)' }}>AI hallucination</strong> is when an artificial intelligence model generates information that is factually incorrect, but presents it with the same confidence as accurate information. The term comes from the model&apos;s tendency to &ldquo;fill in gaps&rdquo; in its knowledge with plausible-sounding but false information.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            For large language models (LLMs) like ChatGPT, Gemini, and Perplexity, hallucinations occur most commonly when the model lacks reliable data about a specific topic and extrapolates from patterns in its training data rather than verified facts.
          </p>
        </div>
      </section>

      {/* Why Local Businesses */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel color="#DC2626">HIGH RISK</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            Why AI hallucinations affect local businesses
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            For well-documented topics (history, science, public figures), AI hallucination rates are relatively low. For local business data &mdash; hours, prices, menus, services, current availability &mdash; hallucination rates are significantly higher. Why?
          </p>
        </div>

        <div className="m-grid2 m-reveal-stagger" style={{ maxWidth: 760 }}>
          <ReasonCard title="Changes frequently" description="Hours, menus, prices change regularly. Training data goes stale." />
          <ReasonCard title="Inconsistent across sources" description="Your GBP says one thing; an old Yelp review says another. AI averages or guesses." />
          <ReasonCard title="Unstructured formats" description="PDF menus, service brochures, Instagram photos — AI can't parse these. It guesses from third-party data." />
          <ReasonCard title="Low-quality training sources" description="User reviews, cached pages, outdated directories feed AI wrong information." />
        </div>
      </section>

      {/* Common Hallucinations */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal">
          <SectionLabel>COMMON EXAMPLES</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            Common AI hallucinations about local businesses
          </h2>
        </div>

        <div className="m-reveal-stagger" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HallucinationExample
            type="Closed business error"
            description='AI states a business is "temporarily closed" or "permanently closed" when it is actively operating'
            severity="critical"
          />
          <HallucinationExample
            type="Wrong hours"
            description="AI states incorrect opening or closing times based on stale or conflicting data"
            severity="critical"
          />
          <HallucinationExample
            type="Wrong services or pricing"
            description='AI lists services a business doesn&apos;t offer, or quotes third-party pricing markups as actual prices (e.g., inflated delivery app prices for a restaurant, or wrong consultation fees for a law firm)'
            severity="high"
          />
          <HallucinationExample
            type="Missing or wrong attributes"
            description='AI omits or invents key attributes &mdash; "no walk-ins" for a salon that accepts them, "no emergency appointments" for a dentist that offers same-day care, or "no outdoor seating" for a restaurant with a large patio'
            severity="high"
          />
          <HallucinationExample
            type="Wrong business category"
            description='AI misidentifies the type of business (e.g., "general practitioner" instead of "med spa," "sports bar" instead of "cocktail lounge," or "kennel" instead of "veterinary clinic")'
            severity="medium"
          />
          <HallucinationExample
            type="Wrong credentials or specialties"
            description='AI fabricates or confuses professional credentials, certifications, or specialties &mdash; wrong license type for a contractor, invented board certifications for a dentist, or incorrect class offerings for a yoga studio'
            severity="medium"
          />
        </div>
      </section>

      {/* Economic Impact */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel color="#DC2626">THE COST</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            The economic impact
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            AI hallucinations about local businesses are not minor inconveniences &mdash; they&apos;re revenue events.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 32 }}>
            A customer who asks ChatGPT &ldquo;is [business] open tonight?&rdquo; or &ldquo;is [dentist] accepting new patients?&rdquo; and receives &ldquo;it appears to be closed&rdquo; will not typically verify that answer. They&apos;ll book elsewhere. They won&apos;t call. They won&apos;t check Google. The AI answered with confidence.
          </p>
        </div>

        <div className="m-card m-reveal" style={{ maxWidth: 760, borderLeft: '4px solid #DC2626', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <span className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: '#DC2626' }}>
              $1,400&ndash;$2,000
            </span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--m-text-secondary)', margin: 0 }}>
            Estimated monthly revenue lost from a single &ldquo;closed&rdquo; hallucination running for 30 days at a typical local business &mdash; whether a restaurant, dental clinic, hair salon, or auto repair shop. This estimate is conservative.
          </p>
        </div>
      </section>

      {/* How to Detect */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel>DETECTION</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            How to detect AI hallucinations about your business
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            The most direct method: query the AI models yourself. Type your business name into ChatGPT, Perplexity, and Gemini and ask: &ldquo;Is [business name] currently open?&rdquo; &ldquo;What are [business name]&apos;s hours?&rdquo;
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            The problem with manual checking: it&apos;s a point-in-time snapshot. AI models update constantly. And manual checking across 5 AI models, weekly, for every question a customer might ask &mdash; is not a realistic task for a business owner.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>LocalVector.ai</strong> automates this process: running standardized queries against multiple AI models weekly, comparing responses against your verified Ground Truth, and alerting you immediately when a discrepancy is detected.
          </p>
        </div>
      </section>

      {/* How to Fix */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel>THE FIX</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            How to fix an AI hallucination
          </h2>

          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            AI models don&apos;t have a &ldquo;submit correction&rdquo; button. Fixing a hallucination requires addressing the underlying data:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FixStep number="1" title="Update your Google Business Profile" description="This is the highest-trust source for AI when querying local business data." />
            <FixStep number="2" title="Publish structured data" description="JSON-LD schema and llms.txt give AI explicit, machine-readable information that supersedes inferred guesses." />
            <FixStep number="3" title="Correct inconsistencies across directories" description="If your Yelp listing says different hours than your GBP, AI has conflicting data and may use either." />
            <FixStep number="4" title="Publish AI-readable service and menu data" description="Converting PDF menus, service lists, and price sheets to structured format prevents service and pricing hallucinations specifically." />
          </div>

          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginTop: 24 }}>
            After corrections are made, AI models typically update within 7&ndash;14 days as crawlers refresh their data.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            <RelatedLink href="/what-is/aeo">What is AEO?</RelatedLink>
            <RelatedLink href="/what-is/geo">What is GEO?</RelatedLink>
            <RelatedLink href="/case-studies">Case Studies</RelatedLink>
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
          <h2 className="m-display" style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto', marginBottom: 20 }}>
            Run a free AI hallucination scan on your business
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            Find out what ChatGPT, Perplexity, and Gemini are saying about you right now. 8 seconds.
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

function ReasonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="m-card m-reveal" style={{ borderRadius: 12 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--m-text-primary)', marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--m-text-secondary)', margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function HallucinationExample({ type, description, severity }: { type: string; description: string; severity: 'critical' | 'high' | 'medium' }) {
  const colors = {
    critical: { bg: '#FEF2F2', border: '#DC2626', text: '#DC2626' },
    high: { bg: '#FFFBEB', border: '#D97706', text: '#D97706' },
    medium: { bg: 'var(--m-bg-secondary)', border: 'var(--m-border-base)', text: 'var(--m-text-muted)' },
  };
  const c = colors[severity];

  return (
    <div
      className="m-reveal"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        padding: '16px 20px',
        borderRadius: 10,
        background: c.bg,
        border: `1px solid ${c.border}20`,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--m-text-primary)', marginBottom: 4 }}>
          {type}
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--m-text-secondary)', margin: 0 }}>
          {description}
        </p>
      </div>
      <span
        className="m-mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: c.text,
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {severity}
      </span>
    </div>
  );
}

function FixStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div
        className="m-display"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--m-green)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--m-text-primary)', marginBottom: 4 }}>
          {title}
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--m-text-secondary)', margin: 0 }}>
          {description}
        </p>
      </div>
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
