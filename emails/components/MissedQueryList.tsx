// ---------------------------------------------------------------------------
// emails/components/MissedQueryList.tsx — "Where you're missing" (Sprint 117)
// ---------------------------------------------------------------------------

import { Section, Text, Button } from '@react-email/components';
import type { DigestMissedQuery } from '@/lib/digest/types';

interface MissedQueryListProps {
  missedQueries: DigestMissedQuery[];
  primaryColor: string;
  textOnPrimary: string;
}

export default function MissedQueryList({
  missedQueries,
  primaryColor,
  textOnPrimary,
}: MissedQueryListProps) {
  if (missedQueries.length === 0) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';

  return (
    <Section style={section}>
      <Text style={heading}>
        {'\uD83D\uDCCD'} Where you&apos;re not yet being recommended
      </Text>
      {missedQueries.map((q, i) => (
        <Text key={i} style={item}>
          {'\u2022'} &ldquo;{q.query_text}&rdquo;{' '}
          {q.competitor_cited
            ? `— ${q.competitor_cited} was recommended instead`
            : '— no local business is being recommended'}
        </Text>
      ))}
      <Button
        href={`${baseUrl}/dashboard/content`}
        style={{
          ...ctaButton,
          backgroundColor: primaryColor,
          color: textOnPrimary,
        }}
      >
        Create Content to Win These Queries →
      </Button>
    </Section>
  );
}

const section = {
  margin: '16px 0',
};

const heading = {
  color: '#6366f1',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 12px',
};

const item = {
  color: '#E2E8F0',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 4px',
};

const ctaButton = {
  display: 'inline-block' as const,
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '600' as const,
  fontSize: '14px',
  marginTop: '12px',
};
