// ---------------------------------------------------------------------------
// sentry.edge.config.ts — Sentry Edge runtime initialisation (Sprint 26A)
//
// Loaded by @sentry/nextjs instrumentation in the Edge runtime context
// (middleware, Edge API routes). Subset of features available vs Node.js SDK.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
