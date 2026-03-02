// ---------------------------------------------------------------------------
// emails/components/FirstMoverAlert.tsx — First mover opportunity (Sprint 117)
// ---------------------------------------------------------------------------

import { Section, Text, Button } from '@react-email/components';
import type { DigestFirstMoverAlert } from '@/lib/digest/types';

interface FirstMoverAlertProps {
  alert: DigestFirstMoverAlert;
}

export default function FirstMoverAlertBlock({ alert }: FirstMoverAlertProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';

  return (
    <Section style={container}>
      <Text style={heading}>
        {'\uD83D\uDE80'} First Mover Opportunity
      </Text>
      <Text style={body}>
        No business is being recommended when people ask: &ldquo;{alert.query_text}&rdquo;
      </Text>
      <Text style={subtext}>
        Be the first to create content for this query before your competitors do.
      </Text>
      <Button href={`${baseUrl}${alert.action_url}`} style={ctaButton}>
        Claim This Query →
      </Button>
    </Section>
  );
}

const container = {
  backgroundColor: 'rgba(245, 158, 11, 0.08)',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '4px',
  padding: '16px',
  margin: '16px 0',
};

const heading = {
  color: '#F1F5F9',
  fontSize: '16px',
  fontWeight: '700' as const,
  margin: '0 0 8px',
};

const body = {
  color: '#E2E8F0',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 4px',
};

const subtext = {
  color: '#94A3B8',
  fontSize: '13px',
  margin: '0 0 12px',
};

const ctaButton = {
  display: 'inline-block' as const,
  backgroundColor: '#f59e0b',
  color: '#1a1a2e',
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '600' as const,
  fontSize: '13px',
};
