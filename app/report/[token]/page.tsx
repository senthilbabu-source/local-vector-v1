// ---------------------------------------------------------------------------
// /report/[token] — Public AI Visibility Report (Sprint A)
//
// Renders a read-only branded report for a location identified by its
// public_share_token UUID. No auth required — the UUID IS the auth.
//
// Flow: customer shares their report URL → prospect sees real scores →
// "Get your free AI audit" CTA → /scan → viral loop.
//
// robots: index enabled — these are unique, shareable pages worth indexing.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicLocationReport } from '@/lib/report/public-report';
import { LocationReportCard } from '../_components/PublicReportCard';

// ---------------------------------------------------------------------------
// Dynamic metadata — uses the business name + score for OG
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const report = await getPublicLocationReport(token);

  if (!report) {
    return { title: 'Report Not Found — LocalVector.ai' };
  }

  const score = report.visibilityScore !== null
    ? `AI Visibility Score: ${Math.round(report.visibilityScore)}/100`
    : 'AI Visibility Report';

  return {
    title: `${report.businessName} — ${score} | LocalVector.ai`,
    description: `See how AI models describe ${report.businessName}. ${score}. Get your free AI audit at LocalVector.ai.`,
    openGraph: {
      title: `${report.businessName} — ${score}`,
      description: `See how AI models describe ${report.businessName}. Get your free AI audit.`,
      siteName: 'LocalVector.ai',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${report.businessName} — ${score}`,
      description: `See how AI models describe ${report.businessName}. Get your free AI audit.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getPublicLocationReport(token);

  if (!report) notFound();

  return (
    <main
      className="min-h-screen text-slate-300"
      style={{ backgroundColor: '#050A15', padding: '80px 24px 64px' }}
    >
      {/* Nav strip — same pattern as ScanDashboard */}
      <nav
        className="fixed top-0 left-0 right-0 z-20"
        style={{
          height: 64,
          background: 'rgba(5,10,21,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <a
          href="/"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#F1F5F9',
            textDecoration: 'none',
            fontFamily: 'var(--font-outfit), sans-serif',
          }}
        >
          LocalVector.ai
        </a>
        <a
          href="/"
          className="lv-btn-outline"
          style={{ padding: '8px 20px', fontSize: 13 }}
        >
          Get Your Free Audit
        </a>
      </nav>

      <LocationReportCard report={report} />
    </main>
  );
}
