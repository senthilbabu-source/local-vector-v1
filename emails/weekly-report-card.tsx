// ---------------------------------------------------------------------------
// emails/weekly-report-card.tsx — S47: Weekly AI Report Card Email Template
//
// React Email component for the structured weekly report card.
// Uses WeeklyReportCard data from lib/services/weekly-report-card.ts.
// Dark theme consistent with weekly-digest.tsx.
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
import type { WeeklyReportCard } from '@/lib/services/weekly-report-card';
import { getScoreColor, formatScoreDelta } from '@/lib/services/weekly-report-card';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WeeklyReportCardEmailProps {
  card: WeeklyReportCard;
  businessName: string;
  recipientName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

// ---------------------------------------------------------------------------
// Default props for preview
// ---------------------------------------------------------------------------

const defaultProps: WeeklyReportCardEmailProps = {
  card: {
    score: 72,
    scoreDelta: 5,
    topWin: 'Fixed wrong hours on ChatGPT',
    topIssue: 'Perplexity: "Charcoal N Chill closes at 9pm"',
    competitorHighlight: "Joe's BBQ mentioned 12 times",
    nextAction: 'Fix open AI errors on the dashboard',
    errorsFixed: 2,
    newErrors: 1,
    sovPercent: 34,
  },
  businessName: 'Charcoal N Chill',
  recipientName: 'Aruna',
  dashboardUrl: 'https://app.localvector.ai/dashboard',
  unsubscribeUrl: 'https://app.localvector.ai/dashboard/settings',
};

// ---------------------------------------------------------------------------
// Score badge color mapping
// ---------------------------------------------------------------------------

const SCORE_COLORS: Record<string, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#64748b',
};

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export default function WeeklyReportCardEmail({
  card = defaultProps.card,
  businessName = defaultProps.businessName,
  recipientName = defaultProps.recipientName,
  dashboardUrl = defaultProps.dashboardUrl,
  unsubscribeUrl = defaultProps.unsubscribeUrl,
}: WeeklyReportCardEmailProps) {
  const scoreColor = SCORE_COLORS[getScoreColor(card.score)] ?? SCORE_COLORS.gray;
  const deltaText = formatScoreDelta(card.scoreDelta);
  const deltaColor = card.scoreDelta !== null && card.scoreDelta > 0
    ? '#10b981'
    : card.scoreDelta !== null && card.scoreDelta < 0
      ? '#ef4444'
      : '#64748b';

  const subject = card.score !== null
    ? `AI Report: ${card.score} (${deltaText}) — ${businessName}`
    : `AI Report — ${businessName}`;

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Weekly AI Report Card</Heading>
            <Text style={subtitle}>{businessName}</Text>
          </Section>

          {/* Score Hero */}
          <Section style={scoreSection}>
            <Text style={scoreLabel}>AI Health Score</Text>
            <Text style={{ ...scoreValue, color: scoreColor }}>
              {card.score ?? '—'}
            </Text>
            {card.scoreDelta !== null && (
              <Text style={{ ...deltaBadge, color: deltaColor }}>
                {deltaText} this week
              </Text>
            )}
          </Section>

          {/* Key Metrics Row */}
          <Section style={metricsRow}>
            {card.sovPercent !== null && (
              <Text style={metricItem}>AI Mentions: {Math.round(card.sovPercent)}%</Text>
            )}
            {card.errorsFixed > 0 && (
              <Text style={metricItem}>Errors Fixed: {card.errorsFixed}</Text>
            )}
            {card.newErrors > 0 && (
              <Text style={{ ...metricItem, color: '#f59e0b' }}>New Errors: {card.newErrors}</Text>
            )}
          </Section>

          <Hr style={divider} />

          {/* Top Win */}
          {card.topWin && (
            <Section style={cardBlock}>
              <Text style={cardLabel}>Top Win</Text>
              <Text style={cardValue}>{card.topWin}</Text>
            </Section>
          )}

          {/* Top Issue */}
          {card.topIssue && (
            <Section style={{ ...cardBlock, borderColor: 'rgba(245, 158, 11, 0.2)' }}>
              <Text style={{ ...cardLabel, color: '#f59e0b' }}>Top Issue</Text>
              <Text style={cardValue}>{card.topIssue}</Text>
            </Section>
          )}

          {/* Competitor */}
          {card.competitorHighlight && (
            <Section style={cardBlock}>
              <Text style={cardLabel}>Competitor Watch</Text>
              <Text style={cardValue}>{card.competitorHighlight}</Text>
            </Section>
          )}

          {/* Next Action */}
          {card.nextAction && (
            <>
              <Hr style={divider} />
              <Section style={actionSection}>
                <Text style={actionLabel}>Your #1 action this week:</Text>
                <Text style={actionText}>{card.nextAction}</Text>
              </Section>
            </>
          )}

          {/* Dashboard CTA */}
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={primaryCta}>
              View Full Dashboard
            </Link>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Powered by LocalVector.ai
            </Text>
            <Link href={unsubscribeUrl} style={unsubLink}>
              Manage email preferences
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const main = {
  backgroundColor: '#050A15',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '40px 20px',
};

const header = {
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const h1 = {
  color: '#6366f1',
  fontSize: '20px',
  fontWeight: '700' as const,
  margin: '0 0 6px',
};

const subtitle = {
  color: '#94A3B8',
  fontSize: '14px',
  margin: '0',
};

const scoreSection = {
  textAlign: 'center' as const,
  backgroundColor: '#0A1628',
  borderRadius: '12px',
  padding: '28px 24px 20px',
  margin: '0 0 16px',
};

const scoreLabel = {
  color: '#64748B',
  fontSize: '13px',
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const scoreValue = {
  fontSize: '56px',
  fontWeight: '700' as const,
  margin: '0',
  lineHeight: '1.1',
};

const deltaBadge = {
  fontSize: '15px',
  fontWeight: '600' as const,
  margin: '8px 0 0',
};

const metricsRow = {
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '14px 20px',
  margin: '0 0 16px',
};

const metricItem = {
  color: '#E2E8F0',
  fontSize: '14px',
  margin: '0 0 4px',
};

const divider = {
  borderColor: 'rgba(255,255,255,0.05)',
  margin: '20px 0',
};

const cardBlock = {
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  borderLeft: '3px solid rgba(99, 102, 241, 0.3)',
  padding: '14px 16px',
  margin: '0 0 10px',
};

const cardLabel = {
  color: '#6366f1',
  fontSize: '11px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 6px',
};

const cardValue = {
  color: '#E2E8F0',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
};

const actionSection = {
  textAlign: 'center' as const,
  margin: '0 0 20px',
};

const actionLabel = {
  color: '#94A3B8',
  fontSize: '12px',
  margin: '0 0 6px',
};

const actionText = {
  color: '#F1F5F9',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '0 0 28px',
};

const primaryCta = {
  display: 'inline-block' as const,
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
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
