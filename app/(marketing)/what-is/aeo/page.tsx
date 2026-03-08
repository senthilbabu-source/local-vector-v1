// ---------------------------------------------------------------------------
// "What is AEO?" — AEO Content Page
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is Answer Engine Optimization (AEO)? | LocalVector.ai',
  description:
    'Answer Engine Optimization (AEO) is the practice of structuring your business content so AI assistants like ChatGPT, Perplexity, and Gemini accurately recommend and describe your business. Here\'s what it means and how it works for local businesses.',
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Answer Engine Optimization (AEO)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Answer Engine Optimization (AEO) is the practice of structuring and distributing your business\'s digital content so that AI assistants like ChatGPT, Perplexity, and Google Gemini can accurately find, understand, and recommend your business when users ask relevant questions.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is AEO different from SEO?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Traditional SEO optimizes for search engine ranking pages (SERPs) — getting your website to appear in Google results. AEO optimizes for AI-generated answers — ensuring that when AI is asked "best dentist near me" or "is X business open?", it accurately cites your business with correct information.',
      },
    },
  ],
};

export default function AEOPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="AEO EXPLAINED"
        title="What is Answer Engine Optimization (AEO)?"
        subtitle="The definitive guide for local businesses navigating the AI search era."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Answer Engine Optimization (AEO)</strong> is the practice of structuring your business&apos;s digital content so that AI assistants &mdash; including ChatGPT, Perplexity, Google Gemini, and Microsoft Copilot &mdash; accurately understand, represent, and recommend your business when users ask relevant questions.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            AEO emerged as a distinct discipline in 2024&ndash;2025 as AI-powered search assistants began replacing traditional search results for a growing category of queries, particularly local intent queries like &ldquo;best dentist near me,&rdquo; &ldquo;what time does X open,&rdquo; and &ldquo;does this salon take walk-ins.&rdquo;
          </p>
        </div>
      </section>

      {/* AEO vs SEO */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>AEO VS SEO</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            How AEO differs from traditional SEO
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Traditional SEO focuses on Google search rankings &mdash; getting your website to appear prominently in search results. AEO addresses a different channel: the AI-generated answer that increasingly appears before any search results, or replaces the search entirely.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 32 }}>
            The distinction matters because these two channels use different trust signals:
          </p>
        </div>

        <div className="m-grid2" style={{ maxWidth: 760 }}>
          <div className="m-card m-reveal-left" style={{ borderLeft: '4px solid var(--m-text-muted)', borderRadius: 12 }}>
            <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-text-muted)', marginBottom: 16 }}>
              SEO TRUSTS
            </p>
            <TrustItem text="Backlinks & domain authority" />
            <TrustItem text="Keyword density" />
            <TrustItem text="Page speed" />
            <TrustItem text="Structured data" />
          </div>
          <div className="m-card m-reveal-right" style={{ borderLeft: '4px solid var(--m-green)', borderRadius: 12 }}>
            <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-green)', marginBottom: 16 }}>
              AEO TRUSTS
            </p>
            <TrustItem text="Factual accuracy across multiple sources" />
            <TrustItem text="Machine-readable structured data" />
            <TrustItem text="Consistency between official and third-party data" />
            <TrustItem text="Recent crawl freshness" />
          </div>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760, marginTop: 24 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            A business can rank #1 on Google and still be described inaccurately by AI &mdash; because AI is synthesizing from a different layer of data.
          </p>
        </div>
      </section>

      {/* Three Components */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal">
          <SectionLabel>THE THREE PILLARS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 40 }}>
            The three components of AEO for local businesses
          </h2>
        </div>

        <div className="m-grid3 m-reveal-stagger" style={{ maxWidth: 900 }}>
          <PillarCard
            number="1"
            title="Accuracy"
            description="Ensuring AI has access to correct, current information about your hours, location, services, prices, and attributes. Fix incorrect data at the source, publish machine-readable data via JSON-LD schema, llms.txt, and structured menu data."
          />
          <PillarCard
            number="2"
            title="Visibility"
            description="Ensuring AI is aware your business exists and chooses to include it in relevant answers. Track Share of Voice, run competitive gap analysis, and create targeted content that answers the questions AI evaluates."
          />
          <PillarCard
            number="3"
            title="Framing"
            description="Ensuring AI describes your business accurately in terms of positioning: premium vs budget, family-friendly vs adult, boutique vs high-volume. Monitor sentiment, review quality, and attribute optimization."
          />
        </div>
      </section>

      {/* Why It Matters */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel color="#D97706">WHY IT MATTERS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            Why AEO matters for local businesses
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            &ldquo;Best dentist near me,&rdquo; &ldquo;where should I eat tonight,&rdquo; &ldquo;emergency HVAC repair&rdquo; &mdash; these are among the most common AI queries. When 68% of consumers use AI assistants to find local services, being accurately represented in AI answers is no longer optional &mdash; it&apos;s a revenue function.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 16 }}>
            Local businesses across every vertical face unique AEO challenges:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <ChallengeItem text="Service lists and menus are typically in unstructured PDF format (invisible to AI)" />
            <ChallengeItem text="Hours change seasonally and aren't always updated across all platforms &mdash; dental offices, salons, and restaurants all suffer from stale data" />
            <ChallengeItem text="Key attributes (walk-ins accepted, emergency availability, ambiance) are critical for AI recommendations but rarely structured" />
            <ChallengeItem text="Pricing data pulled from third-party booking or delivery apps often includes markups that distort AI's representation" />
          </ul>
        </div>
      </section>

      {/* Tools */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            AEO tools and platforms
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Most existing SEO tools &mdash; BrightLocal, Yext, Semrush &mdash; were built before AEO existed as a discipline. They manage directory listings and search rankings but do not monitor or optimize for AI answer accuracy.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 32 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>LocalVector.ai</strong> was built specifically for AEO &mdash; monitoring what AI models say about your business, detecting factual errors, and providing the structured data infrastructure (structured service data, llms.txt, JSON-LD schema) that improves AI accuracy for restaurants, dental clinics, salons, HVAC companies, and any local business.
          </p>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 15, color: 'var(--m-text-secondary)', marginBottom: 12 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Related terms:</strong>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <RelatedLink href="/what-is/geo">GEO</RelatedLink>
            <RelatedLink href="/what-is/ai-hallucination">AI Hallucination</RelatedLink>
            <RelatedLink href="/what-is/share-of-voice-ai">Share of Voice</RelatedLink>
            <RelatedLink href="/what-is/agent-seo">Agent SEO</RelatedLink>
            <RelatedLink href="/glossary#llms-txt">llms.txt</RelatedLink>
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
            Run a free AEO audit for your business
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            See exactly what AI models are saying about you. 8 seconds. No account required.
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

function TrustItem({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--m-text-secondary)', marginBottom: 8, paddingLeft: 16, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, color: 'var(--m-text-muted)' }}>{'\u2022'}</span>
      {text}
    </p>
  );
}

function PillarCard({ number, title, description }: { number: string; title: string; description: string }) {
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

function ChallengeItem({ text }: { text: string }) {
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
      <span dangerouslySetInnerHTML={{ __html: text }} />
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
