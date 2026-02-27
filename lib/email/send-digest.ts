// ---------------------------------------------------------------------------
// lib/email/send-digest.ts — Weekly Digest Email Sender (Sprint 78)
//
// Wraps Resend SDK for sending the rendered weekly digest email.
// Uses Resend's `react:` property for server-side rendering (same pattern
// as sendWeeklyDigest in lib/email.ts Sprint 59C).
//
// No-ops silently when RESEND_API_KEY is absent (local dev, CI).
// Errors are NOT swallowed — callers should wrap with .catch() (§17).
// ---------------------------------------------------------------------------

import { Resend } from 'resend';
import WeeklyDigestEmail from '@/emails/weekly-digest';
import type { DigestPayload } from '@/lib/services/weekly-digest.service';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/**
 * Send a weekly digest email via Resend.
 * Side-effect: sends an actual email. Must be .catch()-wrapped by caller (§17).
 *
 * Returns `{ id }` on success, `null` when API key is absent.
 * Throws on Resend error — caller must handle.
 */
export async function sendDigestEmail(
  payload: DigestPayload,
): Promise<{ id: string } | null> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[digest] RESEND_API_KEY not set — skipping email');
    return null;
  }

  const { data, error } = await getResend().emails.send({
    from: 'LocalVector <digest@localvector.ai>',
    to: payload.recipientEmail,
    subject: payload.subject,
    react: WeeklyDigestEmail({ payload }),
  });

  if (error) {
    console.error('[digest] Resend error:', error);
    throw new Error(`Resend send failed: ${error.message}`);
  }

  console.log(
    `[digest] Weekly snapshot sent to ${payload.recipientEmail} for ${payload.businessName}`,
  );
  return data;
}
