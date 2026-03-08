// ---------------------------------------------------------------------------
// "What is Apple Business Connect?" — Content Page
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is Apple Business Connect? | LocalVector.ai',
  description:
    'Apple Business Connect lets you manage how your business appears across Apple Maps, Siri, Spotlight, and Wallet. Learn how it works and why it matters for AI visibility.',
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Apple Business Connect?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Apple Business Connect is a free tool from Apple that lets business owners claim and manage their business listing across Apple Maps, Siri, Spotlight Search, and Apple Wallet. It is the Apple equivalent of Google Business Profile, giving you direct control over how your business appears to the 2+ billion Apple device users worldwide.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why is Apple Business Connect important for AI visibility?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Apple Business Connect data feeds directly into Apple Intelligence and Siri. Without a claimed and verified Apple Business Connect listing, Apple relies on third-party data that may be outdated or incorrect. Claiming your listing gives you first-party control over what Siri tells users about your business.',
      },
    },
  ],
};

export default function AppleBusinessConnectPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="APPLE BUSINESS CONNECT"
        title="What is Apple Business Connect?"
        subtitle="Your direct line to 2+ billion Apple devices — and the AI that powers them."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Apple Business Connect</strong> is a free tool from Apple that allows business owners to claim and manage how their business appears across Apple Maps, Siri, Spotlight Search, Safari, and Apple Wallet. Think of it as the Apple equivalent of Google Business Profile.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Launched in early 2023 and expanded significantly in 2024&ndash;2025, Apple Business Connect gives businesses direct control over their name, hours, photos, action links (order food, book appointment), and special promotions in Apple&apos;s ecosystem. Without it, Apple uses third-party aggregators &mdash; which may have outdated or incorrect information.
          </p>
        </div>
      </section>

      {/* What You Can Control */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>WHAT YOU CONTROL</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 40 }}>
            What Apple Business Connect lets you manage
          </h2>
        </div>

        <div className="m-grid3 m-reveal-stagger" style={{ maxWidth: 900 }}>
          <FeatureCard
            number="1"
            title="Place Cards"
            description="Your business card in Apple Maps — name, category, hours, address, phone, photos. This is the first thing users see when they find you on Apple Maps."
          />
          <FeatureCard
            number="2"
            title="Action Links"
            description="Direct buttons for Order Food, Book Appointment, Reserve Table, and more. These appear directly in Maps and Siri results, letting customers take action without leaving Apple's ecosystem."
          />
          <FeatureCard
            number="3"
            title="Showcases"
            description="Time-limited promotions and announcements displayed on your place card. Highlight seasonal menus, special offers, or new services directly in Apple Maps."
          />
        </div>
      </section>

      {/* AI Connection */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel color="#D97706">THE AI CONNECTION</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            Apple Business Connect + Apple Intelligence
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Apple Business Connect data is a primary input for Apple Intelligence and Siri. When a user asks Siri &ldquo;find a good Italian restaurant nearby,&rdquo; Siri draws on Apple Maps data &mdash; which comes from Apple Business Connect for claimed businesses, or from third-party aggregators for unclaimed ones.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Businesses with verified Apple Business Connect listings get:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <BenefitItem text="First-party data priority — your verified information takes precedence over aggregator data" />
            <BenefitItem text="Action-ready presence — Siri can offer 'Order Food' or 'Book Appointment' buttons directly" />
            <BenefitItem text="Richer Siri answers — hours, menu highlights, and real-time promotions feed into conversational answers" />
            <BenefitItem text="Higher trust signal — claimed businesses rank higher in Apple's relevance algorithms" />
          </ul>
        </div>
      </section>

      {/* Getting Started */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel>GETTING STARTED</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            How to claim your Apple Business Connect listing
          </h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, counterReset: 'step' }}>
            <StepItem step="1" text="Go to Apple Business Connect (business.apple.com) and sign in with your Apple ID" />
            <StepItem step="2" text="Search for your business and claim the listing — or create a new one if not found" />
            <StepItem step="3" text="Verify ownership via phone call, email, or document upload" />
            <StepItem step="4" text="Complete your profile: hours, photos, categories, action links, and descriptions" />
            <StepItem step="5" text="Keep it updated — stale data is worse than no data in Apple's trust model" />
          </ol>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760, marginTop: 32 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>LocalVector.ai</strong> monitors your Apple Business Connect presence, tracks Applebot crawl activity on your website, and can push structured menu data directly to Apple&apos;s Food Menus API for restaurant businesses.
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
            <RelatedLink href="/what-is/siri-readiness">Siri Readiness</RelatedLink>
            <RelatedLink href="/what-is/agent-seo">Agent SEO</RelatedLink>
            <RelatedLink href="/what-is/aeo">AEO</RelatedLink>
            <RelatedLink href="/glossary#ai-crawler">AI Crawler</RelatedLink>
            <RelatedLink href="/glossary#ground-truth">Ground Truth</RelatedLink>
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
            Is your business optimized for Apple Intelligence?
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            Run a free AI audit and see your Siri Readiness Score in 8 seconds.
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

function FeatureCard({ number, title, description }: { number: string; title: string; description: string }) {
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

function BenefitItem({ text }: { text: string }) {
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

function StepItem({ step, text }: { step: string; text: string }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
        fontSize: 16,
        lineHeight: 1.65,
        color: 'var(--m-text-secondary)',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--m-green)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {step}
      </span>
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
