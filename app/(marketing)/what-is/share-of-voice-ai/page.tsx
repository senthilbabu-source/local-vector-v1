// ---------------------------------------------------------------------------
// "What is AI Share of Voice?" — AEO Content Page (uncontested query cluster)
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is AI Share of Voice? How Often Does ChatGPT Recommend Your Business? | LocalVector.ai',
  description:
    'AI Share of Voice measures how often your business appears in AI-generated recommendations across ChatGPT, Perplexity, Gemini, and Copilot. Here\'s how to measure it and improve it.',
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is AI Share of Voice?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AI Share of Voice (AI SOV) is the percentage of relevant AI-generated recommendations in which your business appears. When a customer asks ChatGPT "best dentist near me" or "top-rated hair salon downtown," there are typically 3–5 businesses mentioned. If your business appears in 2 of the 10 queries tracked, your AI SOV is 20%.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is a good AI Share of Voice score?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'For a competitive local business category in a mid-size city: 25%+ is a strong presence (appearing in top-4 recommendations consistently), 10–25% is building presence with gaps remaining, and under 10% means largely invisible to AI-assisted discovery.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I track my AI visibility percentage?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'LocalVector.ai runs 20 standardized queries relevant to your business category and location every week, tracking which businesses appear in AI responses. Your SOV percentage is calculated from these queries across ChatGPT, Perplexity, and Gemini.',
      },
    },
  ],
};

export default function ShareOfVoicePage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="AI SOV EXPLAINED"
        title={<>What is AI Share of Voice?<br /><span style={{ fontSize: '0.65em', fontWeight: 700, color: 'var(--m-text-secondary)' }}>(And How to Measure Yours)</span></>}
        subtitle="The percentage of relevant AI recommendations where your business appears."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>AI Share of Voice (AI SOV)</strong> is the percentage of relevant AI-generated recommendations in which your business appears. When a customer asks ChatGPT &ldquo;best dentist near me&rdquo; or &ldquo;emergency plumber in Austin,&rdquo; there are typically 3&ndash;5 businesses mentioned. If your business appears in 2 of the 10 queries LocalVector tracks for your category and location, your AI SOV is 20%.
          </p>
        </div>
      </section>

      {/* Different from Traditional */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>A NEW METRIC</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            Why AI SOV is completely different from traditional Share of Voice
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            Traditional SOV in marketing measures ad spend, media coverage, or search rankings. AI SOV measures something more direct: how often an AI engine names your specific business when a customer asks a relevant question.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            A business with excellent traditional SEO and zero AI SOV is invisible to the growing segment of customers who ask ChatGPT first and visit Google second &mdash; or never.
          </p>
        </div>
      </section>

      {/* What Good Looks Like */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal">
          <SectionLabel>BENCHMARKS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            What good looks like
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 600 }}>
          <p style={{ fontSize: 15, color: 'var(--m-text-secondary)', marginBottom: 20 }}>
            For a competitive local business category in a mid-size city:
          </p>

          <SOVTier
            range="25%+"
            label="Strong presence"
            description="Appearing in top-4 recommendations consistently"
            color="var(--m-green)"
            bgColor="var(--m-green-light)"
          />
          <SOVTier
            range="10 – 25%"
            label="Building presence"
            description="Gaps remain — some queries missing you"
            color="var(--m-amber)"
            bgColor="var(--m-amber-light)"
          />
          <SOVTier
            range="Under 10%"
            label="Largely invisible"
            description="AI-assisted discovery is not finding your business"
            color="#DC2626"
            bgColor="#FEF2F2"
          />
        </div>
      </section>

      {/* Mock SOV Dashboard */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            LocalVector tracks your SOV across all 5 AI models
          </h2>
        </div>

        <div className="m-card m-reveal" style={{ maxWidth: 600, borderRadius: 12 }}>
          <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-text-muted)', marginBottom: 16 }}>
            SHARE OF VOICE — THIS WEEK
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
            <span className="m-display" style={{ fontSize: 48, color: 'var(--m-green)' }}>32%</span>
            <span className="m-mono" style={{ fontSize: 14, color: 'var(--m-green)', fontWeight: 600 }}>{'\u25B2'} +8% from last week</span>
          </div>

          <SOVModelRow model="ChatGPT" pct={40} />
          <SOVModelRow model="Perplexity" pct={35} />
          <SOVModelRow model="Gemini" pct={25} />
          <SOVModelRow model="Claude" pct={30} />
          <SOVModelRow model="Copilot" pct={20} last />

          <p style={{ fontSize: 13, color: 'var(--m-text-muted)', marginTop: 16, fontStyle: 'italic' }}>
            Based on 20 standardized queries for your category and location
          </p>
        </div>
      </section>

      {/* First Mover */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel>UNCONTESTED QUERIES</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            First Mover Opportunities
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            LocalVector&apos;s SOV engine doesn&apos;t just measure where you stand &mdash; it identifies queries where <em>no</em> local business is cited. These are uncontested opportunities. Being the first to build content targeting an unowned query captures that AI recommendation before a competitor does.
          </p>
        </div>

        <div className="m-card m-reveal" style={{ maxWidth: 600, borderRadius: 12, borderLeft: '4px solid var(--m-green)' }}>
          <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-green)', marginBottom: 16 }}>
            FIRST MOVER OPPORTUNITIES — THIS WEEK
          </p>
          <FirstMoverRow query='"emergency dentist open Saturday near me"' />
          <FirstMoverRow query='"best med spa for Botox downtown Austin"' />
          <FirstMoverRow query='"24-hour HVAC repair service in Dallas"' last />
        </div>

        <div className="m-reveal" style={{ maxWidth: 760, marginTop: 32 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            These alerts go out in your weekly email before a competitor claims the same opportunity.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            <RelatedLink href="/what-is/aeo">What is AEO?</RelatedLink>
            <RelatedLink href="/what-is/geo">What is GEO?</RelatedLink>
            <RelatedLink href="/what-is/agent-seo">What is Agent SEO?</RelatedLink>
            <RelatedLink href="/glossary#sov-gap">SOV Gap</RelatedLink>
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
            Check your AI Share of Voice
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            See how often AI recommends your business. Free scan. 8 seconds.
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

function SOVTier({ range, label, description, color, bgColor }: {
  range: string; label: string; description: string; color: string; bgColor: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 20px',
        borderRadius: 10,
        background: bgColor,
        marginBottom: 12,
      }}
    >
      <span className="m-mono" style={{ fontSize: 16, fontWeight: 700, color, minWidth: 80 }}>
        {range}
      </span>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--m-text-primary)', marginBottom: 2 }}>
          {label}
        </p>
        <p style={{ fontSize: 14, color: 'var(--m-text-secondary)', margin: 0 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function SOVModelRow({ model, pct, last = false }: { model: string; pct: number; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 0',
        borderBottom: last ? 'none' : '1px solid var(--m-border-base)',
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--m-text-secondary)', minWidth: 90 }}>{model}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--m-border-base)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'var(--m-green)' }} />
      </div>
      <span className="m-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--m-green)', minWidth: 36, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

function FirstMoverRow({ query, last = false }: { query: string; last?: boolean }) {
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
      <span style={{ fontSize: 14, color: 'var(--m-text-primary)', fontStyle: 'italic' }}>{query}</span>
      <span className="m-mono" style={{ fontSize: 12, color: 'var(--m-green)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        No owner yet
      </span>
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
