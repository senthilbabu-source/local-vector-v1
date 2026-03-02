// ---------------------------------------------------------------------------
// emails/WeeklyDigest.tsx — Weekly Digest Email Template (Sprint 117)
//
// React Email component for the enhanced weekly digest with org branding,
// citations list, missed queries, first mover alerts, and unsubscribe.
//
// Replaces the Sprint 59C scaffold. Uses sub-components from emails/components/.
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
  Link,
  Hr,
  Preview,
} from '@react-email/components';
import type { WeeklyDigestPayload } from '@/lib/digest/types';
import DigestHeader from './components/DigestHeader';
import SovScoreBlock from './components/SovScoreBlock';
import CitationList from './components/CitationList';
import MissedQueryList from './components/MissedQueryList';
import FirstMoverAlertBlock from './components/FirstMoverAlert';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WeeklyDigestProps {
  payload: WeeklyDigestPayload;
}

// ---------------------------------------------------------------------------
// Default props for preview
// ---------------------------------------------------------------------------

const defaultPayload: WeeklyDigestPayload = {
  org_id: 'preview-org',
  org_name: 'Charcoal N Chill',
  recipient_email: 'aruna@charcoalnchill.com',
  recipient_name: 'Aruna Babu',
  unsubscribe_token: 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12',
  week_of: '2026-03-02',
  sov_trend: {
    current_sov: 42,
    previous_sov: 37,
    delta: 5,
    trend: 'up',
    total_queries: 12,
    cited_count: 5,
  },
  citations: [
    { query_text: 'best hookah lounge near Alpharetta', cited_at: '2026-03-01T00:00:00Z' },
    { query_text: 'upscale hookah bar Atlanta', cited_at: '2026-03-01T00:00:00Z' },
  ],
  missed_queries: [
    { query_text: 'hookah bar with private events', competitor_cited: null },
    { query_text: 'Indian fusion restaurant Alpharetta', competitor_cited: 'Zyka Restaurant' },
  ],
  first_mover_alert: {
    query_text: 'hookah lounge open late night',
    detected_at: '2026-03-01T10:00:00Z',
    action_url: '/dashboard/content/new?query=hookah+lounge+open+late+night',
  },
  org_logo_url: null,
  org_primary_color: '#1a1a2e',
  org_text_on_primary: '#ffffff',
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export function formatWeekOf(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export default function WeeklyDigest({ payload = defaultPayload }: WeeklyDigestProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';
  const weekOfFormatted = formatWeekOf(payload.week_of);
  const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${payload.unsubscribe_token}`;

  return (
    <Html>
      <Head />
      <Preview>
        {`Your AI Visibility Report — ${payload.org_name}: ${payload.sov_trend.current_sov}% Share of Voice`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <DigestHeader
            orgName={payload.org_name}
            weekOf={weekOfFormatted}
            logoUrl={payload.org_logo_url}
            primaryColor={payload.org_primary_color}
            textOnPrimary={payload.org_text_on_primary}
          />

          {/* SOV Score Block */}
          <SovScoreBlock sovTrend={payload.sov_trend} />

          <Hr style={divider} />

          {/* Where You Were Cited */}
          <CitationList citations={payload.citations} />

          <Hr style={divider} />

          {/* Where You're Missing */}
          <MissedQueryList
            missedQueries={payload.missed_queries}
            primaryColor={payload.org_primary_color}
            textOnPrimary={payload.org_text_on_primary}
          />

          {/* First Mover Alert (conditional) */}
          {payload.first_mover_alert && (
            <>
              <Hr style={divider} />
              <FirstMoverAlertBlock alert={payload.first_mover_alert} />
            </>
          )}

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this because you&apos;re a member of {payload.org_name} on LocalVector.
            </Text>
            <Link href={unsubscribeUrl} style={unsubLink}>
              Unsubscribe from weekly reports
            </Link>
            <Text style={poweredBy}>
              Powered by LocalVector
            </Text>
          </Section>
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
  maxWidth: '600px',
  margin: '0 auto',
  padding: '40px 20px',
};

const divider = {
  borderColor: 'rgba(255,255,255,0.05)',
  margin: '16px 0',
};

const footer = {
  textAlign: 'center' as const,
  marginTop: '24px',
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '0 0 8px',
};

const unsubLink = {
  color: '#6b7280',
  fontSize: '12px',
  textDecoration: 'underline',
};

const poweredBy = {
  color: '#4b5563',
  fontSize: '11px',
  marginTop: '12px',
};
