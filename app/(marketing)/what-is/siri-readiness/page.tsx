// ---------------------------------------------------------------------------
// "What is Siri Readiness?" — Content Page
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is Siri Readiness? — Apple Intelligence & Local Business | LocalVector.ai',
  description:
    'Siri Readiness measures how well your business is prepared for Apple Intelligence and Siri-powered search. Learn what signals Apple uses and how to optimize.',
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Siri Readiness?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Siri Readiness is a score that measures how prepared your local business is to appear in Apple Intelligence and Siri-powered search results. It evaluates factors like Apple Business Connect enrollment, structured data quality, and website crawlability by Applebot.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why does Siri Readiness matter for local businesses?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'With over 2 billion active Apple devices and Apple Intelligence rolling out across iPhone, iPad, and Mac, Siri is becoming a primary way consumers discover local businesses. If your business data is missing or incorrect in Apple\'s ecosystem, you are invisible to a massive audience.',
      },
    },
  ],
};

export default function SiriReadinessPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="SIRI READINESS"
        title="What is Siri Readiness?"
        subtitle="How Apple Intelligence uses your business data — and how to make sure it gets it right."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Siri Readiness</strong> is a composite score that measures how well your local business is prepared to be accurately discovered and recommended by Apple Intelligence, Siri, Apple Maps, and Spotlight Search across the Apple ecosystem.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            With Apple Intelligence rolling out across 2+ billion active devices in 2025&ndash;2026, Siri is evolving from a simple voice assistant into a context-aware AI that recommends businesses, answers questions, and takes action on behalf of users. Businesses that aren&apos;t optimized for this channel are invisible to the largest consumer device ecosystem in the world.
          </p>
        </div>
      </section>

      {/* The Four Signals */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>THE FOUR SIGNALS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 40 }}>
            What Apple Intelligence looks for
          </h2>
        </div>

        <div className="m-grid2" style={{ maxWidth: 760 }}>
          <SignalCard
            number="1"
            title="Apple Business Connect"
            description="Your verified business listing in Apple's ecosystem. Controls how you appear in Apple Maps, Siri results, and Wallet. Without it, Apple uses third-party data — which may be wrong."
          />
          <SignalCard
            number="2"
            title="Applebot Crawlability"
            description="Apple's web crawler (Applebot) must be able to access and parse your website. Many businesses unknowingly block Applebot via robots.txt, making their site invisible to Siri."
          />
          <SignalCard
            number="3"
            title="Structured Data"
            description="JSON-LD schema markup on your website that Applebot can parse — business hours, address, menu items, services, pricing. The more structured data, the more accurately Siri can describe you."
          />
          <SignalCard
            number="4"
            title="Data Consistency"
            description="Agreement between your Apple Business Connect profile, website, Google Business Profile, and third-party directories. Conflicting data causes Siri to reduce confidence in its recommendations."
          />
        </div>
      </section>

      {/* Why It Matters */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel color="#D97706">WHY IT MATTERS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            The Apple Intelligence opportunity
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Apple Intelligence represents one of the largest shifts in how consumers discover local businesses since the smartphone revolution:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <OpportunityItem text="2+ billion active Apple devices worldwide — iPhone, iPad, Mac, Apple Watch, Vision Pro" />
            <OpportunityItem text="Siri handles 25+ billion requests per month, with local queries growing fastest" />
            <OpportunityItem text="Apple Maps is the default navigation on every iPhone — it uses Business Connect data" />
            <OpportunityItem text="Apple Intelligence is integrated at the OS level — appearing in Messages, Mail, Safari, and more" />
          </ul>
        </div>
      </section>

      {/* How to Improve */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel>IMPROVING YOUR SCORE</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            How LocalVector helps with Siri Readiness
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>LocalVector.ai</strong> calculates your Siri Readiness Score by checking all four signals: Apple Business Connect enrollment, Applebot access, structured data quality, and cross-platform data consistency. It then provides specific, actionable steps to improve each signal.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            For businesses on Growth and Agency plans, LocalVector can automatically push structured menu data to Apple Business Connect and monitor Applebot crawl activity on your website.
          </p>
        </div>
      </section>

      {/* Related */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 15, color: 'var(--m-text-secondary)', marginBottom: 12 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Related terms:</strong>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <RelatedLink href="/what-is/apple-business-connect">Apple Business Connect</RelatedLink>
            <RelatedLink href="/what-is/agent-seo">Agent SEO</RelatedLink>
            <RelatedLink href="/what-is/aeo">AEO</RelatedLink>
            <RelatedLink href="/glossary#ai-crawler">AI Crawler</RelatedLink>
            <RelatedLink href="/glossary#schema-org-json-ld">JSON-LD Schema</RelatedLink>
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
            Check your Siri Readiness Score
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            See how prepared your business is for Apple Intelligence. Free audit, no account required.
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

/* ---- Helper components ---- */

function SignalCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="m-card m-reveal" style={{ borderRadius: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--m-green)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 16,
          marginBottom: 16,
        }}
        className="m-display"
      >
        {number}
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--m-text-primary)', marginBottom: 12 }}>
        {title}
      </h3>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--m-text-secondary)', margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function OpportunityItem({ text }: { text: string }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 12,
        fontSize: 16,
        lineHeight: 1.65,
        color: 'var(--m-text-secondary)',
      }}
    >
      <span style={{ color: 'var(--m-green)', fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 2 }}>{'\u2713'}</span>
      <span>{text}</span>
    </li>
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
