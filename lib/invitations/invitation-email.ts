/**
 * Invitation Email — Sprint 112
 *
 * Pure email content builder. No side effects, no API calls.
 * The actual send uses the existing sendEmail pattern from lib/email.ts.
 */

import type { MemberRole } from '@/lib/membership/types';

// ---------------------------------------------------------------------------
// Role descriptions for the email
// ---------------------------------------------------------------------------

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'You can invite, remove, and manage all content.',
  analyst: 'You can view all data and generate reports.',
  viewer: 'You have read-only access to dashboard data.',
};

function capitalizeRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// ---------------------------------------------------------------------------
// buildInvitationEmailProps
// ---------------------------------------------------------------------------

export interface InvitationEmailParams {
  inviterName: string;
  orgName: string;
  role: Exclude<MemberRole, 'owner'>;
  acceptUrl: string;
  expiresAt: string; // ISO string
}

// Sprint 115: Theme shape for branded emails
export interface InvitationEmailTheme {
  primary_color: string;
  text_on_primary: string;
  logo_url: string | null;
  show_powered_by: boolean;
}

export interface InvitationEmailProps {
  inviterName: string;
  orgName: string;
  role: string;
  roleDescription: string;
  inviteUrl: string;
  expiresIn: string;
  theme?: InvitationEmailTheme;
}

/**
 * Builds props for the InvitationEmail React Email template.
 * Pure function — no API calls.
 */
export function buildInvitationEmailProps(
  params: InvitationEmailParams
): InvitationEmailProps {
  const expiresDate = new Date(params.expiresAt);
  const formattedExpiry = expiresDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    inviterName: params.inviterName,
    orgName: params.orgName,
    role: capitalizeRole(params.role),
    roleDescription: ROLE_DESCRIPTIONS[params.role] ?? 'You can view dashboards and reports.',
    inviteUrl: params.acceptUrl,
    expiresIn: `on ${formattedExpiry}`,
  };
}

/**
 * Returns the email subject line.
 */
export function buildInvitationSubject(inviterName: string, orgName: string): string {
  return `${inviterName} invited you to join ${orgName} on LocalVector`;
}
