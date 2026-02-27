// ---------------------------------------------------------------------------
// emails/weekly-digest.tsx — Weekly AI Snapshot Email Template (Sprint 78)
//
// React Email component for the comprehensive weekly digest. Renders all
// DigestPayload sections: Health Score with delta, SOV trend, issues (new
// hallucinations), wins, opportunities with CTAs, bot summary, and footer.
//
// Style: dark theme matching existing WeeklyDigest.tsx (Sprint 59C).
// Uses inline style objects per React Email conventions — no CSS files.
//
// Preview locally: npx email dev (from project root)
// ---------------------------------------------------------------------------

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Heading,
  Preview,
} from '@react-email/components';
import type { DigestPayload } from '@/lib/services/weekly-digest.service';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeeklyDigestEmailProps {
  payload: DigestPayload;
}

// ---------------------------------------------------------------------------
// Default props for preview
// ---------------------------------------------------------------------------

const defaultPayload: DigestPayload = {
  recipientEmail: 'dev@localvector.ai',
  recipientName: 'Aruna',
  businessName: 'Charcoal N Chill',
  subject: 'AI Health: 67 (+3) — Charcoal N Chill Weekly',
  healthScore: { current: 67, delta: 3, trend: 'up' },
  sov: { currentPercent: 19, delta: 2, trend: 'up' },
  issues: [
    {
      emoji: '🟠',
      text: 'GPT-4o claims: "Charcoal N Chill closes at 10pm"',
      cta: { label: 'Fix This →', href: 'https://app.localvector.ai/dashboard' },
    },
  ],
  wins: [
    { emoji: '✅', text: '1 hallucination resolved this week' },
    {
      emoji: '🟢',
      text: 'Perplexity now mentions you for "hookah near Alpharetta" — first time!',
    },
    { emoji: '📈', text: 'AI Health Score improved by 3 points' },
  ],
  opportunities: [
    {
      emoji: '💡',
      text: 'Add FAQ Schema — est. +8 pts',
      cta: {
        label: 'Take Action →',
        href: 'https://app.localvector.ai/dashboard/page-audits',
      },
    },
    {
      emoji: '🔍',
      text: "3 AI engines can't see your content",
      cta: {
        label: 'View Blind Spots →',
        href: 'https://app.localvector.ai/dashboard/crawler-analytics',
      },
    },
  ],
  botSummary: '🤖 12 AI bot visits this week',
  dashboardUrl: 'https://app.localvector.ai/dashboard',
  unsubscribeUrl: 'https://app.localvector.ai/dashboard/settings',
};

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export default function WeeklyDigestEmail({
  payload = defaultPayload,
}: WeeklyDigestEmailProps) {
  const trendColor =
    payload.healthScore.trend === 'up'
      ? '#16a34a'
      : payload.healthScore.trend === 'down'
        ? '#dc2626'
        : '#64748B';

  const sovTrendColor =
    payload.sov.trend === 'up'
      ? '#16a34a'
      : payload.sov.trend === 'down'
        ? '#dc2626'
        : '#64748B';

  return (
    <Html>
      <Head />
      <Preview>{payload.subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Your AI Visibility This Week</Heading>
            <Text style={subtitle}>{payload.businessName}</Text>
          </Section>

          {/* AI Health Score */}
          <Section style={scoreSection}>
            <Text style={scoreLabel}>AI Health Score</Text>
            {payload.healthScore.current !== null ? (
              <Text style={scoreValue}>
                {payload.healthScore.current}
                {payload.healthScore.delta !== null && (
                  <span style={{ ...deltaSpan, color: trendColor }}>
                    {' '}
                    ({payload.healthScore.delta >= 0 ? '+' : ''}
                    {payload.healthScore.delta})
                  </span>
                )}
              </Text>
            ) : (
              <Text style={scoreValue}>Not yet available</Text>
            )}
          </Section>

          {/* SOV */}
          {payload.sov.currentPercent !== null && (
            <Section style={metricRow}>
              <Text style={metricLabel}>
                Share of Voice: {payload.sov.currentPercent.toFixed(0)}%
                {payload.sov.delta !== null && (
                  <span style={{ ...deltaSpan, color: sovTrendColor }}>
                    {' '}
                    ({payload.sov.delta >= 0 ? '+' : ''}
                    {payload.sov.delta.toFixed(1)}pp)
                  </span>
                )}
              </Text>
            </Section>
          )}

          <Hr style={divider} />

          {/* Issues */}
          {payload.issues.length > 0 && (
            <Section>
              <Heading as="h2" style={sectionHeading}>
                New Issues
              </Heading>
              {payload.issues.map((issue, i) => (
                <Section key={i} style={itemRow}>
                  <Text style={itemText}>
                    {issue.emoji} {issue.text}
                  </Text>
                  <Link href={issue.cta.href} style={ctaLink}>
                    {issue.cta.label}
                  </Link>
                </Section>
              ))}
            </Section>
          )}

          {/* Wins */}
          {payload.wins.length > 0 && (
            <Section>
              <Heading as="h2" style={sectionHeading}>
                Wins This Week
              </Heading>
              {payload.wins.map((win, i) => (
                <Text key={i} style={itemText}>
                  {win.emoji} {win.text}
                </Text>
              ))}
            </Section>
          )}

          {/* Opportunities */}
          {payload.opportunities.length > 0 && (
            <Section>
              <Heading as="h2" style={sectionHeading}>
                Opportunities
              </Heading>
              {payload.opportunities.map((opp, i) => (
                <Section key={i} style={itemRow}>
                  <Text style={itemText}>
                    {opp.emoji} {opp.text}
                  </Text>
                  <Link href={opp.cta.href} style={ctaLink}>
                    {opp.cta.label}
                  </Link>
                </Section>
              ))}
            </Section>
          )}

          {/* Bot Summary */}
          {payload.botSummary && <Text style={botLine}>{payload.botSummary}</Text>}

          <Hr style={divider} />

          {/* Dashboard CTA */}
          <Section style={ctaSection}>
            <Link href={payload.dashboardUrl} style={primaryCta}>
              View Full Dashboard →
            </Link>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              LocalVector — AI Visibility for Local Businesses
            </Text>
            <Link href={payload.unsubscribeUrl} style={unsubLink}>
              Manage email preferences
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles (inline for email client compatibility)
// Follows existing dark theme from emails/WeeklyDigest.tsx
// ---------------------------------------------------------------------------

const main = {
  backgroundColor: '#050A15',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 20px',
};

const header = {
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const h1 = {
  color: '#6366f1',
  fontSize: '22px',
  fontWeight: '700' as const,
  margin: '0 0 8px',
};

const subtitle = {
  color: '#94A3B8',
  fontSize: '14px',
  margin: '0',
};

const scoreSection = {
  textAlign: 'center' as const,
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '24px',
  margin: '0 0 16px',
};

const scoreLabel = {
  color: '#64748B',
  fontSize: '14px',
  margin: '0 0 8px',
};

const scoreValue = {
  color: '#F1F5F9',
  fontSize: '48px',
  fontWeight: '700' as const,
  margin: '0',
  lineHeight: '1.2',
};

const deltaSpan = {
  fontSize: '18px',
  fontWeight: '600' as const,
};

const metricRow = {
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '16px 24px',
  margin: '0 0 16px',
};

const metricLabel = {
  color: '#F1F5F9',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0',
};

const divider = {
  borderColor: 'rgba(255,255,255,0.05)',
  margin: '24px 0',
};

const sectionHeading = {
  color: '#6366f1',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 12px',
};

const itemRow = {
  backgroundColor: '#0A1628',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '0 0 8px',
};

const itemText = {
  color: '#E2E8F0',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 4px',
};

const ctaLink = {
  color: '#6366f1',
  fontSize: '13px',
  fontWeight: '600' as const,
  textDecoration: 'none',
};

const botLine = {
  color: '#94A3B8',
  fontSize: '14px',
  margin: '16px 0 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const primaryCta = {
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
  textAlign: 'center' as const,
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '0 0 4px',
};

const unsubLink = {
  color: '#6b7280',
  fontSize: '12px',
  textDecoration: 'underline',
};
