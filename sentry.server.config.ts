// ---------------------------------------------------------------------------
// sentry.server.config.ts — Sentry server-side initialisation
//
// Loaded via instrumentation.ts register() hook during server startup.
// NEXT_PUBLIC_SENTRY_DSN must be set in .env.local and Vercel dashboard.
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

/** §322: Scrub PII from Sentry event extras before transmission. */
const PII_KEYS = new Set(['email', 'password', 'access_token', 'refresh_token', 'token', 'secret']);

function scrubPII(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = scrubPII(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions sampled for performance monitoring.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Silence Sentry when DSN is not set (local dev, CI).
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // §322: Strip PII (email, tokens, passwords) from error reports
  beforeSend(event) {
    if (event.extra) {
      event.extra = scrubPII(event.extra as Record<string, unknown>);
    }
    if (event.contexts) {
      for (const [ctxKey, ctxVal] of Object.entries(event.contexts)) {
        if (ctxVal && typeof ctxVal === 'object') {
          event.contexts[ctxKey] = scrubPII(ctxVal as Record<string, unknown>);
        }
      }
    }
    return event;
  },
});
