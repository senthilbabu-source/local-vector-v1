// ---------------------------------------------------------------------------
// emails/components/DigestHeader.tsx — Branded email header (Sprint 117)
// ---------------------------------------------------------------------------

import { Section, Text, Img } from '@react-email/components';

interface DigestHeaderProps {
  orgName: string;
  weekOf: string;
  logoUrl: string | null;
  primaryColor: string;
  textOnPrimary: string;
}

export default function DigestHeader({
  orgName,
  weekOf,
  logoUrl,
  primaryColor,
  textOnPrimary,
}: DigestHeaderProps) {
  return (
    <Section
      style={{
        backgroundColor: primaryColor,
        borderRadius: '8px 8px 0 0',
        padding: '24px',
        textAlign: 'center' as const,
      }}
    >
      {logoUrl && (
        <Img
          src={logoUrl}
          alt={orgName}
          width={120}
          style={{ margin: '0 auto 12px', display: 'block', maxWidth: '120px' }}
        />
      )}
      <Text
        style={{
          color: textOnPrimary,
          fontSize: '20px',
          fontWeight: '700' as const,
          margin: '0 0 4px',
        }}
      >
        {orgName}
      </Text>
      <Text
        style={{
          color: textOnPrimary,
          fontSize: '14px',
          margin: '0',
          opacity: 0.85,
        }}
      >
        Your AI Visibility Report — Week of {weekOf}
      </Text>
    </Section>
  );
}
