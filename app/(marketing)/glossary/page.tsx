// ---------------------------------------------------------------------------
// /glossary — AI Visibility Glossary (Marketing Page)
//
// Server Component. Inline styles (no Tailwind). 15 glossary terms with
// deep-link anchors, FAQPage JSON-LD, and bottom CTA.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';

export const metadata: Metadata = {
  title:
    'AI Visibility Glossary — AEO, GEO, Hallucination, Share of Voice & More | LocalVector.ai',
  description:
    'Definitions for 20 key terms in AI visibility, AEO, and local business optimization. Plain-English explanations for local business owners and operators.',
};

// ---------------------------------------------------------------------------
// Glossary term data
// ---------------------------------------------------------------------------

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  link?: { href: string; label: string };
}

const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'ai-hallucination',
    term: 'AI Hallucination',
    definition:
      'When an AI model states incorrect information about a real business as if it were fact. "Your dental clinic is permanently closed" when you\'re open, or "This salon doesn\'t take walk-ins" when you do. Not a malfunction \u2014 a predictable consequence of AI training on imperfect data.',
  },
  {
    id: 'answer-engine-optimization',
    term: 'Answer Engine Optimization (AEO)',
    definition:
      'The practice of structuring your business content so AI assistants accurately represent and recommend you.',
    link: { href: '/what-is/aeo', label: 'Read more \u2192' },
  },
  {
    id: 'generative-engine-optimization',
    term: 'Generative Engine Optimization (GEO)',
    definition:
      'Similar to AEO; emphasizes optimizing for AI engines that generate answers.',
    link: { href: '/what-is/geo', label: 'Read more \u2192' },
  },
  {
    id: 'ai-share-of-voice',
    term: 'AI Share of Voice (AI SOV)',
    definition:
      'The percentage of relevant AI queries in which your business is cited.',
    link: {
      href: '/what-is/share-of-voice-ai',
      label: 'Read more \u2192',
    },
  },
  {
    id: 'reality-score',
    term: 'Reality Score',
    definition:
      "LocalVector's 0\u2013100 composite score for a business's AI health. Combines AI Visibility (40%), Accuracy (40%), and Data Health (20%).",
  },
  {
    id: 'llms-txt',
    term: 'llms.txt',
    definition:
      "A plain-text file at your domain root that tells AI crawlers your business's verified, authoritative information. The AI equivalent of robots.txt. LocalVector generates this automatically.",
  },
  {
    id: 'ai-crawler',
    term: 'AI Crawler',
    definition:
      'An automated bot that reads web content to train or update an AI model. Examples: GPTBot (OpenAI), PerplexityBot, ClaudeBot, Google-Extended, Applebot.',
  },
  {
    id: 'ground-truth',
    term: 'Ground Truth',
    definition:
      "Your business's verified, authoritative data: hours, address, phone, menu or service list, attributes. LocalVector uses Ground Truth to detect AI errors by comparison.",
  },
  {
    id: 'schema-org-json-ld',
    term: 'Schema.org / JSON-LD',
    definition:
      'A standardized vocabulary for structured data that AI crawlers understand. LocalVector generates JSON-LD automatically from your menu, service list, and business profile.',
  },
  {
    id: 'entity',
    term: 'Entity (AI context)',
    definition:
      'The way AI models represent your business as a node in a knowledge graph, rather than just a webpage. Strong entity signals help AI recognize your business as legitimate.',
  },
  {
    id: 'first-mover-alert',
    term: 'First Mover Alert',
    definition:
      "LocalVector's alert for AI queries where no local business is currently cited. An uncontested opportunity to build content and own that query before competitors.",
  },
  {
    id: 'drift',
    term: 'Drift',
    definition:
      'The recurrence of a previously-corrected AI hallucination. When AI models retrain on new data, old errors can resurface. LocalVector monitors for drift automatically.',
  },
  {
    id: 'agent-seo',
    term: 'Agent SEO / AAO',
    definition:
      'The practice of making your business actionable by AI agents (booking appointments, placing orders, checking availability).',
    link: { href: '/what-is/agent-seo', label: 'Read more \u2192' },
  },
  {
    id: 'citation-rate',
    term: 'Citation Rate',
    definition:
      'How frequently a specific platform is cited by an AI engine when answering questions about your business category.',
  },
  {
    id: 'sov-gap',
    term: 'SOV Gap',
    definition:
      'The difference between your current AI Share of Voice and the benchmark for your category (typically 25% for a top-4 position).',
  },
  {
    id: 'google-ai-overview',
    term: 'Google AI Overview',
    definition:
      'An AI-generated summary (powered by Gemini) that appears above traditional Google search results. Synthesizes information from multiple sources to answer queries directly, making accuracy in AI-visible data critical for local businesses.',
    link: { href: '/what-is/ai-overview', label: 'Read more \u2192' },
  },
  {
    id: 'perplexity-pages',
    term: 'Perplexity Pages',
    definition:
      'Curated, AI-generated content pages published by Perplexity AI that aggregate and summarize information about topics, businesses, and categories. When Perplexity creates a Page about your industry, the accuracy of your business data determines how you appear.',
  },
  {
    id: 'siri-readiness-score',
    term: 'Siri Readiness Score',
    definition:
      'A composite score measuring how prepared your business is for Apple Intelligence and Siri-powered search. Evaluates Apple Business Connect enrollment, Applebot crawlability, structured data quality, and cross-platform data consistency.',
    link: { href: '/what-is/siri-readiness', label: 'Read more \u2192' },
  },
  {
    id: 'agent-readiness-score',
    term: 'Agent Readiness Score',
    definition:
      'A score measuring whether AI agents can take action on behalf of customers for your business — booking appointments, placing orders, checking hours, and browsing menus. Higher scores mean AI can do more for your customers without human intervention.',
  },
  {
    id: 'content-hash-distribution',
    term: 'Content Hash Distribution',
    definition:
      'LocalVector\u2019s mechanism for tracking whether updated menu or service data has propagated to AI engines. A SHA-256 hash of your structured data is compared before and after distribution to verify that AI crawlers have ingested the latest version.',
  },
];

// ---------------------------------------------------------------------------
// FAQPage JSON-LD (all 15 terms as Q/A pairs)
// ---------------------------------------------------------------------------

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: GLOSSARY_TERMS.map((t) => ({
    '@type': 'Question',
    name: `What is ${t.term}?`,
    acceptedAnswer: {
      '@type': 'Answer',
      text: t.definition,
    },
  })),
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function GlossaryPage() {
  return (
    <>
      <MarketingNav />

      <PageHero
        label="GLOSSARY"
        title="AI Visibility Glossary"
        subtitle="Plain-English definitions for 20 key terms in AI visibility, AEO, and local business optimization."
      />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Glossary Terms ── */}
      <section
        style={{
          background: 'var(--m-bg-primary)',
          padding: '64px 24px 80px',
        }}
      >
        <div
          style={{
            maxWidth: 800,
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {GLOSSARY_TERMS.map((term) => (
            <div
              key={term.id}
              id={term.id}
              className="m-reveal"
              style={{
                background: 'var(--m-bg-card, #FFFFFF)',
                border: '1px solid var(--m-border-base)',
                borderLeft: '2px solid var(--m-green)',
                borderRadius: 12,
                padding: '24px 28px',
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--m-text-primary)',
                  marginTop: 0,
                  marginBottom: 10,
                  lineHeight: 1.3,
                }}
              >
                {term.term}
              </h2>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: 'var(--m-text-secondary)',
                  margin: 0,
                }}
              >
                {term.definition}
              </p>
              {term.link && (
                <a
                  href={term.link.href}
                  style={{
                    display: 'inline-block',
                    marginTop: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--m-green)',
                    textDecoration: 'none',
                  }}
                >
                  {term.link.label}
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          background:
            'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
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
          See these concepts in action.
        </h2>
        <p
          style={{
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 32,
          }}
        >
          Run a free AI audit on your business and see your Reality Score,
          hallucinations, and share of voice in 8 seconds.
        </p>
        <a
          href="/scan"
          className="m-btn-primary"
          style={{ fontSize: 16, padding: '16px 36px' }}
        >
          Run Free AI Audit {'\u2192'}
        </a>
      </section>

      <MarketingFooter />
    </>
  );
}
