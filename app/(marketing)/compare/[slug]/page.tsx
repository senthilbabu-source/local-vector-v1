// ---------------------------------------------------------------------------
// /compare/[slug] — Competitor Comparison Pages (Marketing Sprint C)
//
// 4 static comparison pages: localvector-vs-yext, brightlocal, synup, whitespark.
// Frame: "Traditional listing management vs. AI visibility monitoring."
// Server Component. generateStaticParams for static generation.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

// ---------------------------------------------------------------------------
// Competitor data
// ---------------------------------------------------------------------------

interface FeatureRow {
  feature: string;
  localvector: string;
  competitor: string;
}

interface CompetitorData {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  whatTheyDo: string;
  whatTheyMiss: string[];
  features: FeatureRow[];
  pricingNote: string;
  useCases: { title: string; description: string }[];
}

const COMPETITORS: Record<string, CompetitorData> = {
  'localvector-vs-yext': {
    slug: 'localvector-vs-yext',
    name: 'Yext',
    tagline: 'Listing management meets AI visibility',
    description:
      'Yext is an enterprise listing management platform that syncs business data to directories. LocalVector monitors what AI actually says about your business and fixes the errors.',
    whatTheyDo:
      'Yext excels at pushing consistent NAP data (name, address, phone) to 100+ online directories. It\'s the gold standard for listing syndication, especially for enterprise brands with hundreds of locations.',
    whatTheyMiss: [
      'No monitoring of what ChatGPT, Perplexity, or Gemini say about your business',
      'No hallucination detection — AI can still get your hours, menu, or services wrong',
      'No Share of Voice tracking across AI engines',
      'No structured data generation (llms.txt, JSON-LD) for AI readability',
      'Enterprise pricing ($199–$999+/mo) is prohibitive for independent businesses',
    ],
    features: [
      { feature: 'AI hallucination detection', localvector: 'ChatGPT, Perplexity, Gemini, Copilot, Grok, You.com', competitor: 'Not available' },
      { feature: 'Share of Voice (AI)', localvector: '6 AI engines tracked weekly', competitor: 'Not available' },
      { feature: 'Listing syndication', localvector: 'Big 6 platforms (GBP, Yelp, Apple, Bing, TripAdvisor, Facebook)', competitor: '100+ directories' },
      { feature: 'Structured data generation', localvector: 'JSON-LD, llms.txt, ai-config.json auto-generated', competitor: 'Basic schema markup' },
      { feature: 'AI sentiment analysis', localvector: 'Per-engine sentiment tracking', competitor: 'Not available' },
      { feature: 'Menu-to-AI pipeline', localvector: 'PDF → JSON-LD → AI-readable in minutes', competitor: 'Basic menu data fields' },
      { feature: 'Competitor intelligence', localvector: 'AI-specific competitor monitoring', competitor: 'Search ranking comparisons' },
      { feature: 'Starting price', localvector: '$79/mo (Starter)', competitor: '$199+/mo (estimated)' },
      { feature: 'Target market', localvector: 'Independent local businesses + agencies', competitor: 'Enterprise / franchise' },
    ],
    pricingNote:
      'Yext pricing starts around $199/mo for basic plans and can exceed $999/mo for enterprise features. LocalVector starts at $79/mo with AI monitoring included at every tier.',
    useCases: [
      { title: 'Choose Yext if', description: 'You\'re an enterprise with 100+ locations that needs to push NAP data to every directory on earth. Listing volume is your main concern.' },
      { title: 'Choose LocalVector if', description: 'You\'re an independent business or agency that needs to monitor and fix what AI models actually tell customers. AI accuracy is your concern.' },
      { title: 'Use both if', description: 'You want Yext for directory syndication and LocalVector for AI visibility monitoring. They solve different problems and complement each other.' },
    ],
  },
  'localvector-vs-brightlocal': {
    slug: 'localvector-vs-brightlocal',
    name: 'BrightLocal',
    tagline: 'Local SEO tools meet AI visibility monitoring',
    description:
      'BrightLocal provides local SEO audit tools, citation building, and rank tracking. LocalVector monitors what AI engines say about your business — a different problem entirely.',
    whatTheyDo:
      'BrightLocal is a well-established local SEO toolkit. It audits citations, tracks Google search rankings, monitors reviews, and helps agencies report on local search performance.',
    whatTheyMiss: [
      'Focused on Google search rankings, not AI-generated answers',
      'No monitoring of ChatGPT, Perplexity, Gemini, or Copilot outputs',
      'No hallucination detection or correction workflow',
      'No structured data generation for AI engines',
      'Citation tracking is directory-focused, not AI-source-focused',
    ],
    features: [
      { feature: 'AI hallucination detection', localvector: '6 AI engines monitored', competitor: 'Not available' },
      { feature: 'Google rank tracking', localvector: 'Not the focus (AI-first)', competitor: 'Comprehensive SERP tracking' },
      { feature: 'Citation audit', localvector: 'Big 6 NAP consistency', competitor: '1,000+ citation sources' },
      { feature: 'AI Share of Voice', localvector: 'Weekly tracking across all AI models', competitor: 'Not available' },
      { feature: 'Review monitoring', localvector: 'AI-powered review intelligence + response drafts', competitor: 'Multi-platform review aggregation' },
      { feature: 'Structured data', localvector: 'Auto-generated JSON-LD, llms.txt, ai-config.json', competitor: 'Not available' },
      { feature: 'Agency white-label', localvector: 'Custom domain, branded dashboard', competitor: 'White-label reporting' },
      { feature: 'Starting price', localvector: '$79/mo', competitor: '$39/mo' },
      { feature: 'Best for', localvector: 'AI visibility monitoring + correction', competitor: 'Local SEO auditing + rank tracking' },
    ],
    pricingNote:
      'BrightLocal starts lower at $39/mo for basic local SEO tools. LocalVector starts at $79/mo but includes AI monitoring that BrightLocal doesn\'t offer at any tier.',
    useCases: [
      { title: 'Choose BrightLocal if', description: 'Your primary concern is Google search rankings and traditional local SEO citations. You want comprehensive SERP tracking and citation auditing.' },
      { title: 'Choose LocalVector if', description: 'Your concern is what AI models tell customers about your business. You need hallucination detection, AI visibility tracking, and structured data for AI readability.' },
      { title: 'Use both if', description: 'You want BrightLocal for traditional local SEO and LocalVector for the AI visibility layer. SEO and AEO are complementary strategies.' },
    ],
  },
  'localvector-vs-synup': {
    slug: 'localvector-vs-synup',
    name: 'Synup',
    tagline: 'Listing management and reviews vs. AI-first monitoring',
    description:
      'Synup offers listing management, review management, and social media tools for local businesses. LocalVector focuses specifically on AI visibility — what AI engines say about you.',
    whatTheyDo:
      'Synup is a multi-location marketing platform that manages listings, reviews, social posts, and campaigns. It\'s built for agencies and multi-location brands that need a unified local marketing hub.',
    whatTheyMiss: [
      'No monitoring of AI-generated business descriptions or recommendations',
      'No hallucination detection across ChatGPT, Perplexity, or Gemini',
      'No AI Share of Voice tracking',
      'No structured data pipeline for AI engine readability',
      'Social and review features are broad but don\'t address AI accuracy',
    ],
    features: [
      { feature: 'AI hallucination detection', localvector: '6 AI engines', competitor: 'Not available' },
      { feature: 'Listing management', localvector: 'Big 6 with NAP sync', competitor: '60+ directories' },
      { feature: 'Review management', localvector: 'AI-powered response generation', competitor: 'Multi-platform review dashboard' },
      { feature: 'Social media management', localvector: 'Not available', competitor: 'Post scheduling + analytics' },
      { feature: 'AI Share of Voice', localvector: 'Weekly multi-model tracking', competitor: 'Not available' },
      { feature: 'Structured data', localvector: 'JSON-LD, llms.txt auto-generation', competitor: 'Not available' },
      { feature: 'Content generation', localvector: 'AI-optimized content briefs + autopilot', competitor: 'Social post templates' },
      { feature: 'Starting price', localvector: '$79/mo', competitor: '$34.99/mo' },
      { feature: 'Best for', localvector: 'AI visibility + accuracy monitoring', competitor: 'All-in-one local marketing' },
    ],
    pricingNote:
      'Synup starts at $34.99/mo per location for its base tier. LocalVector starts at $79/mo with AI monitoring included. Different tools for different problems.',
    useCases: [
      { title: 'Choose Synup if', description: 'You need an all-in-one local marketing platform: listings, reviews, social, and campaigns in one dashboard.' },
      { title: 'Choose LocalVector if', description: 'Your specific concern is AI accuracy — what ChatGPT, Perplexity, and Gemini tell customers. You need hallucination detection and AI-specific optimization.' },
      { title: 'Use both if', description: 'You want Synup for day-to-day local marketing operations and LocalVector for the AI visibility monitoring layer that Synup doesn\'t cover.' },
    ],
  },
  'localvector-vs-whitespark': {
    slug: 'localvector-vs-whitespark',
    name: 'Whitespark',
    tagline: 'Citation building experts vs. AI accuracy platform',
    description:
      'Whitespark is known for citation building, local rank tracking, and review management. LocalVector is built specifically for the AI visibility era — monitoring what AI says, not where you rank.',
    whatTheyDo:
      'Whitespark is a respected local SEO tool, especially known for its Local Citation Finder and manual citation building services. It helps businesses get listed accurately across directories and tracks Google local pack rankings.',
    whatTheyMiss: [
      'Directory citations don\'t control what AI says about your business',
      'No monitoring of ChatGPT, Perplexity, Gemini, or Copilot responses',
      'No hallucination detection or automated correction workflows',
      'No AI-specific structured data generation',
      'Citation building is backward-looking — AI visibility is the new frontier',
    ],
    features: [
      { feature: 'AI hallucination detection', localvector: '6 AI engines', competitor: 'Not available' },
      { feature: 'Citation building', localvector: 'Big 6 automated sync', competitor: 'Manual citation building services' },
      { feature: 'Local rank tracking', localvector: 'AI Share of Voice (not SERP)', competitor: 'Google local pack tracking' },
      { feature: 'Review generation', localvector: 'AI response drafts for reviews', competitor: 'Review request campaigns' },
      { feature: 'Structured data', localvector: 'JSON-LD, llms.txt, ai-config.json', competitor: 'Not available' },
      { feature: 'AI sentiment analysis', localvector: 'Per-engine, per-query tracking', competitor: 'Not available' },
      { feature: 'Competitor analysis', localvector: 'AI-specific vulnerability detection', competitor: 'Citation competitor analysis' },
      { feature: 'Starting price', localvector: '$79/mo', competitor: '$39/mo (software) + services' },
      { feature: 'Best for', localvector: 'AI visibility + accuracy monitoring', competitor: 'Citation building + local SEO' },
    ],
    pricingNote:
      'Whitespark software starts at $39/mo. Their manual citation building services are priced separately ($4–$6 per citation). LocalVector starts at $79/mo with full AI monitoring.',
    useCases: [
      { title: 'Choose Whitespark if', description: 'You need manual citation building across niche directories and want to track Google local pack rankings. Traditional local SEO is your primary strategy.' },
      { title: 'Choose LocalVector if', description: 'You need to know what AI models tell customers about your business and fix the errors. AI visibility is your concern, not citation volume.' },
      { title: 'Use both if', description: 'You want Whitespark for comprehensive citation building and LocalVector for AI monitoring. Citations feed AI models — both matter.' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return Object.keys(COMPETITORS).map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = COMPETITORS[slug];
  if (!data) return { title: 'Comparison | LocalVector.ai' };

  return {
    title: `LocalVector vs ${data.name} — AI Visibility Comparison | LocalVector.ai`,
    description: data.description,
    openGraph: {
      title: `LocalVector vs ${data.name} — Which is right for your business?`,
      description: data.description,
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default async function ComparePage({ params }: PageProps) {
  const { slug } = await params;
  const data = COMPETITORS[slug];
  if (!data) notFound();

  return (
    <>
      <MarketingNav />

      <PageHero
        label={`LOCALVECTOR VS ${data.name.toUpperCase()}`}
        title={<>LocalVector vs {data.name}</>}
        subtitle={data.tagline}
      />

      {/* ── Overview ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">OVERVIEW</SectionLabel>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 24 }}>
            {data.description}
          </p>

          <h3 className="m-display" style={{ fontSize: 22, marginBottom: 16 }}>
            What {data.name} does well
          </h3>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--m-text-secondary)', marginBottom: 32 }}>
            {data.whatTheyDo}
          </p>

          <h3 className="m-display" style={{ fontSize: 22, marginBottom: 16 }}>
            What {data.name} doesn&apos;t cover
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 16 }}>
            {data.whatTheyMiss.map((item) => (
              <li key={item} style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--m-text-secondary)', padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: 'var(--m-red)', fontWeight: 700, fontSize: 14, lineHeight: '24px', flexShrink: 0 }}>{'\u2717'}</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Feature Comparison Table ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal-left" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">FEATURE COMPARISON</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', marginBottom: 32 }}>
            Side by side
          </h2>

          <div className="m-card" style={{ borderRadius: 12, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#0B1629', color: '#fff' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>Feature</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--m-green)' }}>LocalVector</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>{data.name}</th>
                </tr>
              </thead>
              <tbody>
                {data.features.map((row, i) => (
                  <tr key={row.feature} style={{ borderBottom: '1px solid var(--m-border-base)', background: i % 2 === 0 ? '#fff' : 'var(--m-bg-secondary)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--m-text-primary)' }}>{row.feature}</td>
                    <td style={{ padding: '14px 20px', color: row.localvector === 'Not available' ? 'var(--m-text-muted)' : 'var(--m-text-secondary)' }}>{row.localvector}</td>
                    <td style={{ padding: '14px 20px', color: row.competitor === 'Not available' ? 'var(--m-text-muted)' : 'var(--m-text-secondary)' }}>{row.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="m-mono" style={{ fontSize: 12, color: 'var(--m-text-muted)', marginTop: 16 }}>
            {data.pricingNote}
          </p>
        </div>
      </section>

      {/* ── When to choose which ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal-right" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">WHEN TO CHOOSE WHICH</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', marginBottom: 32 }}>
            The honest answer
          </h2>

          <div className="m-compare-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {data.useCases.map((uc) => (
              <div key={uc.title} className="m-card m-reveal" style={{ borderRadius: 12, padding: '28px 24px', borderTop: uc.title.includes('LocalVector') ? '4px solid var(--m-green)' : uc.title.includes('both') ? '4px solid var(--m-amber)' : '4px solid var(--m-border-base)' }}>
                <h3 className="m-display" style={{ fontSize: 18, marginBottom: 12 }}>{uc.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--m-text-secondary)', margin: 0 }}>{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Other comparisons ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">MORE COMPARISONS</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {Object.values(COMPETITORS)
              .filter((c) => c.slug !== slug)
              .map((c) => (
                <a
                  key={c.slug}
                  href={`/compare/${c.slug}`}
                  className="m-btn-secondary"
                  style={{ fontSize: 14, padding: '10px 20px', textDecoration: 'none' }}
                >
                  vs {c.name}
                </a>
              ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          background: 'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
          padding: '80px 24px',
        }}
      >
        <h2 className="m-display" style={{ maxWidth: 700, marginLeft: 'auto', marginRight: 'auto', marginBottom: 20 }}>
          See the difference for yourself.
        </h2>
        <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          Run a free AI audit on any business. 8 seconds. No account needed.
          Then compare what you learn to what any other tool shows you.
        </p>
        <a href="/scan" className="m-btn-primary" style={{ fontSize: 16, padding: '16px 36px', textDecoration: 'none' }}>
          Run Free AI Audit {'\u2192'}
        </a>
      </section>

      <MarketingFooter />

      {/* ── Responsive ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          .m-compare-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </>
  );
}
