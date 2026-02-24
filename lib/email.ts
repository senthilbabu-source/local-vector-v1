// ---------------------------------------------------------------------------
// lib/email.ts — Transactional email via Resend
//
// Provides sendHallucinationAlert() for the cron audit route.
// No-ops gracefully when RESEND_API_KEY is absent (local dev, CI).
//
// Required env var:
//   RESEND_API_KEY — Resend API secret key
//
// From address:
//   alerts@localvector.ai (must be a verified domain in the Resend dashboard)
// ---------------------------------------------------------------------------

import { Resend } from 'resend';

// Lazily initialised — only created when sendHallucinationAlert() is actually
// called with a valid RESEND_API_KEY. Avoids build-time crash during static
// page data collection when the env var is absent.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HallucinationAlertPayload {
  to: string;
  orgName: string;
  businessName: string;
  hallucinationCount: number;
  dashboardUrl: string;
}

// ---------------------------------------------------------------------------
// sendHallucinationAlert
// ---------------------------------------------------------------------------

/**
 * Sends a "New AI Hallucination Detected" alert email to the org owner.
 *
 * No-ops silently when RESEND_API_KEY is not configured so that local dev
 * and CI runs never fail because of a missing email key.
 *
 * Errors are NOT swallowed — callers should wrap with .catch() if they want
 * to prevent email failures from surfacing up the call stack.
 */
export async function sendHallucinationAlert(
  payload: HallucinationAlertPayload
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping alert for ${payload.businessName}`
    );
    return;
  }

  const subject =
    `⚠️ ${payload.hallucinationCount} AI hallucination` +
    `${payload.hallucinationCount === 1 ? '' : 's'} detected for ${payload.businessName}`;

  await getResend().emails.send({
    from: 'LocalVector Alerts <alerts@localvector.ai>',
    to: payload.to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#dc2626">AI Hallucinations Detected</h2>
        <p>
          LocalVector found <strong>${payload.hallucinationCount}</strong>
          new AI inaccurac${payload.hallucinationCount === 1 ? 'y' : 'ies'}
          for <strong>${payload.businessName}</strong>.
        </p>
        <p>These hallucinations may be driving customers away from your business.</p>
        <p>
          <a
            href="${payload.dashboardUrl}"
            style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600"
          >
            View &amp; Fix on Dashboard →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          You're receiving this because you have AI hallucination monitoring enabled
          for ${payload.orgName} on LocalVector.ai.
        </p>
      </div>
    `,
  });
}
