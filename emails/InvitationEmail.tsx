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

interface InvitationEmailProps {
  inviterName: string;
  orgName: string;
  role: string;
  roleDescription: string;
  inviteUrl: string;
  expiresIn: string;
}

export default function InvitationEmail({
  inviterName = 'Team Owner',
  orgName = 'Your Team',
  role = 'Viewer',
  roleDescription = 'You can view dashboards, reports, and download exports.',
  inviteUrl = 'https://app.localvector.ai/invite/token',
  expiresIn = 'in 7 days',
}: InvitationEmailProps) {
  const subject = `${inviterName} invited you to join ${orgName} on LocalVector`;

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>You&apos;re Invited</Heading>
            <Text style={subtitle}>Join {orgName} on LocalVector</Text>
          </Section>

          {/* Invitation details */}
          <Section style={detailSection}>
            <Text style={bodyText}>
              <strong>{inviterName}</strong> has invited you to join{' '}
              <strong>{orgName}</strong> as a <strong>{role}</strong>.
            </Text>
            <Text style={roleText}>{roleDescription}</Text>
          </Section>

          {/* Role badge */}
          <Section style={badgeSection}>
            <Text style={roleBadge}>{role}</Text>
          </Section>

          <Hr style={divider} />

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={inviteUrl} style={primaryCta}>
              Accept Invitation
            </Link>
          </Section>

          {/* Expiry */}
          <Section>
            <Text style={expiryText}>
              This invitation expires {expiresIn}.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              LocalVector — AI Visibility for Local Businesses
            </Text>
            <Text style={footerTextLight}>
              If you weren&apos;t expecting this invitation, you can safely ignore
              this email.
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

const roleText = {
  color: '#94A3B8',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
};

const badgeSection = {
  textAlign: 'center' as const,
  margin: '0 0 16px',
};

const roleBadge = {
  display: 'inline-block' as const,
  backgroundColor: '#6366f1',
  color: '#ffffff',
  padding: '4px 16px',
  borderRadius: '16px',
  fontSize: '13px',
  fontWeight: '600' as const,
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

const expiryText = {
  color: '#64748B',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0',
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
