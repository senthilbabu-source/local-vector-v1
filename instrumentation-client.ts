// ---------------------------------------------------------------------------
// instrumentation-client.ts — Sentry browser/client initialisation
//
// Next.js 16 convention: this file is auto-loaded in the browser context.
// Replaces the legacy sentry.client.config.ts file.
// NEXT_PUBLIC_SENTRY_DSN must be set in .env.local and Vercel dashboard.
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [Sentry.replayIntegration()],

  // 10% of transactions sampled for performance monitoring.
  // Increase to 1.0 (100%) for debugging, lower in high-traffic prod.
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Capture replays for 10% of sessions; 100% when an error occurs.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Silence Sentry when DSN is not set (local dev, CI).
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
