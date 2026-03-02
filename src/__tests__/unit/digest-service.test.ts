/**
 * Digest Service — Unit Tests (Sprint 117)
 *
 * 20 tests covering:
 * - shouldSendDigest() pure predicate (6 tests)
 * - buildWeeklyDigestPayload() with Supabase mocked (11 tests)
 * - getDigestRecipients() with Supabase mocked (3 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { shouldSendDigest } from '@/lib/digest/send-gate';
import {
  buildWeeklyDigestPayload,
  getDigestRecipients,
} from '@/lib/digest/digest-service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000010';
const AUTH_PROVIDER_ID = '00000000-0000-0000-0000-aaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// Chainable Supabase mock factory
//
// Each `from(table)` call returns a fresh chainable object.
// Per-table responses are supplied as an ordered queue: each `from(table)`
// call shifts the next response off the queue for that table.
// Terminal methods (.single, .maybeSingle, await) all resolve from the
// same shifted response. This handles services that call from() on the
// same table multiple times (e.g. users, sov_evaluations).
// ---------------------------------------------------------------------------

interface QueuedResponse {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

function createChainableSupabase(
  tableQueues: Record<string, QueuedResponse[]>,
) {
  const insertCalls: Record<string, unknown[]> = {};
  const callCounts: Record<string, number> = {};

  function buildChain(response: QueuedResponse) {
    const resolved = {
      data: response.data ?? null,
      error: response.error ?? null,
      count: response.count ?? null,
    };

    const chain: Record<string, unknown> = {};

    // Terminal methods — all resolve the same response
    chain.single = vi.fn().mockResolvedValue(resolved);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolved);

    // Thenable — for Promise.all direct awaits (no terminal called)
    chain.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(resolved).then(resolve, reject);

    // All filter/modifier methods return the chain
    const methods = [
      'select', 'eq', 'neq', 'in', 'is', 'not', 'gte', 'lte',
      'gt', 'lt', 'order', 'limit', 'range', 'filter',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }

    return chain;
  }

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] ?? 0) + 1;
    const queue = tableQueues[table] ?? [];
    // Shift next response off the queue (fall back to empty if exhausted)
    const response = queue.length > 0 ? queue.shift()! : { data: null };

    const selectChain = buildChain(response);

    // Insert support: insert() returns a chain whose terminal resolves
    // from the NEXT queued response for the same table (the insert result).
    const outerTable = table;
    selectChain.insert = vi.fn().mockImplementation((payload: unknown) => {
      insertCalls[outerTable] = insertCalls[outerTable] ?? [];
      insertCalls[outerTable].push(payload);
      // Shift another response for the insert result
      const insertResponse = queue.length > 0 ? queue.shift()! : { data: null };
      return buildChain(insertResponse);
    });

    return selectChain;
  });

  const supabase = { from: mockFrom } as unknown as SupabaseClient<Database>;

  return { supabase, mockFrom, insertCalls, callCounts };
}

// ---------------------------------------------------------------------------
// Default table queue builder for buildWeeklyDigestPayload
//
// Call order in the service:
//  1. from('organizations')        → .single()             org name
//  2. from('users')                → .single()             recipient email/name
//  3. from('email_preferences')    → .maybeSingle()        existing prefs (null → lazy)
//  4. from('users')                → .single()             auth_provider_id (if lazy)
//  5. from('email_preferences')    → .insert().select().single()  (if lazy)
//                                    ↳ insert consumes one queue entry
//  6. Promise.all [6 items]:
//     a. from('visibility_analytics') → .maybeSingle()     current SOV
//     b. from('visibility_analytics') → .maybeSingle()     previous SOV
//     c. from('sov_evaluations')      → thenable           cited evals (array)
//     d. from('sov_evaluations')      → thenable           missed evals (array)
//     e. from('content_drafts')       → .maybeSingle()     first mover draft
//     f. from('org_themes')           → .maybeSingle()     theme
//  7. from('target_queries')         → thenable            cited query texts
//  8. from('target_queries')         → thenable            missed query texts
//  9. from('sov_evaluations')        → thenable            total count
// 10. from('sov_evaluations')        → thenable            cited count
// ---------------------------------------------------------------------------

interface PayloadOverrides {
  orgName?: string;
  recipientEmail?: string;
  recipientName?: string | null;
  authProviderId?: string | null;
  existingPrefsToken?: string | null; // non-null skips lazy creation
  insertedPrefsToken?: string;
  currentSov?: number;
  previousSov?: number;
  citedEvals?: { query_id: string; created_at: string }[];
  missedEvals?: { query_id: string; mentioned_competitors: string[] | null }[];
  firstMoverDraft?: { draft_title: string; target_prompt: string | null; created_at: string } | null;
  theme?: { logo_url: string | null; primary_color: string; text_on_primary: string } | null;
  citedQueryTexts?: { id: string; query_text: string }[];
  missedQueryTexts?: { id: string; query_text: string }[];
  totalQueryCount?: number;
  citedQueryCount?: number;
}

function makePayloadQueues(o: PayloadOverrides = {}): Record<string, QueuedResponse[]> {
  const orgName = o.orgName ?? 'Test Restaurant';
  const recipientEmail = o.recipientEmail ?? 'owner@example.com';
  const recipientName = o.recipientName !== undefined ? o.recipientName : 'Jane Owner';
  const authProviderId = o.authProviderId !== undefined ? o.authProviderId : AUTH_PROVIDER_ID;
  const existingPrefs = o.existingPrefsToken !== undefined && o.existingPrefsToken !== null
    ? { unsubscribe_token: o.existingPrefsToken }
    : null;
  const insertedToken = o.insertedPrefsToken ?? 'tok_abc123';
  const currentSov = o.currentSov ?? 0.42;
  const previousSov = o.previousSov ?? 0.38;
  const citedEvals = o.citedEvals ?? [
    { query_id: 'q1', created_at: '2026-03-01T10:00:00Z' },
    { query_id: 'q2', created_at: '2026-03-01T09:00:00Z' },
  ];
  const missedEvals = o.missedEvals ?? [
    { query_id: 'q3', mentioned_competitors: ['Competitor A'] },
  ];
  const firstMover = o.firstMoverDraft !== undefined ? o.firstMoverDraft : null;
  const theme = o.theme !== undefined
    ? o.theme
    : { logo_url: 'https://example.com/logo.png', primary_color: '#ff0000', text_on_primary: '#000000' };
  const citedQTexts = o.citedQueryTexts ?? [
    { id: 'q1', query_text: 'best pizza downtown' },
    { id: 'q2', query_text: 'italian restaurant near me' },
  ];
  const missedQTexts = o.missedQueryTexts ?? [
    { id: 'q3', query_text: 'pizza delivery late night' },
  ];
  const totalCount = o.totalQueryCount ?? 10;
  const citedCount = o.citedQueryCount ?? 2;

  // Build email_preferences queue based on whether prefs exist
  const emailPrefsQueue: QueuedResponse[] = existingPrefs
    ? [{ data: existingPrefs }] // prefs found, no lazy create needed (no further calls)
    : [
        { data: null }, // #3 maybeSingle → null (triggers lazy create)
        { data: null }, // #5a from() call shifts this (unused — insert() is called next)
        // #5b insert() handler shifts this for the insert result:
        { data: { unsubscribe_token: insertedToken } },
      ];

  // Build users queue — 2 calls if lazy create, 1 if prefs exist
  const usersQueue: QueuedResponse[] = existingPrefs
    ? [
        { data: { email: recipientEmail, full_name: recipientName } }, // #2
      ]
    : [
        { data: { email: recipientEmail, full_name: recipientName } }, // #2
        { data: { auth_provider_id: authProviderId } }, // #4
      ];

  return {
    organizations: [
      { data: { name: orgName } }, // #1
    ],
    users: usersQueue,
    email_preferences: emailPrefsQueue,
    visibility_analytics: [
      { data: { share_of_voice: currentSov } },  // #6a current
      { data: { share_of_voice: previousSov } },  // #6b previous
    ],
    sov_evaluations: [
      { data: citedEvals },    // #6c cited
      { data: missedEvals },   // #6d missed
      { data: null, count: totalCount },  // #9 total count
      { data: null, count: citedCount },  // #10 cited count
    ],
    content_drafts: [
      { data: firstMover }, // #6e
    ],
    org_themes: [
      { data: theme }, // #6f
    ],
    target_queries: [
      { data: citedQTexts },  // #7
      { data: missedQTexts }, // #8
    ],
  };
}

// ---------------------------------------------------------------------------
// shouldSendDigest — pure
// ---------------------------------------------------------------------------

describe('shouldSendDigest — pure', () => {
  it('1. is_first_digest = true -> should_send = true (always)', () => {
    const result = shouldSendDigest({
      sov_delta: 0,
      has_first_mover_alert: false,
      is_first_digest: true,
    });

    expect(result.should_send).toBe(true);
    expect(result.reason).toBe('first_digest');
  });

  it('2. sov_delta >= 2 -> should_send = true', () => {
    const result = shouldSendDigest({
      sov_delta: 5,
      has_first_mover_alert: false,
      is_first_digest: false,
    });

    expect(result.should_send).toBe(true);
    expect(result.reason).toBe('significant_sov_change');
  });

  it('3. sov_delta <= -2 -> should_send = true (negative change also significant)', () => {
    const result = shouldSendDigest({
      sov_delta: -3,
      has_first_mover_alert: false,
      is_first_digest: false,
    });

    expect(result.should_send).toBe(true);
    expect(result.reason).toBe('significant_sov_change');
  });

  it('4. |sov_delta| < 2 AND no alert AND not first -> should_send = false', () => {
    const result = shouldSendDigest({
      sov_delta: 1,
      has_first_mover_alert: false,
      is_first_digest: false,
    });

    expect(result.should_send).toBe(false);
  });

  it('5. has_first_mover_alert = true -> should_send = true regardless of delta', () => {
    const result = shouldSendDigest({
      sov_delta: 0,
      has_first_mover_alert: true,
      is_first_digest: false,
    });

    expect(result.should_send).toBe(true);
    expect(result.reason).toBe('first_mover_alert');
  });

  it('6. returns skip_reason when should_send = false', () => {
    const result = shouldSendDigest({
      sov_delta: 0,
      has_first_mover_alert: false,
      is_first_digest: false,
    });

    expect(result.should_send).toBe(false);
    expect(result.reason).toBe('send_gate_not_met');
  });
});

// ---------------------------------------------------------------------------
// buildWeeklyDigestPayload — Supabase mocked
// ---------------------------------------------------------------------------

describe('buildWeeklyDigestPayload — Supabase mocked', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('7. includes org name from organizations table', async () => {
    const queues = makePayloadQueues({ orgName: 'Mama Mia Pizzeria' });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.org_name).toBe('Mama Mia Pizzeria');
  });

  it('8. includes recipient email from users table', async () => {
    const queues = makePayloadQueues({
      recipientEmail: 'chef@example.com',
      recipientName: 'Chef Gordon',
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.recipient_email).toBe('chef@example.com');
    expect(payload.recipient_name).toBe('Chef Gordon');
  });

  it('9. creates email_preferences row if not exists (lazy creation)', async () => {
    const queues = makePayloadQueues({
      existingPrefsToken: null, // triggers lazy create
      insertedPrefsToken: 'tok_lazy_created',
    });
    const { supabase, insertCalls } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.unsubscribe_token).toBe('tok_lazy_created');
    expect(insertCalls['email_preferences']).toBeDefined();
    expect(insertCalls['email_preferences'].length).toBeGreaterThanOrEqual(1);
    // Verify the insert payload includes auth_provider_id and org_id
    const insertPayload = insertCalls['email_preferences'][0] as Record<string, unknown>;
    expect(insertPayload.user_id).toBe(AUTH_PROVIDER_ID);
    expect(insertPayload.org_id).toBe(ORG_ID);
  });

  it('10. sov_trend.delta = current - previous sov', async () => {
    const queues = makePayloadQueues({
      currentSov: 0.50,  // 50%
      previousSov: 0.40, // 40%
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.sov_trend.current_sov).toBe(50);
    expect(payload.sov_trend.previous_sov).toBe(40);
    expect(payload.sov_trend.delta).toBe(10);
  });

  it('11. sov_trend.trend = "up" when delta >= 2', async () => {
    const queues = makePayloadQueues({
      currentSov: 0.50,  // 50%
      previousSov: 0.40, // 40% => delta = 10
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.sov_trend.trend).toBe('up');
  });

  it('12. sov_trend.trend = "down" when delta <= -2', async () => {
    const queues = makePayloadQueues({
      currentSov: 0.30,  // 30%
      previousSov: 0.45, // 45% => delta = -15
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.sov_trend.trend).toBe('down');
    expect(payload.sov_trend.delta).toBeLessThanOrEqual(-2);
  });

  it('13. sov_trend.trend = "flat" when |delta| < 2', async () => {
    const queues = makePayloadQueues({
      currentSov: 0.41,  // 41%
      previousSov: 0.40, // 40% => delta = 1
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.sov_trend.trend).toBe('flat');
    expect(Math.abs(payload.sov_trend.delta)).toBeLessThan(2);
  });

  it('14. citations capped at 5', async () => {
    // Service uses .limit(5) on the sov_evaluations query.
    // Supply exactly 5 cited evals — the service passes all through.
    const fiveCited = Array.from({ length: 5 }, (_, i) => ({
      query_id: `q${i}`,
      created_at: `2026-03-01T0${i}:00:00Z`,
    }));
    const fiveQueryTexts = Array.from({ length: 5 }, (_, i) => ({
      id: `q${i}`,
      query_text: `Query ${i}`,
    }));
    const queues = makePayloadQueues({
      citedEvals: fiveCited,
      missedEvals: [],
      citedQueryTexts: fiveQueryTexts,
      missedQueryTexts: [],
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    // DB limit(5) enforces cap; service trusts it
    expect(payload.citations).toHaveLength(5);
    expect(payload.citations[0].query_text).toBe('Query 0');
  });

  it('15. missed_queries capped at 3', async () => {
    // Provide 6 unique missed evals — service deduplicates and slices to 3
    const sixMissed = Array.from({ length: 6 }, (_, i) => ({
      query_id: `mq${i}`,
      mentioned_competitors: i < 3 ? ['Rival'] : [],
    }));
    const sixQueryTexts = Array.from({ length: 6 }, (_, i) => ({
      id: `mq${i}`,
      query_text: `Missed query ${i}`,
    }));
    const queues = makePayloadQueues({
      citedEvals: [],
      missedEvals: sixMissed,
      citedQueryTexts: [],
      missedQueryTexts: sixQueryTexts,
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    // Service caps at 3 via .slice(0, 3) after dedup + sort
    expect(payload.missed_queries.length).toBeLessThanOrEqual(3);
    expect(payload.missed_queries.length).toBe(3);
  });

  it('16. first_mover_alert = null when no unactioned alerts', async () => {
    const queues = makePayloadQueues({ firstMoverDraft: null });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.first_mover_alert).toBeNull();
  });

  it('17. first_mover_alert populated from content_drafts with trigger_type="first_mover"', async () => {
    const queues = makePayloadQueues({
      firstMoverDraft: {
        draft_title: 'New trend: vegan pizza',
        target_prompt: 'best vegan pizza in town',
        created_at: '2026-03-01T08:00:00Z',
      },
    });
    const { supabase } = createChainableSupabase(queues);

    const payload = await buildWeeklyDigestPayload(supabase, ORG_ID, USER_ID);

    expect(payload.first_mover_alert).not.toBeNull();
    expect(payload.first_mover_alert!.query_text).toBe('best vegan pizza in town');
    expect(payload.first_mover_alert!.detected_at).toBe('2026-03-01T08:00:00Z');
    expect(payload.first_mover_alert!.action_url).toContain(
      encodeURIComponent('best vegan pizza in town'),
    );
  });
});

// ---------------------------------------------------------------------------
// getDigestRecipients — Supabase mocked
// ---------------------------------------------------------------------------

describe('getDigestRecipients — Supabase mocked', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('18. returns all non-unsubscribed org members', async () => {
    const queues: Record<string, QueuedResponse[]> = {
      memberships: [
        {
          data: [
            { user_id: 'u1' },
            { user_id: 'u2' },
          ],
        },
      ],
      users: [
        {
          data: [
            { id: 'u1', email: 'alice@example.com', full_name: 'Alice', auth_provider_id: 'auth1' },
            { id: 'u2', email: 'bob@example.com', full_name: 'Bob', auth_provider_id: 'auth2' },
          ],
        },
      ],
      email_preferences: [
        { data: [] }, // no one unsubscribed
      ],
    };
    const { supabase } = createChainableSupabase(queues);

    const recipients = await getDigestRecipients(supabase, ORG_ID);

    expect(recipients).toHaveLength(2);
    expect(recipients.map((r) => r.email).sort()).toEqual([
      'alice@example.com',
      'bob@example.com',
    ]);
  });

  it('19. excludes members with digest_unsubscribed = true', async () => {
    const queues: Record<string, QueuedResponse[]> = {
      memberships: [
        {
          data: [
            { user_id: 'u1' },
            { user_id: 'u2' },
            { user_id: 'u3' },
          ],
        },
      ],
      users: [
        {
          data: [
            { id: 'u1', email: 'alice@example.com', full_name: 'Alice', auth_provider_id: 'auth1' },
            { id: 'u2', email: 'bob@example.com', full_name: 'Bob', auth_provider_id: 'auth2' },
            { id: 'u3', email: 'carol@example.com', full_name: 'Carol', auth_provider_id: 'auth3' },
          ],
        },
      ],
      email_preferences: [
        // Bob (auth2) is unsubscribed
        { data: [{ user_id: 'auth2' }] },
      ],
    };
    const { supabase } = createChainableSupabase(queues);

    const recipients = await getDigestRecipients(supabase, ORG_ID);

    expect(recipients).toHaveLength(2);
    const emails = recipients.map((r) => r.email);
    expect(emails).toContain('alice@example.com');
    expect(emails).toContain('carol@example.com');
    expect(emails).not.toContain('bob@example.com');
  });

  it('20. includes members with no email_preferences row (default = subscribed)', async () => {
    const queues: Record<string, QueuedResponse[]> = {
      memberships: [
        {
          data: [
            { user_id: 'u1' },
            { user_id: 'u2' },
          ],
        },
      ],
      users: [
        {
          data: [
            { id: 'u1', email: 'alice@example.com', full_name: 'Alice', auth_provider_id: 'auth1' },
            { id: 'u2', email: 'bob@example.com', full_name: null, auth_provider_id: 'auth2' },
          ],
        },
      ],
      email_preferences: [
        { data: [] }, // empty — no preferences rows exist at all
      ],
    };
    const { supabase } = createChainableSupabase(queues);

    const recipients = await getDigestRecipients(supabase, ORG_ID);

    // Both should be included (no unsubscribe row = subscribed by default)
    expect(recipients).toHaveLength(2);
    expect(recipients[0].email).toBe('alice@example.com');
    expect(recipients[1].email).toBe('bob@example.com');
    expect(recipients[1].full_name).toBeNull();
  });
});
