// ---------------------------------------------------------------------------
// /scan — Public AI Audit Result Dashboard (Sprint 33, restyled Sprint 39)
//
// Reads scan result from URL search params (set by ViralScanner after
// runFreeScan() returns fail / pass / not_found).
//
// Public route — not in PROTECTED_PREFIXES ('/dashboard' only).
// proxy.ts runs but passes through since /scan is not protected.
//
// robots: noindex — individual result pages should not be indexed.
//
// Sprint 39: loads Outfit + JetBrains Mono (design system fonts) so the
// restyled ScanDashboard can use var(--font-outfit) / var(--font-jetbrains-mono).
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import ScanDashboard from './_components/ScanDashboard';
import { parseScanParams } from './_utils/scan-params';

export const metadata: Metadata = {
  title: 'AI Audit Result — LocalVector.ai',
  description: 'Your free AI hallucination scan result from LocalVector.ai.',
  robots: { index: false, follow: false },
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
