// ---------------------------------------------------------------------------
// emails/components/CitationList.tsx — "Where you were cited" list (Sprint 117)
// ---------------------------------------------------------------------------

import { Section, Text } from '@react-email/components';
import type { DigestCitation } from '@/lib/digest/types';

interface CitationListProps {
  citations: DigestCitation[];
}

export default function CitationList({ citations }: CitationListProps) {
  return (
    <Section style={section}>
      <Text style={heading}>
        {'\u2705'} Where AI recommended you this week
      </Text>
      {citations.length === 0 ? (
        <Text style={emptyText}>
          No citations this week. See opportunities below.
        </Text>
      ) : (
        citations.map((c, i) => (
          <Text key={i} style={item}>
            {'\u2022'} When asked &ldquo;{c.query_text}&rdquo; — your business was recommended
          </Text>
        ))
      )}
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

const emptyText = {
  color: '#94A3B8',
  fontSize: '14px',
  margin: '0',
};

const item = {
  color: '#E2E8F0',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 4px',
};
