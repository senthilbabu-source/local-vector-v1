// Marketing Landing Page — LocalVector.ai
//
// Server Component. Replaces the old redirect('/dashboard') boilerplate.
// Content per Doc 07 §2 (Viral Wedge) and Doc 08 §§1-3 (Landing Page AEO).
// Deep Night theme: bg-midnight-slate, text-slate-300, electric-indigo accent.

import ViralScanner from './_components/ViralScanner';
import { safeJsonLd } from './m/[slug]/page';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RootPage() {
  return (
    <main className="min-h-screen bg-midnight-slate text-slate-300">

      {/* ── JSON-LD: SoftwareApplication schema (Doc 08 §9) ─────────────── */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'LocalVector',
            headline: 'The AI Visibility Platform for Restaurants',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: '29',
              highPrice: '59',
              priceCurrency: 'USD',
              offerCount: '3',
            },
            creator: {
              '@type': 'Organization',
              name: 'LocalVector.ai',
              url: 'https://localvector.ai',
            },
            description:
              'LocalVector.ai helps restaurants detect and fix AI hallucinations — when ChatGPT, ' +
              'Perplexity, or Gemini provide incorrect information like wrong hours, closed status, ' +
              'or missing menu items. Features include automated hallucination auditing, ' +
              'PDF-to-Schema menu digitization, and competitor intercept analysis.',
            featureList: [
              'AI Hallucination Detection',
              'PDF Menu to Schema.org Conversion',
              'Competitor AI Recommendation Intercept',
              'Reality Score Tracking',
              'Google Business Profile Integration',
            ],
          }),
        }}
      />

      {/* ── Top Navigation ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 border-b border-white/5 bg-midnight-slate/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-electric-indigo tracking-tight">
            LocalVector
          </span>
          <div className="flex items-center gap-3">
            <a
              href="/pricing"
              className="text-sm text-slate-400 hover:text-white transition"
            >
              Pricing
            </a>
            <a
              href="/login"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              Sign In
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero Section (Doc 08 §2) ─────────────────────────────────────── */}
      <section className="px-4 pt-20 pb-16">
        <div className="mx-auto max-w-3xl text-center">

          {/* Eyebrow */}
          <span className="inline-block rounded-full bg-alert-crimson/10 border border-alert-crimson/20 px-3 py-1 text-xs font-semibold text-alert-crimson mb-6">
            AI Hallucination Detection &amp; Fix
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            Is ChatGPT Telling Your Customers You Are Closed?
          </h1>

          {/* Subheadline — exact copy from Doc 08 §2 */}
          <p className="mt-5 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Stop AI from sending your customers to your competitors. When ChatGPT,
            Perplexity, or Google Gemini lie about your hours, menu, or location,
            you lose revenue instantly. We detect the lies and fix them.
          </p>

          {/* Viral Scanner embed */}
          <div className="mt-8 mx-auto max-w-md text-left">
            <ViralScanner />
          </div>

          {/* Social proof badge — Doc 08 §2 */}
          <p className="mt-5 text-xs text-slate-500">
            LocalVector&rsquo;s AI Visibility Score:{' '}
            <span className="text-truth-emerald font-semibold">98/100</span>
            {' '}— We practice what we preach.
          </p>
        </div>
      </section>

      {/* ── Tangible Results Section (Doc 08 §3) ─────────────────────────── */}
      <section className="px-4 pb-24">
        <div className="mx-auto max-w-4xl">

          {/* Section headline */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white">
              Don&rsquo;t Buy &ldquo;SEO.&rdquo; Buy Revenue Protection.
            </h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Restaurant owners don&rsquo;t care about rankings. They care about tables.
            </p>
          </div>

          {/* Case Study — Charcoal N Chill (exact copy from Doc 08 §3) */}
          <div className="rounded-2xl bg-surface-dark border border-white/5 p-6 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <span className="rounded-full bg-electric-indigo/10 border border-electric-indigo/20 px-3 py-1 text-xs font-semibold text-electric-indigo">
                Case Study
              </span>
              <span className="text-sm font-semibold text-white">Charcoal N Chill BBQ</span>
            </div>

            <div className="space-y-3">
              <CaseRow
                label="Problem"
                value='Perplexity reported "Closed on Mondays"'
                labelColor="text-alert-crimson"
              />
              <CaseRow
                label="Reality"
                value="Open and serving full dinner"
                labelColor="text-truth-emerald"
              />
              <CaseRow
                label="Cost"
                value="~5 tables lost every Monday × $80/table = $1,600/month"
                labelColor="text-amber-400"
              />
              <CaseRow
                label="Fix"
                value="Detected in 24 hours. Corrected via Magic Menu."
                labelColor="text-slate-400"
              />
              <CaseRow
                label="Result"
                value="Monday traffic restored."
                labelColor="text-truth-emerald"
              />
            </div>
          </div>

          {/* Metric Cards — Doc 08 §3 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard value="$12,500+" label="Revenue Protected" />
            <MetricCard value="450"      label="Menu Reads by AI" />
            <MetricCard value="3"        label="Competitors Intercepted" />
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 text-center">
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-electric-indigo px-6 py-3 text-sm font-semibold text-white hover:bg-electric-indigo/90 transition"
            >
              Start Protecting Your Revenue
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </a>
            <p className="mt-3 text-xs text-slate-600">No credit card required. Free scan, then decide.</p>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-5xl px-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a href="/privacy" className="text-sm text-slate-600 hover:text-slate-300 transition">Privacy Policy</a>
          <span className="text-slate-700">·</span>
          <a href="/terms" className="text-sm text-slate-600 hover:text-slate-300 transition">Terms of Service</a>
          <span className="text-slate-700">·</span>
          <a href="mailto:hello@localvector.ai" className="text-sm text-slate-600 hover:text-slate-300 transition">
            hello@localvector.ai
          </a>
        </div>
      </footer>

    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (Server-side, co-located for simplicity)
// ---------------------------------------------------------------------------

function CaseRow({
  label,
  value,
  labelColor,
}: {
  label: string;
  value: string;
  labelColor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={['shrink-0 w-16 text-xs font-semibold pt-px', labelColor].join(' ')}>
        {label}
      </span>
      <span className="text-sm text-slate-300 leading-snug">{value}</span>
    </div>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-6 text-center">
      <p className="text-3xl font-bold text-electric-indigo tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
