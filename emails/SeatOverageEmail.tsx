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

interface SeatOverageEmailProps {
  ownerName: string;
  orgName: string;
  overage: number;
  seatLimit: number;
  currentMembers: number;
  manageTeamUrl: string;
  manageBillingUrl: string;
}

export default function SeatOverageEmail({
  ownerName = 'Team Owner',
  orgName = 'Your Team',
  overage = 2,
  seatLimit = 5,
  currentMembers = 7,
  manageTeamUrl = 'https://app.localvector.ai/dashboard/settings/team',
  manageBillingUrl = 'https://app.localvector.ai/dashboard/billing',
}: SeatOverageEmailProps) {
  const subject = `Action required: ${orgName} has ${overage} member${overage > 1 ? 's' : ''} over the seat limit`;

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Seat Limit Exceeded</Heading>
            <Text style={subtitle}>{orgName} on LocalVector</Text>
          </Section>

          {/* Details */}
          <Section style={detailSection}>
            <Text style={bodyText}>
              Hi {ownerName},
            </Text>
            <Text style={bodyText}>
              Your seat limit has changed and <strong>{orgName}</strong> now has{' '}
              <strong>{overage} more member{overage > 1 ? 's' : ''}</strong> than
              your current plan allows.
            </Text>
            <Text style={statsText}>
              Current members: <strong>{currentMembers}</strong> | Seat limit:{' '}
              <strong>{seatLimit}</strong>
            </Text>
          </Section>

          {/* What to do */}
          <Section style={detailSection}>
            <Text style={bodyText}>
              <strong>What you can do:</strong>
            </Text>
            <Text style={roleText}>
              1. <strong>Add seats</strong> — purchase additional seats to cover
              all members.
            </Text>
            <Text style={roleText}>
              2. <strong>Remove members</strong> — reduce your team to fit within
              the current seat limit.
            </Text>
            <Text style={roleText}>
              No member data will be removed automatically. All team members
              retain access until you take action.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* CTAs — side by side */}
          <Section style={ctaSection}>
            <Link href={manageBillingUrl} style={primaryCta}>
              Add Seats
            </Link>
            <Text style={orText}>or</Text>
            <Link href={manageTeamUrl} style={secondaryCta}>
              Manage Team
            </Link>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              LocalVector — AI Visibility for Local Businesses
            </Text>
            <Text style={footerTextLight}>
              You received this email because you are the owner of {orgName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (email client compatibility)
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
  color: '#F59E0B',
  fontSize: '22px',
  fontWeight: '700' as const,
  margin: '0 0 8px',
};

const subtitle = {
  color: '#94A3B8',
  fontSize: '14px',
  margin: '0',
};

const detailSection = {
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '24px',
  margin: '0 0 16px',
};

const bodyText = {
  color: '#F1F5F9',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 12px',
};

const statsText = {
  color: '#F59E0B',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0',
};

const roleText = {
  color: '#94A3B8',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 8px',
};

const divider = {
  borderColor: 'rgba(255,255,255,0.05)',
  margin: '24px 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '0 0 16px',
};

const primaryCta = {
  display: 'inline-block' as const,
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: '600' as const,
  fontSize: '15px',
};

const orText = {
  color: '#64748B',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '8px 0',
};

const secondaryCta = {
  display: 'inline-block' as const,
  backgroundColor: 'transparent',
  color: '#94A3B8',
  padding: '12px 28px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  textDecoration: 'none',
  fontWeight: '600' as const,
  fontSize: '15px',
};

const footer = {
  textAlign: 'center' as const,
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '0 0 4px',
};

const footerTextLight = {
  color: '#4b5563',
  fontSize: '11px',
  margin: '0',
};
