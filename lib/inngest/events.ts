// ---------------------------------------------------------------------------
// lib/inngest/events.ts — Typed event definitions for Inngest
//
// Every Inngest event the system can send or trigger. Used by the client
// for type-safe `.send()` calls and by functions for typed handlers.
// ---------------------------------------------------------------------------

export type Events = {
  /** Triggered by Vercel Cron → SOV cron route dispatcher. Fetches own data. */
  'cron/sov.weekly': {
    data: Record<string, never>;
  };

  /** Triggered by Vercel Cron → Audit cron route dispatcher. Fetches own data. */
  'cron/audit.daily': {
    data: Record<string, never>;
  };

  /** Triggered by Vercel Cron → Content Audit cron route dispatcher. Fetches own data. */
  'cron/content-audit.monthly': {
    data: Record<string, never>;
  };

  /** Triggered after a content draft is published. Schedules a 14-day SOV re-check. */
  'publish/post-publish-check': {
    data: {
      draftId: string;
      locationId: string;
      targetQuery: string;
      publishedAt: string;
    };
  };

  /** Triggered by Vercel Cron → Weekly Digest cron route dispatcher. Fetches own data. */
  'cron/digest.weekly': {
    data: Record<string, never>;
  };

  /** Sprint 90: Triggered by Vercel Cron → refresh-gbp-tokens. Proactive token refresh. */
  'cron/gbp-token-refresh.hourly': {
    data: Record<string, never>;
  };

  /** Sprint 90: Triggered by Vercel Cron → refresh-places. Google ToS compliance. */
  'cron/places-refresh.daily': {
    data: Record<string, never>;
  };
};
