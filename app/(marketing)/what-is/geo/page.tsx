// ---------------------------------------------------------------------------
// "What is GEO?" — AEO Content Page
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'What is Generative Engine Optimization (GEO)? | LocalVector.ai',
  description:
    'GEO (Generative Engine Optimization) is the practice of structuring your digital presence so large language models can accurately parse, cite, and recommend your business.',
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Generative Engine Optimization (GEO)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Generative Engine Optimization (GEO) is the practice of structuring your business\'s digital presence so that large language models (LLMs) can accurately parse, cite, and recommend your business in AI-generated responses.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is GEO different from SEO and AEO?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SEO optimizes for Google search rankings. AEO optimizes for AI-generated answer accuracy. GEO optimizes for AI model comprehension and retrieval infrastructure — llms.txt, JSON-LD, data consistency. In practice AEO and GEO overlap significantly.',
      },
    },
  ],
};

export default function GEOPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <PageHero
        label="GEO EXPLAINED"
        title="What is Generative Engine Optimization (GEO)?"
        subtitle="The technical infrastructure that makes your business understandable to AI models."
      />

      {/* Definition */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 18, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            <strong style={{ color: 'var(--m-text-primary)' }}>Generative Engine Optimization (GEO)</strong> is the practice of structuring your business&apos;s digital presence &mdash; website content, schema markup, AI-readable files, and data consistency &mdash; so that large language models (LLMs) can accurately parse, cite, and recommend your business in AI-generated responses.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            GEO emerged in 2025 as businesses realized that traditional SEO practices were insufficient to influence how AI systems represented them. While SEO focuses on Google&apos;s indexing algorithm, GEO addresses the retrieval and synthesis process that AI models use when generating answers.
          </p>
        </div>
      </section>

      {/* How GEO Works */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>THE MECHANISM</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            How GEO works
          </h2>
        </div>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            AI models generate answers by retrieving relevant information from their training data and, increasingly, from real-time retrieval-augmented generation (RAG) pipelines. GEO optimizes for both:
          </p>
        </div>

        <div className="m-grid2 m-reveal" style={{ maxWidth: 760 }}>
          <div className="m-card" style={{ borderLeft: '4px solid var(--m-navy)', borderRadius: 12 }}>
            <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-navy)', marginBottom: 16 }}>
              TRAINING DATA QUALITY
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--m-text-secondary)', margin: 0 }}>
              Ensuring that the sources AI models learned from &mdash; websites, review platforms, news articles, directories &mdash; contain accurate, consistent information about your business.
            </p>
          </div>
          <div className="m-card" style={{ borderLeft: '4px solid var(--m-green)', borderRadius: 12 }}>
            <p className="m-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--m-green)', marginBottom: 16 }}>
              REAL-TIME RETRIEVAL
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--m-text-secondary)', margin: 0 }}>
              Ensuring that when AI runs a live search to supplement its answer, it finds machine-readable, structured data that it can parse and cite accurately.
            </p>
          </div>
        </div>
      </section>

      {/* GEO Toolkit */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal">
          <SectionLabel>THE TOOLKIT</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 40 }}>
            The GEO toolkit for local businesses
          </h2>
        </div>

        <div className="m-reveal-stagger" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ToolkitItem
            name="llms.txt"
            description="An emerging standard (analogous to robots.txt) that provides AI systems with explicit, structured information about your business: hours, services, pricing, location, attributes, FAQs."
          />
          <ToolkitItem
            name="JSON-LD Schema"
            description="Structured data vocabulary (Schema.org) that marks up your website content in a format AI systems can reliably parse."
          />
          <ToolkitItem
            name="ai-config.json"
            description="Machine-readable business configuration for AI agents and assistants."
          />
          <ToolkitItem
            name="Structured menu data"
            description="Converting PDF menus, service lists, and price sheets into machine-readable format that AI can accurately cite for price, service, and availability queries."
          />
          <ToolkitItem
            name="NAP consistency"
            description="Ensuring your Name, Address, and Phone are identical across all platforms AI might reference."
          />
        </div>
      </section>

      {/* Comparison Table */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal">
          <SectionLabel>THE DIFFERENCES</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 32 }}>
            GEO vs SEO vs AEO
          </h2>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--m-border-base)' }}>
                <th style={thStyle}>Discipline</th>
                <th style={thStyle}>Optimizes For</th>
                <th style={thStyle}>Primary Mechanism</th>
                <th style={thStyle}>Primary Metric</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--m-border-base)' }}>
                <td style={tdStyle}>SEO</td>
                <td style={tdStyle}>Google search rankings</td>
                <td style={tdStyle}>Keywords, backlinks, page speed</td>
                <td style={tdStyle}>SERP position</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--m-border-base)' }}>
                <td style={tdStyle}>AEO</td>
                <td style={tdStyle}>AI answer accuracy</td>
                <td style={tdStyle}>Structured data, factual consistency</td>
                <td style={tdStyle}>Citation accuracy, SOV</td>
              </tr>
              <tr style={{ background: 'var(--m-green-light)' }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--m-green-dark)' }}>GEO</td>
                <td style={tdStyle}>AI model comprehension</td>
                <td style={tdStyle}>llms.txt, JSON-LD, data consistency</td>
                <td style={tdStyle}>AI parsing accuracy, RAG citation</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="m-reveal" style={{ maxWidth: 760, marginTop: 24 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)' }}>
            In practice, AEO and GEO overlap significantly and are often used interchangeably. The distinction is one of emphasis: AEO emphasizes the answer quality and accuracy; GEO emphasizes the technical infrastructure that enables AI to understand your business.
          </p>
        </div>
      </section>

      {/* Urgency */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760 }}>
          <SectionLabel color="#D97706">WHY NOW</SectionLabel>
          <h2 className="m-display" style={{ maxWidth: 700, marginBottom: 24 }}>
            Why GEO is urgent in 2026
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            AI models are updated regularly. A model that accurately represented your business last month may not accurately represent it next month if its training data has drifted or if a competitor has published better-structured data that the model prefers to cite.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 32 }}>
            GEO is not a one-time project &mdash; it&apos;s an ongoing infrastructure maintenance discipline. Just as you wouldn&apos;t update your website once and assume it would rank forever, you can&apos;t publish an llms.txt once and assume AI visibility is permanently secured.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <RelatedLink href="/what-is/aeo">What is AEO?</RelatedLink>
            <RelatedLink href="/what-is/ai-hallucination">What is an AI Hallucination?</RelatedLink>
            <RelatedLink href="/what-is/agent-seo">What is Agent SEO?</RelatedLink>
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
            Run a free GEO audit for your business
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            See exactly how AI models represent you. 8 seconds. No account required.
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
};

function ToolkitItem({ name, description }: { name: string; description: string }) {
  return (
    <div
      className="m-card m-reveal"
      style={{
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <p className="m-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--m-green-dark)', margin: 0 }}>
        {name}
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--m-text-secondary)', margin: 0 }}>
        {description}
      </p>
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
