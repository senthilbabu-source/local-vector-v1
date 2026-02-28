// ---------------------------------------------------------------------------
// sentry.server.config.ts — Sentry server-side initialisation
//
// Loaded via instrumentation.ts register() hook during server startup.
// NEXT_PUBLIC_SENTRY_DSN must be set in .env.local and Vercel dashboard.
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions sampled for performance monitoring.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Silence Sentry when DSN is not set (local dev, CI).
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
