// ---------------------------------------------------------------------------
// sentry.server.config.ts — Sentry Node.js/server initialisation (Sprint 26A)
//
// Loaded by @sentry/nextjs instrumentation in the Node.js server context.
// NEXT_PUBLIC_SENTRY_DSN must be set in .env.local and Vercel dashboard.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sample 10% of server-side transactions.
  tracesSampleRate: 0.1,

  // Silence in dev unless DSN is explicitly set.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
