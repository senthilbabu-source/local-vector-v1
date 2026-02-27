// ---------------------------------------------------------------------------
// Inngest: Google Places Detail Refresh — Daily ToS compliance
//
// Sprint 90: Dispatched by /api/cron/refresh-places.
// Refreshes stale Place Details for active-plan orgs.
// ---------------------------------------------------------------------------

import { inngest } from '@/lib/inngest/client';
import { refreshStalePlaceDetails } from '@/lib/services/places-refresh';

export const placesRefreshCron = inngest.createFunction(
  { id: 'places-refresh-daily', name: 'Google Places Refresh (Daily)' },
  { event: 'cron/places-refresh.daily' },
  async ({ step }) => {
    const result = await step.run('refresh-stale-places', async () => {
      return refreshStalePlaceDetails();
    });

    return result;
  },
);
