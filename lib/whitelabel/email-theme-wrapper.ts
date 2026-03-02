/**
 * Email Theme Wrapper — Sprint 115
 *
 * Pure email theme wrapper. No side effects. No API calls.
 * Used by all email templates to apply org branding.
 */

import type { OrgTheme } from './types';
import { DEFAULT_THEME } from './types';

// ---------------------------------------------------------------------------
// buildThemedEmailWrapper
// ---------------------------------------------------------------------------

interface ThemedEmailParams {
  theme: OrgTheme | null;
  orgName: string;
  subject: string;
  bodyHtml: string;
  previewText?: string;
}

interface ThemedEmailResult {
  subject: string;
  html: string;
  text: string;
}

/**
 * Wraps email body HTML with org branding (logo, colors, powered-by footer).
 * Pure function — no API calls, no side effects.
 *
 * When theme is null, uses LocalVector default branding.
 */
export function buildThemedEmailWrapper(params: ThemedEmailParams): ThemedEmailResult {
  const { theme, orgName, subject, bodyHtml, previewText } = params;

  const primaryColor = theme?.primary_color ?? DEFAULT_THEME.primary_color;
  const textOnPrimary = theme?.text_on_primary ?? DEFAULT_THEME.text_on_primary;
  const showPoweredBy = theme?.show_powered_by ?? DEFAULT_THEME.show_powered_by;
  const logoUrl = theme?.logo_url ?? null;

  const previewHtml = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(previewText)}</div>`
    : '';

  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin-bottom:16px"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(orgName)}" style="max-width:150px;max-height:60px;object-fit:contain" /></div>`
    : '';

  const footerHtml = showPoweredBy
    ? `<p style="color:#6b7280;font-size:12px;text-align:center;margin-top:24px">Powered by <a href="https://localvector.ai" style="color:#6b7280;text-decoration:underline">LocalVector</a></p>`
    : `<p style="color:#6b7280;font-size:12px;text-align:center;margin-top:24px">${escapeHtml(orgName)}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
${previewHtml}
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
${logoHtml}
<div style="background:${primaryColor};color:${textOnPrimary};padding:24px;border-radius:8px 8px 0 0;text-align:center">
<h2 style="margin:0;font-size:20px;font-weight:600;color:${textOnPrimary}">${escapeHtml(orgName)}</h2>
</div>
<div style="background:#ffffff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
${bodyHtml}
</div>
${footerHtml}
</div>
</body>
</html>`;

  // Plain text version — strip HTML tags
  const text = stripHtml(bodyHtml);

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// buildThemedEmailSubject
// ---------------------------------------------------------------------------

/**
 * Returns the subject line. Subject is never modified by branding.
 */
export function buildThemedEmailSubject(
  subject: string,
  _orgName: string,
  _theme: OrgTheme | null
): string {
  return subject;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
