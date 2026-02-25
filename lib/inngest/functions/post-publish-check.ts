// ---------------------------------------------------------------------------
// lib/inngest/functions/post-publish-check.ts — Post-Publish SOV Re-Check
//
// Replaces Redis-based scheduling in lib/autopilot/post-publish.ts with a
// durable Inngest step.sleep('14d'). After a content draft is published,
// this function waits 14 days, then re-runs the target SOV query to check
// if the business is now cited.
//
// Event: 'publish/post-publish-check'
//
// Advantage over Redis: step.sleep is durable — survives deploys, restarts,
// and infrastructure changes. No Redis dependency, no TTL management.
// ---------------------------------------------------------------------------

import { inngest } from '../client';
import { runSOVQuery } from '@/lib/services/sov-engine.service';

// ---------------------------------------------------------------------------
// Inngest function definition
// ---------------------------------------------------------------------------

export const postPublishCheckFunction = inngest.createFunction(
  {
    id: 'post-publish-sov-check',
    retries: 2,
  },
  { event: 'publish/post-publish-check' },
  async ({ event, step }) => {
    // Wait 14 days (Inngest handles this natively — durable sleep)
    await step.sleep('wait-14-days', '14d');

    // Run the SOV query
    const result = await step.run('recheck-sov', async () => {
      const sovResult = await runSOVQuery({
        id: event.data.draftId,
        query_text: event.data.targetQuery,
        query_category: 'discovery',
        location_id: event.data.locationId,
        org_id: '',
        locations: { business_name: '', city: null, state: null },
      });

      console.log(
        `[inngest-post-publish] Draft ${event.data.draftId}: ` +
        `query="${event.data.targetQuery}" cited=${sovResult.ourBusinessCited}`,
      );

      return {
        draftId: event.data.draftId,
        targetQuery: event.data.targetQuery,
        cited: sovResult.ourBusinessCited,
        publishedAt: event.data.publishedAt,
        checkedAt: new Date().toISOString(),
      };
    });

    return result;
  },
);
