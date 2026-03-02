// ---------------------------------------------------------------------------
// sentry.client.config.ts — Sentry browser-side initialisation (Sprint 118)
//
// Auto-loaded by @sentry/nextjs webpack plugin.
// NEXT_PUBLIC_SENTRY_DSN must be set in .env.local and Vercel dashboard.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions sampled for performance monitoring.
  tracesSampleRate: 0.1,

  // Only enable in production — no noise in dev.
  enabled: process.env.NODE_ENV === 'production',

  // Filter out localhost events that slip through.
  beforeSend(event) {
    if (event.request?.url?.includes('localhost')) return null;
    return event;
  },
});
