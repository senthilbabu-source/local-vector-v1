// ---------------------------------------------------------------------------
// emails/WeeklyDigest.tsx — Weekly Digest Email Template
//
// React Email component for the unified weekly digest (Killer Feature #7).
// Replaces the raw HTML strings in lib/email.ts sendSOVReport().
//
// This is a scaffold — the full template will be built when Feature #7
// development begins. For now it demonstrates the pattern and verifies
// the @react-email/components package works.
//
// Preview locally: npx email dev (from project root)
// Resend integration: pass as `react:` prop instead of `html:` in send().
// ---------------------------------------------------------------------------

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from '@react-email/components';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WeeklyDigestProps {
  businessName: string;
  shareOfVoice: number;
  queriesRun: number;
  queriesCited: number;
  firstMoverCount: number;
  dashboardUrl: string;
  sovDelta?: number | null;
  topCompetitor?: string | null;
  citationRate?: number | null;
}

// ---------------------------------------------------------------------------
// Default props for preview
// ---------------------------------------------------------------------------

const defaultProps: WeeklyDigestProps = {
  businessName: 'Charcoal N Chill',
  shareOfVoice: 33,
  queriesRun: 12,
  queriesCited: 4,
  firstMoverCount: 2,
  dashboardUrl: 'https://app.localvector.ai/dashboard',
  sovDelta: 5,
  topCompetitor: 'Cloud 9 Lounge',
  citationRate: 42,
};

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export default function WeeklyDigest({
  businessName = defaultProps.businessName,
  shareOfVoice = defaultProps.shareOfVoice,
  queriesRun = defaultProps.queriesRun,
  queriesCited = defaultProps.queriesCited,
  firstMoverCount = defaultProps.firstMoverCount,
  dashboardUrl = defaultProps.dashboardUrl,
  sovDelta = defaultProps.sovDelta,
  topCompetitor = defaultProps.topCompetitor,
  citationRate = defaultProps.citationRate,
}: WeeklyDigestProps) {
  const sovColor =
    shareOfVoice >= 50 ? '#16a34a' : shareOfVoice >= 20 ? '#f59e0b' : '#dc2626';

  const deltaColor = sovDelta != null && sovDelta > 0 ? '#16a34a' : '#dc2626';
  const deltaArrow = sovDelta != null && sovDelta > 0 ? '\u2191' : '\u2193';
  const deltaAbs = sovDelta != null ? Math.abs(Math.round(sovDelta * 100)) : null;

  return (
    <Html>
      <Head />
      <Preview>
        {`Your AI Visibility Report — ${businessName}: ${shareOfVoice}% Share of Voice`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Text style={heading}>Weekly AI Visibility Report</Text>
          <Text style={subheading}>
            Here&apos;s how <strong>{businessName}</strong> performed in AI search this week:
          </Text>

          {/* SOV Score */}
          <Section style={scoreSection}>
            <Text style={{ ...scoreNumber, color: sovColor }}>
              {shareOfVoice}%
            </Text>
            <Text style={scoreLabel}>Share of Voice</Text>
            {sovDelta != null && deltaAbs != null && (
              <Text style={{ ...deltaText, color: deltaColor }}>
                {deltaArrow} {deltaAbs}% vs last week
              </Text>
            )}
          </Section>

          {/* Stats Row */}
          <Section style={statsRow}>
            <Text style={statItem}>
              <strong>{queriesRun}</strong>
              {'\n'}Queries Run
            </Text>
            <Text style={{ ...statItem, color: '#16a34a' }}>
              <strong>{queriesCited}</strong>
              {'\n'}Times Cited
            </Text>
            {citationRate != null && (
              <Text style={statItem}>
                <strong>{citationRate}%</strong>
                {'\n'}Citation Rate
              </Text>
            )}
          </Section>

          {/* Top Competitor */}
          {topCompetitor && (
            <Section style={competitorBox}>
              <Text style={competitorText}>
                Top competitor in AI results: <strong>{topCompetitor}</strong>
              </Text>
            </Section>
          )}

          {/* First Mover Alert */}
          {firstMoverCount > 0 && (
            <Section style={firstMoverBox}>
              <Text style={firstMoverText}>
                {'\u{1F3C6}'} <strong>{firstMoverCount} First Mover Opportunit{firstMoverCount === 1 ? 'y' : 'ies'}</strong>
              </Text>
              <Text style={firstMoverSub}>
                AI isn&apos;t recommending anyone for {firstMoverCount === 1 ? 'this query' : 'these queries'} yet. Be first.
              </Text>
            </Section>
          )}

          <Hr style={divider} />

          {/* CTA */}
          <Button href={dashboardUrl} style={ctaButton}>
            View Full Report →
          </Button>

          {/* Footer */}
          <Text style={footer}>
            This report is generated weekly from LocalVector&apos;s SOV Engine.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles (inline for email client compatibility)
// ---------------------------------------------------------------------------

const main = {
  backgroundColor: '#050A15',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 20px',
};

const heading = {
  color: '#6366f1',
  fontSize: '22px',
  fontWeight: '700' as const,
  margin: '0 0 8px',
};

const subheading = {
  color: '#94A3B8',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 24px',
};

const scoreSection = {
  textAlign: 'center' as const,
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '24px',
  margin: '0 0 16px',
};

const scoreNumber = {
  fontSize: '48px',
  fontWeight: '700' as const,
  margin: '0',
  lineHeight: '1',
};

const scoreLabel = {
  color: '#64748B',
  fontSize: '14px',
  margin: '4px 0 0',
};

const statsRow = {
  display: 'flex' as const,
  justifyContent: 'space-around' as const,
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '16px',
  margin: '0 0 16px',
};

const statItem = {
  textAlign: 'center' as const,
  color: '#F1F5F9',
  fontSize: '14px',
  margin: '0',
  whiteSpace: 'pre-line' as const,
};

const deltaText = {
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '8px 0 0',
};

const competitorBox = {
  backgroundColor: '#0A1628',
  borderLeft: '4px solid #6366f1',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '0 0 16px',
};

const competitorText = {
  color: '#94A3B8',
  fontSize: '13px',
  margin: '0',
};

const firstMoverBox = {
  backgroundColor: 'rgba(245, 158, 11, 0.08)',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '0 0 16px',
};

const firstMoverText = {
  color: '#F1F5F9',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0',
};

const firstMoverSub = {
  color: '#92400e',
  fontSize: '13px',
  margin: '4px 0 0',
};

const divider = {
  borderColor: 'rgba(255,255,255,0.05)',
  margin: '24px 0',
};

const ctaButton = {
  display: 'inline-block' as const,
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '600' as const,
  fontSize: '14px',
};

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  marginTop: '24px',
};
