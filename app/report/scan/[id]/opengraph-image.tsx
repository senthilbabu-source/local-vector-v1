// ---------------------------------------------------------------------------
// Dynamic OG Image for /report/scan/[id] — Sprint A
//
// Generates a 1200x630 social card showing the business name + scan status.
// ---------------------------------------------------------------------------

import { ImageResponse } from 'next/og';
import { getPublicScanReport } from '@/lib/report/public-report';

export const runtime = 'edge';
export const alt = 'AI Audit Result — LocalVector.ai';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getPublicScanReport(id);

  const businessName = report?.businessName ?? 'Unknown Business';
  const status = report?.scanStatus ?? 'not_found';

  const statusText = status === 'fail'
    ? 'AI Hallucination Detected'
    : status === 'pass'
      ? 'No Hallucinations Found'
      : 'Invisible to AI Search';

  const statusColor = status === 'fail'
    ? '#EF4444'
    : status === 'pass'
      ? '#00F5A0'
      : '#94A3B8';

  const statusIcon = status === 'fail' ? '!' : status === 'pass' ? '\u2713' : '?';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #050A15 0%, #0A1628 50%, #050A15 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top label */}
        <div
          style={{
            display: 'flex',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: statusColor,
            marginBottom: 32,
          }}
        >
          AI AUDIT RESULT
        </div>

        {/* Status icon circle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: `4px solid ${statusColor}`,
            background: 'rgba(255,255,255,0.03)',
            marginBottom: 24,
            fontSize: 52,
            fontWeight: 800,
            color: statusColor,
          }}
        >
          {statusIcon}
        </div>

        {/* Business name */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: '#F1F5F9',
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          {businessName}
        </div>

        {/* Status text */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: statusColor,
          }}
        >
          {statusText}
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 16,
            color: '#475569',
          }}
        >
          LocalVector.ai &mdash; Free AI Audit
        </div>
      </div>
    ),
    { ...size },
  );
}
