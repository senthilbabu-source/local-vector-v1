// ---------------------------------------------------------------------------
// emails/components/SovScoreBlock.tsx — SOV score + trend block (Sprint 117)
// ---------------------------------------------------------------------------

import { Section, Text } from '@react-email/components';
import type { DigestSovTrend } from '@/lib/digest/types';

interface SovScoreBlockProps {
  sovTrend: DigestSovTrend;
}

export default function SovScoreBlock({ sovTrend }: SovScoreBlockProps) {
  const trendArrow = sovTrend.trend === 'up' ? '\u2191' : sovTrend.trend === 'down' ? '\u2193' : '\u2192';
  const trendColor = sovTrend.trend === 'up' ? '#16a34a' : sovTrend.trend === 'down' ? '#dc2626' : '#64748B';
  const deltaText = sovTrend.delta > 0
    ? `+${sovTrend.delta} points this week`
    : sovTrend.delta < 0
      ? `${sovTrend.delta} points this week`
      : 'No change';

  return (
    <Section style={scoreSection}>
      <Text style={scoreNumber}>
        {sovTrend.current_sov}%
      </Text>
      <Text style={scoreLabel}>AI Mentions</Text>
      <Text style={{ ...deltaStyle, color: trendColor }}>
        {trendArrow} {deltaText}
      </Text>
      <Text style={subtext}>
        Based on {sovTrend.total_queries} AI queries tracked
      </Text>
    </Section>
  );
}

const scoreSection = {
  textAlign: 'center' as const,
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '24px',
  margin: '16px 0',
};

const scoreNumber = {
  fontSize: '48px',
  fontWeight: '700' as const,
  color: '#F1F5F9',
  margin: '0',
  lineHeight: '1',
};

const scoreLabel = {
  color: '#64748B',
  fontSize: '14px',
  margin: '4px 0 0',
};

const deltaStyle = {
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '8px 0 0',
};

const subtext = {
  color: '#64748B',
  fontSize: '12px',
  margin: '4px 0 0',
};
