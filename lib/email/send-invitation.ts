import { Resend } from 'resend';
import InvitationEmail from '@/emails/InvitationEmail';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export interface InvitationEmailPayload {
  inviterName: string;
  orgName: string;
  role: 'admin' | 'viewer';
  email: string;
  token: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'You can manage content, trigger audits, and invite other team members.',
  viewer: 'You can view dashboards, reports, and download exports.',
};

/**
 * Sends an invitation email via Resend using the InvitationEmail React Email template.
 *
 * No-ops silently when RESEND_API_KEY is not configured (local dev, CI).
 * Errors are NOT swallowed — callers must handle failures.
 */
export async function sendInvitationEmail(
  payload: InvitationEmailPayload
): Promise<{ id: string } | null> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY absent — skipping invitation for ${payload.email}`);
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';
  const inviteUrl = `${baseUrl}/api/invitations/accept?token=${payload.token}`;
  const roleLabel = payload.role.charAt(0).toUpperCase() + payload.role.slice(1);
  const subject = `${payload.inviterName} invited you to join ${payload.orgName} on LocalVector`;

  const { data, error } = await getResend().emails.send({
    from: 'LocalVector <invites@localvector.ai>',
    to: payload.email,
    subject,
    react: InvitationEmail({
      inviterName: payload.inviterName,
      orgName: payload.orgName,
      role: roleLabel,
      roleDescription: ROLE_DESCRIPTIONS[payload.role] ?? '',
      inviteUrl,
      expiresIn: 'in 7 days',
    }),
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Resend send failed: ${error.message}`);
  }

  console.log(`[email] Invitation sent to ${payload.email} for ${payload.orgName}`);
  return data;
}
