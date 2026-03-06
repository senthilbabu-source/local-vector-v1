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
import InvitationEmail from '@/emails/InvitationEmail';
import type { InvitationEmailProps } from '@/lib/invitations/invitation-email';
import WeeklyDigestTemplate, { formatWeekOf } from '@/emails/WeeklyDigest';
import type { WeeklyDigestPayload as EnhancedDigestPayload, DigestSendResult } from '@/lib/digest/types';
import { shouldSendDigest } from '@/lib/digest/send-gate';

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
 * @deprecated Use `sendWeeklyDigest()` instead (Sprint 59C).
 * This function uses raw HTML strings. The new `sendWeeklyDigest()` uses the
 * React Email template at `emails/WeeklyDigest.tsx` with richer data
 * (SOV delta, top competitor, citation rate).
 *
 * Kept for backwards compatibility with existing test mocks.
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
            <div style="color:#64748b;font-size:14px">AI Mentions</div>
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

// ---------------------------------------------------------------------------
// Weekly Digest — Legacy (Sprint 59C) — DEPRECATED, use sendEnhancedDigest
// ---------------------------------------------------------------------------

export interface WeeklyDigestPayload {
  to: string;
  businessName: string;
  shareOfVoice: number;
  queriesRun: number;
  queriesCited: number;
  firstMoverCount: number;
  dashboardUrl: string;
  sovDelta?: number | null;
  topCompetitor?: string | null;
  citationRate?: number | null;
}

/**
 * @deprecated Use `sendEnhancedDigest()` instead (Sprint 117).
 * Kept for backward compatibility with existing SOV cron inline path.
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 * Errors are NOT swallowed — callers should wrap with .catch().
 */
export async function sendWeeklyDigest(
  _payload: WeeklyDigestPayload
): Promise<void> {
  // Sprint 117: Deprecated. The SOV cron now uses sendEnhancedDigest().
  // This function is kept as a no-op to prevent import errors in tests.
  console.log(
    `[email] sendWeeklyDigest is deprecated — use sendEnhancedDigest()`
  );
}

// ---------------------------------------------------------------------------
// Enhanced Weekly Digest — Sprint 117
// ---------------------------------------------------------------------------

/**
 * Sends the enhanced weekly digest email using the Sprint 117 React Email
 * template with org branding, citations, missed queries, and unsubscribe.
 *
 * Checks send gate before sending. Returns DigestSendResult.
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 * Errors are NOT swallowed — callers should wrap with .catch().
 */
export async function sendEnhancedDigest(
  payload: EnhancedDigestPayload,
  options?: { is_first_digest?: boolean },
): Promise<DigestSendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping enhanced digest for ${payload.org_name}`
    );
    return { sent: false, skipped: true, skip_reason: 'resend_error' };
  }

  // Check send gate
  const gate = shouldSendDigest({
    sov_delta: payload.sov_trend.delta,
    has_first_mover_alert: payload.first_mover_alert !== null,
    is_first_digest: options?.is_first_digest ?? false,
  });

  if (!gate.should_send) {
    return { sent: false, skipped: true, skip_reason: 'send_gate_not_met' };
  }

  const weekOfFormatted = formatWeekOf(payload.week_of);
  const subject = `Your AI Visibility Report — Week of ${weekOfFormatted}`;

  try {
    const { data, error } = await getResend().emails.send({
      from: 'LocalVector Reports <reports@localvector.ai>',
      to: payload.recipient_email,
      subject,
      react: WeeklyDigestTemplate({ payload }),
    });

    if (error) {
      console.error('[email] Enhanced digest Resend error:', error);
      return { sent: false, skipped: false, skip_reason: 'resend_error' };
    }

    console.log(
      `[email] Enhanced digest sent to ${payload.recipient_email} for ${payload.org_name}`
    );
    return { sent: true, skipped: false, message_id: data?.id };
  } catch (err) {
    console.error('[email] Enhanced digest send failed:', err);
    return { sent: false, skipped: false, skip_reason: 'resend_error' };
  }
}

export { formatWeekOf } from '@/emails/WeeklyDigest';

// ---------------------------------------------------------------------------
// P5-FIX-21: Scan Complete Notification Email
// ---------------------------------------------------------------------------

export interface ScanCompletePayload {
  to: string;
  businessName: string;
  shareOfVoice: number;
  queriesRun: number;
  queriesCited: number;
  isFirstScan: boolean;
  dashboardUrl: string;
}

/**
 * Sends a "Scan Complete" notification email after a SOV scan finishes.
 * Includes a special first-scan message with onboarding guidance.
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 */
export async function sendScanCompleteEmail(
  payload: ScanCompletePayload,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping scan complete for ${payload.businessName}`,
    );
    return;
  }

  const subject = payload.isFirstScan
    ? `Your first AI visibility scan is complete — ${payload.businessName}`
    : `Weekly scan complete — ${payload.businessName}`;

  const greeting = payload.isFirstScan
    ? `<p>Great news! Your first AI visibility scan for <strong>${payload.businessName}</strong> is complete. Here's what we found:</p>`
    : `<p>Your weekly AI visibility scan for <strong>${payload.businessName}</strong> has completed.</p>`;

  const citationRate = payload.queriesRun > 0
    ? Math.round((payload.queriesCited / payload.queriesRun) * 100)
    : 0;

  await getResend().emails.send({
    from: 'LocalVector <alerts@localvector.ai>',
    to: payload.to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#16a34a">Scan Complete</h2>
        ${greeting}
        <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:8px 0;color:#475569;font-size:14px">AI Visibility Score</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;font-size:18px;color:#16a34a">${payload.shareOfVoice}%</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;font-size:14px">Queries Scanned</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b">${payload.queriesRun}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;font-size:14px">Citation Rate</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b">${citationRate}%</td>
            </tr>
          </table>
        </div>
        ${payload.isFirstScan ? `
        <p style="color:#475569;font-size:14px">
          Your dashboard now shows real data. Check your AI Mentions, Position, and any wrong facts that AI engines have about your business.
        </p>
        ` : ''}
        <p>
          <a
            href="${payload.dashboardUrl}"
            style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600"
          >
            View Dashboard →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          You're receiving this because you have weekly digest enabled on LocalVector.ai.
        </p>
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// Content Freshness Decay Alert (Sprint 76)
// ---------------------------------------------------------------------------

export interface FreshnessAlertPayload {
  to: string;
  businessName: string;
  dropPercentage: number;
  previousRate: number;
  currentRate: number;
  dashboardUrl: string;
}

/**
 * Sends a "Citation Rate Dropped" alert email when freshness decay is detected.
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 * Errors are NOT swallowed — callers should wrap with .catch().
 */
export async function sendFreshnessAlert(
  payload: FreshnessAlertPayload
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping freshness alert for ${payload.businessName}`
    );
    return;
  }

  const prevPct = Math.round(payload.previousRate * 100);
  const currPct = Math.round(payload.currentRate * 100);
  const subject = `📉 Citation rate dropped ${payload.dropPercentage}% for ${payload.businessName}`;

  await getResend().emails.send({
    from: 'LocalVector Alerts <alerts@localvector.ai>',
    to: payload.to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#f59e0b">Citation Freshness Alert</h2>
        <p>
          Your citation rate for <strong>${payload.businessName}</strong> dropped
          <strong>${payload.dropPercentage}%</strong> — from ${prevPct}% to ${currPct}%.
        </p>
        <p>
          This usually means AI models are deprioritizing your business due to stale content.
          Refreshing your content can help recover your citation rate.
        </p>
        <p>
          <a
            href="${payload.dashboardUrl}"
            style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600"
          >
            View Dashboard →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          You're receiving this because you have SOV alerts enabled on LocalVector.ai.
        </p>
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// Correction Follow-Up Alert (Sprint N)
// ---------------------------------------------------------------------------

export interface CorrectionFollowUpPayload {
  to: string;
  businessName: string;
  claimText: string;
  result: 'fixed' | 'recurring';
  dashboardUrl: string;
}

/**
 * Sends a follow-up notification after a correction re-scan completes.
 *
 * "fixed"     → green success: "Your correction worked!"
 * "recurring" → amber warning: "The issue persists"
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 * Errors are NOT swallowed — callers should wrap with .catch().
 */
export async function sendCorrectionFollowUpAlert(
  payload: CorrectionFollowUpPayload
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping correction follow-up for ${payload.businessName}`
    );
    return;
  }

  const isFixed = payload.result === 'fixed';
  const subject = isFixed
    ? `✅ Correction confirmed for ${payload.businessName}`
    : `⚠️ AI hallucination persists for ${payload.businessName}`;

  const headingColor = isFixed ? '#16a34a' : '#f59e0b';
  const heading = isFixed ? 'Correction Confirmed' : 'Hallucination Still Present';
  const bodyText = isFixed
    ? `Great news! The AI hallucination about <strong>${payload.businessName}</strong> has been corrected. The AI model is now providing accurate information.`
    : `The AI hallucination about <strong>${payload.businessName}</strong> is still present after 14 days. The AI model has not yet updated its response.`;
  const claimSnippet = payload.claimText.length > 120
    ? payload.claimText.slice(0, 117) + '...'
    : payload.claimText;
  const actionLabel = isFixed ? 'View Proof Timeline →' : 'Review & Take Action →';

  await getResend().emails.send({
    from: 'LocalVector Alerts <alerts@localvector.ai>',
    to: payload.to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:${headingColor}">${heading}</h2>
        <p>${bodyText}</p>
        <div style="background:#f8fafc;border-left:4px solid ${headingColor};padding:12px 16px;margin:16px 0;border-radius:4px">
          <p style="margin:0;color:#475569;font-size:13px"><strong>Original claim:</strong></p>
          <p style="margin:4px 0 0;color:#64748b;font-size:13px;font-style:italic">&ldquo;${claimSnippet}&rdquo;</p>
        </div>
        <p>
          <a
            href="${payload.dashboardUrl}"
            style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600"
          >
            ${actionLabel}
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          You're receiving this because you have hallucination alerts enabled on LocalVector.ai.
        </p>
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// P8-FIX-37: Competitive Hijacking Alert Email
// ---------------------------------------------------------------------------

export interface HijackingAlertPayload {
  to: string;
  businessName: string;
  competitorName: string;
  hijackType: 'attribute_confusion' | 'competitor_citation' | 'address_mix';
  engine: string;
  queryCount: number;
  dashboardUrl: string;
}

const HIJACK_TYPE_LABELS: Record<string, string> = {
  competitor_citation: 'appearing in AI results',
  address_mix: 'causing address confusion',
  attribute_confusion: 'being confused with your business',
};

/**
 * Sends a hijacking alert email when a competitor intercepts AI results.
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 * Errors are NOT swallowed — callers should wrap with .catch().
 */
export async function sendHijackingAlert(
  payload: HijackingAlertPayload,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping hijacking alert for ${payload.businessName}`,
    );
    return;
  }

  const typeLabel = HIJACK_TYPE_LABELS[payload.hijackType] ?? 'intercepting AI results';
  const subject = `⚠️ ${payload.competitorName} is ${typeLabel} meant for ${payload.businessName}`;

  await getResend().emails.send({
    from: 'LocalVector Alerts <alerts@localvector.ai>',
    to: payload.to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#dc2626">Competitor Hijacking Detected</h2>
        <p>
          <strong>${payload.competitorName}</strong> is ${typeLabel}
          for <strong>${payload.businessName}</strong> on ${payload.engine}.
        </p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;border-radius:4px">
          <strong>Affected queries:</strong> ${payload.queryCount} query${payload.queryCount === 1 ? '' : 'ies'} impacted
        </div>
        <p>
          This means AI users searching for your business may be directed to
          a competitor instead. We recommend reviewing and taking corrective action.
        </p>
        <p>
          <a
            href="${payload.dashboardUrl}"
            style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600"
          >
            View &amp; Fix on Dashboard →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">
          You're receiving this because you have hijacking alerts enabled
          for ${payload.businessName} on LocalVector.ai.
        </p>
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// Team Invitation Email (Sprint 112) — React Email template
// ---------------------------------------------------------------------------

export interface InvitationEmailPayload extends InvitationEmailProps {
  to: string;
  subject: string;
}

/**
 * Sends a team invitation email using the InvitationEmail React Email template.
 * Sprint 115: passes optional theme for org branding.
 *
 * No-ops silently when RESEND_API_KEY is not configured.
 * Errors ARE thrown — callers should catch if email failure is non-fatal.
 */
// ---------------------------------------------------------------------------
// S22: AI Model Degradation Alert
// ---------------------------------------------------------------------------

export interface DegradationAlertData {
  modelProvider: string;
  affectedOrgCount: number;
}

export async function sendDegradationAlert(
  to: string,
  data: DegradationAlertData,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY absent — skipping degradation alert to ${to}`);
    return;
  }

  const modelName = data.modelProvider.includes('openai') ? 'ChatGPT'
    : data.modelProvider.includes('perplexity') ? 'Perplexity'
    : data.modelProvider.includes('gemini') ? 'Gemini'
    : data.modelProvider;

  await getResend().emails.send({
    from: 'LocalVector Alerts <alerts@localvector.ai>',
    to,
    subject: `AI Model Alert: ${modelName} appears to have updated`,
    html: `
      <h2>AI Model Alert</h2>
      <p>${modelName} appears to have updated its knowledge base. This is not your fault.</p>
      <p><strong>${data.affectedOrgCount}</strong> businesses on LocalVector saw new errors this week.</p>
      <p>Here's what to do:</p>
      <ol>
        <li>Check your <a href="https://app.localvector.ai/dashboard/hallucinations">AI Mistakes page</a> for any new errors</li>
        <li>If you see new issues, they may resolve on their own as the model stabilizes</li>
        <li>We will notify you when we confirm the update has settled</li>
      </ol>
      <p>— The LocalVector Team</p>
    `,
  });

  console.log(`[email] Degradation alert sent to ${to} for model ${data.modelProvider}`);
}

export async function sendInvitationEmail(
  payload: InvitationEmailPayload
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY absent — skipping invitation email to ${payload.to}`
    );
    return;
  }

  const { to, subject, ...templateProps } = payload;

  await getResend().emails.send({
    from: 'LocalVector Team <team@localvector.ai>',
    to,
    subject,
    react: InvitationEmail(templateProps),
  });

  console.log(`[email] Invitation email sent to ${to} for org ${payload.orgName}`);
}

// ---------------------------------------------------------------------------
// S27: Monthly AI Health Report
// ---------------------------------------------------------------------------

export interface MonthlyReportEmailData {
  month: string;
  winsCount: number;
  fixedHallucinationsCount: number;
  revenueRecoveredMonthly: number;
  realityScoreDelta: number | null;
  sovDelta: number | null;
  openAlertCount: number;
  openAlertDollarImpact: number;
  ytdRecoveryTotal: number;
  ytdErrorsCaught: number;
  ytdAvgDetectionDays: number | null;
}

export async function sendMonthlyReport(
  to: string,
  report: MonthlyReportEmailData,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY absent — skipping monthly report to ${to}`);
    return;
  }

  const scoreTrend = report.realityScoreDelta !== null
    ? report.realityScoreDelta >= 0 ? `+${report.realityScoreDelta}` : `${report.realityScoreDelta}`
    : 'N/A';

  const sovTrend = report.sovDelta !== null
    ? report.sovDelta >= 0 ? `+${report.sovDelta}%` : `${report.sovDelta}%`
    : 'N/A';

  await getResend().emails.send({
    from: 'LocalVector <reports@localvector.ai>',
    to,
    subject: `Your AI Health Report — ${report.month}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;margin-bottom:4px;">Monthly AI Health Report</h1>
        <p style="color:#64748b;font-size:14px;">${report.month}</p>

        <h2 style="font-size:16px;margin-top:24px;">Wins This Month</h2>
        <ul style="color:#334155;font-size:14px;">
          <li>${report.fixedHallucinationsCount} AI errors fixed</li>
          <li>$${Math.round(report.revenueRecoveredMonthly).toLocaleString()} revenue recovered</li>
          <li>AI Score trend: ${scoreTrend}</li>
          <li>AI Mentions trend: ${sovTrend}</li>
        </ul>

        <h2 style="font-size:16px;margin-top:24px;">Still Outstanding</h2>
        <ul style="color:#334155;font-size:14px;">
          <li>${report.openAlertCount} open alerts</li>
          <li>$${Math.round(report.openAlertDollarImpact).toLocaleString()}/mo potential impact</li>
        </ul>

        <h2 style="font-size:16px;margin-top:24px;">Year-to-Date</h2>
        <ul style="color:#334155;font-size:14px;">
          <li>$${Math.round(report.ytdRecoveryTotal).toLocaleString()} total recovery</li>
          <li>${report.ytdErrorsCaught} errors caught</li>
          ${report.ytdAvgDetectionDays !== null ? `<li>Avg ${report.ytdAvgDetectionDays} days to detect</li>` : ''}
        </ul>

        <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai'}/dashboard" style="color:#4f46e5;">View Dashboard</a>
        </p>
      </div>
    `,
  });

  console.log(`[email] Monthly report sent to ${to} for ${report.month}`);
}
