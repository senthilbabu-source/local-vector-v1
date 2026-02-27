// ---------------------------------------------------------------------------
// app/api/inngest/route.ts — Inngest webhook handler
//
// Single endpoint that Inngest calls to execute all registered functions.
// Functions are registered in the serve() call below.
//
// Docs: https://www.inngest.com/docs/reference/serve
// ---------------------------------------------------------------------------

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sovCronFunction } from '@/lib/inngest/functions/sov-cron';
import { auditCronFunction } from '@/lib/inngest/functions/audit-cron';
import { contentAuditCronFunction } from '@/lib/inngest/functions/content-audit-cron';
import { postPublishCheckFunction } from '@/lib/inngest/functions/post-publish-check';
import { weeklyDigestCron } from '@/lib/inngest/functions/weekly-digest-cron';
import { tokenRefreshCron } from '@/lib/inngest/functions/token-refresh-cron';
import { placesRefreshCron } from '@/lib/inngest/functions/places-refresh-cron';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sovCronFunction,
    auditCronFunction,
    contentAuditCronFunction,
    postPublishCheckFunction,
    weeklyDigestCron,
    tokenRefreshCron,
    placesRefreshCron,
  ],
});

// Vercel Pro: 60s per step invocation
export const maxDuration = 60;
