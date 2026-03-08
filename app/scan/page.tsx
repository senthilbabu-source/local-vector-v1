// ---------------------------------------------------------------------------
// /scan — Public AI Audit Result Dashboard (Sprint 33, restyled Sprint 39)
//
// Reads scan result from URL search params (set by ViralScanner after
// runFreeScan() returns fail / pass / not_found).
//
// Public route — not in PROTECTED_PREFIXES ('/dashboard' only).
// proxy.ts runs but passes through since /scan is not protected.
//
// Sprint A: removed noindex — /scan is the top-of-funnel entry point and
// should be indexed. Individual result URLs are transient (query-string params)
// so search engines won't over-index variants.
//
// Sprint 39: loads Outfit + JetBrains Mono (design system fonts) so the
// restyled ScanDashboard can use var(--font-outfit) / var(--font-jetbrains-mono).
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import ScanDashboard from './_components/ScanDashboard';
import { parseScanParams } from './_utils/scan-params';

export const metadata: Metadata = {
  title: 'Free AI Audit — Is AI Telling the Truth About Your Business? | LocalVector.ai',
  description:
    'Get a free AI visibility audit for your restaurant. See what ChatGPT, Perplexity, and Google say about your business — and whether they\'re getting it right.',
  openGraph: {
    title: 'Free AI Audit — LocalVector.ai',
    description:
      'Find out what AI models say about your business. Free, instant, real results.',
    siteName: 'LocalVector.ai',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Audit — LocalVector.ai',
    description:
      'Find out what AI models say about your business. Free, instant, real results.',
  },
};

export default async function ScanPage({
  searchParams,
}: {
  // Next.js 16: searchParams is a Promise (async Server Component)
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const result = parseScanParams(params);

  return (
    <main
      className="min-h-screen text-slate-300"
      style={{ backgroundColor: '#050A15' }}
    >
      <ScanDashboard result={result} />
    </main>
  );
}
