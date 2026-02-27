// ---------------------------------------------------------------------------
// Inngest: GBP Token Refresh — Hourly proactive token refresh
//
// Sprint 90: Dispatched by /api/cron/refresh-gbp-tokens.
// Finds tokens expiring within 1 hour and refreshes them.
// ---------------------------------------------------------------------------

import { inngest } from '@/lib/inngest/client';
import { refreshExpiringTokens } from '@/lib/services/gbp-token-refresh';

export const tokenRefreshCron = inngest.createFunction(
  { id: 'gbp-token-refresh-hourly', name: 'GBP Token Refresh (Hourly)' },
  { event: 'cron/gbp-token-refresh.hourly' },
  async ({ step }) => {
    const result = await step.run('refresh-expiring-tokens', async () => {
      return refreshExpiringTokens(60);
    });

    return result;
  },
);
