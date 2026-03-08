// ---------------------------------------------------------------------------
// /report/scan/[id] — Public Scan Lead Report (Sprint A)
//
// Renders a shareable version of a free scan result, identified by
// scan_leads.id UUID. No auth — the UUID IS the auth.
//
// This replaces the giant query-string URL (/scan?status=fail&biz=...) with
// a stable, shareable link that renders clean OG cards on social media.
//
// robots: index enabled — each report is unique content.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicScanReport } from '@/lib/report/public-report';
import { ScanReportCard } from '@/app/report/_components/PublicReportCard';

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await getPublicScanReport(id);

  if (!report) {
    return { title: 'Scan Report Not Found — LocalVector.ai' };
  }

  const statusText = report.scanStatus === 'fail'
    ? 'AI Hallucination Detected'
    : report.scanStatus === 'pass'
      ? 'No Hallucinations Found'
      : 'Invisible to AI Search';

  return {
    title: `${report.businessName} — ${statusText} | LocalVector.ai`,
    description: `AI Audit Result for ${report.businessName}: ${statusText}. Get your free AI audit at LocalVector.ai.`,
    openGraph: {
      title: `${report.businessName} — ${statusText}`,
      description: `AI Audit Result: ${statusText}. Is AI telling the truth about your business?`,
      siteName: 'LocalVector.ai',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${report.businessName} — ${statusText}`,
      description: `AI Audit Result: ${statusText}. Get your free AI audit.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ScanReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getPublicScanReport(id);

  if (!report) notFound();

  return (
    <main
      className="min-h-screen text-slate-300"
      style={{ backgroundColor: '#050A15', padding: '80px 24px 64px' }}
    >
      {/* Nav strip */}
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

      <ScanReportCard report={report} />
    </main>
  );
}
