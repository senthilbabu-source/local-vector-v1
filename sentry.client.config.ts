// ---------------------------------------------------------------------------
// sentry.client.config.ts — Sentry browser/client initialisation (Sprint 26A)
//
// Loaded by @sentry/nextjs instrumentation in the browser context.
// NEXT_PUBLIC_SENTRY_DSN must be set in .env.local and Vercel dashboard.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions sampled for performance monitoring.
  // Increase to 1.0 (100%) for debugging, lower in high-traffic prod.
  tracesSampleRate: 0.1,

  // Capture replays for 10% of sessions; 100% when an error occurs.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Silence Sentry in development unless the DSN is explicitly set.
  // This prevents noise during local dev when NEXT_PUBLIC_SENTRY_DSN is empty.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
