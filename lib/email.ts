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

// ---------------------------------------------------------------------------
// SOV Weekly Report — Doc 04c §7
// ---------------------------------------------------------------------------

export interface SOVReportPayload {
  to: string;
  businessName: string;
  shareOfVoice: number;
  queriesRun: number;
  queriesCited: number;
  firstMoverCount: number;
  dashboardUrl: string;
}

/**
 * Sends the weekly SOV report email to the org owner.
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 * Errors are NOT swallowed — callers should wrap with .catch().
 */
export async function sendSOVReport(
  payload: SOVReportPayload
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping SOV report for ${payload.businessName}`
    );
    return;
  }

  const subject = `Your AI Visibility Report — ${payload.businessName}`;

  const firstMoverSection = payload.firstMoverCount > 0
    ? `
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:4px">
          <strong>🏆 ${payload.firstMoverCount} First Mover Opportunit${payload.firstMoverCount === 1 ? 'y' : 'ies'}</strong>
          <p style="margin:4px 0 0;color:#92400e">AI isn't recommending anyone for ${payload.firstMoverCount === 1 ? 'this query' : 'these queries'} yet. Be first.</p>
        </div>
      `
    : '';

  await getResend().emails.send({
    from: 'LocalVector Reports <reports@localvector.ai>',
    to: payload.to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#4f46e5">Weekly AI Visibility Report</h2>
        <p>Here's how <strong>${payload.businessName}</strong> performed in AI search this week:</p>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:16px 0">
          <div style="text-align:center">
            <div style="font-size:48px;font-weight:700;color:${payload.shareOfVoice >= 50 ? '#16a34a' : payload.shareOfVoice >= 20 ? '#f59e0b' : '#dc2626'}">
              ${payload.shareOfVoice}%
            </div>
            <div style="color:#64748b;font-size:14px">Share of Voice</div>
          </div>
          <div style="display:flex;justify-content:space-around;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:16px">
            <div style="text-align:center">
              <div style="font-size:24px;font-weight:600">${payload.queriesRun}</div>
              <div style="color:#64748b;font-size:12px">Queries Run</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:24px;font-weight:600;color:#16a34a">${payload.queriesCited}</div>
              <div style="color:#64748b;font-size:12px">Times Cited</div>
            </div>
          </div>
        </div>

        ${firstMoverSection}

        <p>
          <a
            href="${payload.dashboardUrl}"
            style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600"
          >
            View Full Report →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          This report is generated weekly from LocalVector's SOV Engine.
        </p>
      </div>
    `,
  });
}
