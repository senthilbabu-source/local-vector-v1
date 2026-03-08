// ---------------------------------------------------------------------------
// Dynamic OG Image for /report/[token] — Sprint A
//
// Generates a 1200x630 social card showing the business name + AI visibility
// score. Uses Next.js ImageResponse (Satori under the hood).
//
// No external fonts loaded — uses system fonts for reliability.
// ---------------------------------------------------------------------------

import { ImageResponse } from 'next/og';
import { getPublicLocationReport } from '@/lib/report/public-report';

export const runtime = 'edge';
export const alt = 'AI Visibility Report — LocalVector.ai';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getPublicLocationReport(token);

  const businessName = report?.businessName ?? 'Unknown Business';
  const score = report?.visibilityScore !== null && report?.visibilityScore !== undefined
    ? Math.round(report.visibilityScore)
    : null;
  const location = report
    ? [report.city, report.state].filter(Boolean).join(', ')
    : '';

  const scoreColor = score === null
    ? '#475569'
    : score >= 80 ? '#00F5A0' : score >= 50 ? '#FFB800' : '#EF4444';

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
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: '#00F5A0',
          }}
        >
          AI VISIBILITY REPORT
        </div>

        {/* Business name */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: '#F1F5F9',
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          {businessName}
        </div>

        {/* Location */}
        {location && (
          <div
            style={{
              fontSize: 18,
              color: '#94A3B8',
              marginBottom: 32,
            }}
          >
            {location}
          </div>
        )}

        {/* Score circle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 160,
            height: 160,
            borderRadius: '50%',
            border: `4px solid ${scoreColor}`,
            background: 'rgba(255,255,255,0.03)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: scoreColor,
            }}
          >
            {score !== null ? score : '--'}
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            color: '#94A3B8',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}
        >
          {score !== null ? 'AI Visibility Score' : 'Score Pending'}
        </div>

        {/* Footer branding */}
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
          LocalVector.ai
        </div>
      </div>
    ),
    { ...size },
  );
}
