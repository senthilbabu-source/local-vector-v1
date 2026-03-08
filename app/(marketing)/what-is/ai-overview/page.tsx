// ---------------------------------------------------------------------------
// "What is Google AI Overview?" — Content Page
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is Google AI Overview? | LocalVector.ai',
  description:
    'Google AI Overview (formerly SGE) is an AI-generated summary that appears above traditional search results. Learn how it affects local businesses and what you can do about it.',
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Google AI Overview?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Google AI Overview (formerly Search Generative Experience or SGE) is an AI-generated summary that appears at the top of Google search results. It uses Gemini to synthesize information from multiple sources and present a conversational answer before any traditional blue links.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does Google AI Overview affect local businesses?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Google AI Overview can display incorrect business information — wrong hours, outdated menus, closed status — directly in search results. Because it appears above organic results, users may never click through to verify the information, making accuracy in AI Overviews critical for local businesses.',
      },
    },
  ],
};

export default function AIOverviewPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="AI OVERVIEW EXPLAINED"
        title="What is Google AI Overview?"
        subtitle="How Google's AI-generated search summaries affect your local business — and what to do about it."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Google AI Overview</strong> (formerly Search Generative Experience, or SGE) is an AI-generated summary that appears at the top of Google search results. Powered by Gemini, it synthesizes information from multiple sources and presents a conversational answer &mdash; before any traditional blue links appear.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Launched in 2024, AI Overview now appears for an estimated 30&ndash;40% of all Google searches. For local queries &mdash; &ldquo;best pizza near me,&rdquo; &ldquo;dentist open Saturday,&rdquo; &ldquo;emergency plumber&rdquo; &mdash; that number is even higher. The AI answer is the first thing users see, and increasingly the only thing they read.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            Where AI Overview gets its data
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Unlike traditional search results that link to specific pages, AI Overview generates its answer by combining data from multiple sources. For local businesses, these typically include:
          </p>
        </div>

        <div className="m-grid2" style={{ maxWidth: 760 }}>
          <SourceCard
            title="Google Business Profile"
            items={['Business hours', 'Address & phone', 'Categories & attributes', 'Reviews & ratings']}
          />
          <SourceCard
            title="Third-Party Sources"
            items={['Yelp, TripAdvisor reviews', 'Directory listings', 'News articles & blog posts', 'Social media mentions']}
          />
        </div>

        <div className="m-reveal" style={{ maxWidth: 760, marginTop: 24 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            The problem: when these sources disagree, Gemini picks one &mdash; and it may pick wrong. A Yelp review from 2022 mentioning your old hours can override your updated Google Business Profile.
          </p>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal">
          <SectionLabel color="#D97706">THE RISK</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            Why AI Overview accuracy matters for local businesses
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            AI Overview sits above every other search result. When it says your restaurant is &ldquo;permanently closed&rdquo; or your dental office &ldquo;doesn&apos;t accept new patients,&rdquo; users don&apos;t scroll down to check &mdash; they move to the next business.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <RiskItem text="Wrong hours displayed — customers arrive when you're closed, or don't come when you're open" />
            <RiskItem text="Incorrect services listed — AI says you don't offer a service you actually provide" />
            <RiskItem text="Outdated pricing — stale data from third-party sites creates false expectations" />
            <RiskItem text="Competitor confusion — AI conflates your business with a nearby competitor" />
          </ul>
        </div>
      </section>

      {/* Monitoring */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel>MONITORING AI OVERVIEWS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            How to track what AI Overview says about you
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Google Search Console now shows AI Overview impressions &mdash; but not what the AI actually said. You can see that your business appeared in an AI Overview, but not whether the information was accurate.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 32 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>LocalVector.ai</strong> monitors what AI Overview and other AI engines actually say about your business, compares it against your verified ground truth data, and alerts you when inaccuracies are detected &mdash; before they cost you customers.
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
            <RelatedLink href="/what-is/aeo">AEO</RelatedLink>
            <RelatedLink href="/what-is/geo">GEO</RelatedLink>
            <RelatedLink href="/what-is/ai-hallucination">AI Hallucination</RelatedLink>
            <RelatedLink href="/what-is/share-of-voice-ai">Share of Voice</RelatedLink>
            <RelatedLink href="/glossary#ai-crawler">AI Crawler</RelatedLink>
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
            What is AI Overview saying about your business?
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            Find out in 8 seconds. Free, no account required.
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

function SourceCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="m-card m-reveal" style={{ borderRadius: 12 }}>
      <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-green)', marginBottom: 16 }}>
        {title.toUpperCase()}
      </p>
      {items.map((item) => (
        <p key={item} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--m-text-secondary)', marginBottom: 8, paddingLeft: 16, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, color: 'var(--m-text-muted)' }}>{'\u2022'}</span>
          {item}
        </p>
      ))}
    </div>
  );
}

function RiskItem({ text }: { text: string }) {
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
      <span style={{ color: 'var(--m-amber)', fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 2 }}>{'\u26A0'}</span>
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
