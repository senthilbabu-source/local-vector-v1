#!/usr/bin/env npx tsx
// ---------------------------------------------------------------------------
// scripts/test-inngest-dispatch.ts — Manual Inngest Event Dispatcher
//
// Sends test events to Inngest for production verification.
// Supports --dry-run flag to preview without sending.
//
// Usage:
//   npx tsx scripts/test-inngest-dispatch.ts                     # send all events
//   npx tsx scripts/test-inngest-dispatch.ts --dry-run           # preview only
//   npx tsx scripts/test-inngest-dispatch.ts --event audit       # send single event
//   npx tsx scripts/test-inngest-dispatch.ts --event sov         # send single event
//
// Required env vars:
//   INNGEST_EVENT_KEY — Inngest event API key (from Inngest dashboard)
//   INNGEST_API_URL   — Optional. Defaults to https://inn.gs/e/
// ---------------------------------------------------------------------------

const INNGEST_API_URL = process.env.INNGEST_API_URL ?? 'https://inn.gs/e/';
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;

interface TestEvent {
  name: string;
  label: string;
  data: Record<string, unknown>;
}

const TEST_EVENTS: TestEvent[] = [
  {
    name: 'cron/audit.daily',
    label: 'Audit Daily Cron',
    data: {},
  },
  {
    name: 'cron/sov.weekly',
    label: 'SOV Weekly Cron',
    data: {},
  },
  {
    name: 'cron/content-audit.monthly',
    label: 'Content Audit Monthly Cron',
    data: {},
  },
  {
    name: 'publish/post-publish-check',
    label: 'Post-Publish SOV Check',
    data: {
      draftId: 'test-draft-00000000',
      locationId: 'test-location-00000000',
      targetQuery: 'best restaurant Alpharetta GA',
      publishedAt: new Date().toISOString(),
    },
  },
];

// ── Parse args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const eventFilter = args.includes('--event')
  ? args[args.indexOf('--event') + 1]?.toLowerCase()
  : null;

function matchesFilter(event: TestEvent): boolean {
  if (!eventFilter) return true;
  return (
    event.name.toLowerCase().includes(eventFilter) ||
    event.label.toLowerCase().includes(eventFilter)
  );
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Inngest Test Dispatch ===\n');

  if (dryRun) {
    console.log('MODE: --dry-run (no events will be sent)\n');
  }

  if (!dryRun && !INNGEST_EVENT_KEY) {
    console.error('ERROR: INNGEST_EVENT_KEY is not set. Use --dry-run to preview.');
    process.exit(1);
  }

  const events = TEST_EVENTS.filter(matchesFilter);

  if (events.length === 0) {
    console.error(`No events match filter: "${eventFilter}"`);
    console.log('Available events:', TEST_EVENTS.map((e) => e.name).join(', '));
    process.exit(1);
  }

  for (const event of events) {
    console.log(`[${event.label}] ${event.name}`);
    console.log(`  Data: ${JSON.stringify(event.data)}`);

    if (dryRun) {
      console.log('  -> SKIPPED (dry run)\n');
      continue;
    }

    try {
      const url = `${INNGEST_API_URL}${INNGEST_EVENT_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: event.name,
          data: event.data,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`  -> FAILED (${response.status}): ${text}\n`);
      } else {
        console.log(`  -> SENT (${response.status})\n`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  -> ERROR: ${msg}\n`);
    }
  }

  console.log('=== Done ===');
}

main().catch(console.error);
