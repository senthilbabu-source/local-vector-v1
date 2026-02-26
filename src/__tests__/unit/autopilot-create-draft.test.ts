import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AutopilotLocationContext, DraftTrigger } from '@/lib/types/autopilot';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => 'mock-model'),
  hasApiKey: vi.fn(() => false), // default: no API key → mock mode
}));

vi.mock('ai', () => ({
  generateText: vi.fn(() => ({
    text: JSON.stringify({
      title: 'AI Generated Title',
      content: 'AI generated content about the business in the city.',
      estimated_aeo_score: 72,
      target_keywords: ['keyword1', 'keyword2'],
    }),
  })),
  jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocation(): AutopilotLocationContext {
  return {
    business_name: 'Bella Napoli',
    city: 'Austin',
    state: 'TX',
    categories: ['Italian Restaurant'],
    amenities: null,
    phone: '512-555-1234',
    website_url: 'https://bellanapoli.com',
    address_line1: '123 Main St',
    google_location_name: 'accounts/123/locations/456',
  };
}

function makeTrigger(overrides?: Partial<DraftTrigger>): DraftTrigger {
  return {
    triggerType: 'first_mover',
    triggerId: 'trigger-uuid-001',
    orgId: 'org-uuid-001',
    locationId: 'loc-uuid-001',
    context: {
      targetQuery: 'best italian restaurant in austin',
    },
    ...overrides,
  };
}

function makeMockSupabase(opts: {
  existingDraft?: unknown;
  pendingCount?: number;
  location?: unknown;
  insertResult?: { data: unknown; error: unknown };
} = {}) {
  const loc = opts.location ?? makeLocation();

  return {
    from: vi.fn((table: string) => {
      if (table === 'content_drafts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: opts.existingDraft ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
            // head: true for count
            count: 'exact',
            head: true,
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                opts.insertResult ?? {
                  data: {
                    id: 'new-draft-uuid',
                    org_id: 'org-uuid-001',
                    location_id: 'loc-uuid-001',
                    trigger_type: 'first_mover',
                    trigger_id: 'trigger-uuid-001',
                    draft_title: '[MOCK] Bella Napoli — Best Italian Restaurant in Austin',
                    draft_content: 'Mock content...',
                    target_prompt: 'best italian restaurant in austin',
                    content_type: 'faq_page',
                    aeo_score: 65,
                    status: 'draft',
                    human_approved: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                },
              ),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: loc, error: null }),
            }),
          }),
        };
      }

      if (table === 'local_occasions') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      return {};
    }),
  };
}

// We need a more granular mock for the chained Supabase calls in createDraft.
// Let's use a simpler approach: mock at the function level.

// Instead of the complex chained mock, let's test the individual functions
// and use integration-style mocks for createDraft.

// ---------------------------------------------------------------------------
// Tests for determineContentType (pure function, no mocks needed)
// ---------------------------------------------------------------------------

import { determineContentType, PENDING_DRAFT_CAP } from '@/lib/autopilot/create-draft';

describe('determineContentType', () => {
  it('returns faq_page for competitor_gap', () => {
    const trigger = makeTrigger({ triggerType: 'competitor_gap' });
    expect(determineContentType(trigger)).toBe('faq_page');
  });

  it('returns occasion_page for occasion', () => {
    const trigger = makeTrigger({ triggerType: 'occasion' });
    expect(determineContentType(trigger)).toBe('occasion_page');
  });

  it('returns faq_page for prompt_missing', () => {
    const trigger = makeTrigger({ triggerType: 'prompt_missing' });
    expect(determineContentType(trigger)).toBe('faq_page');
  });

  it('returns faq_page for first_mover', () => {
    const trigger = makeTrigger({ triggerType: 'first_mover' });
    expect(determineContentType(trigger)).toBe('faq_page');
  });

  it('returns user-selected type for manual', () => {
    const trigger = makeTrigger({
      triggerType: 'manual',
      context: { contentType: 'landing_page' },
    });
    expect(determineContentType(trigger)).toBe('landing_page');
  });

  it('defaults to blog_post for manual without contentType', () => {
    const trigger = makeTrigger({
      triggerType: 'manual',
      context: {},
    });
    expect(determineContentType(trigger)).toBe('blog_post');
  });
});

// ---------------------------------------------------------------------------
// Tests for PENDING_DRAFT_CAP constant
// ---------------------------------------------------------------------------

describe('PENDING_DRAFT_CAP', () => {
  it('is 5', () => {
    expect(PENDING_DRAFT_CAP).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Tests for buildContextBlock (exported from generate-brief)
// ---------------------------------------------------------------------------

import { buildContextBlock } from '@/lib/autopilot/generate-brief';

describe('buildContextBlock', () => {
  const location = makeLocation();

  it('builds correct context for competitor_gap', () => {
    const trigger = makeTrigger({
      triggerType: 'competitor_gap',
      context: {
        competitorName: 'Pizza Palace',
        winningFactor: 'outdoor seating',
        targetQuery: 'best italian in austin',
      },
    });
    const block = buildContextBlock(trigger, location);
    expect(block).toContain('Competitor Gap Alert');
    expect(block).toContain('Pizza Palace');
    expect(block).toContain('outdoor seating');
    expect(block).toContain('best italian in austin');
  });

  it('builds correct context for occasion', () => {
    const trigger = makeTrigger({
      triggerType: 'occasion',
      context: {
        occasionName: "Valentine's Day",
        daysUntilPeak: 14,
      },
    });
    const block = buildContextBlock(trigger, location);
    expect(block).toContain('Seasonal Occasion Alert');
    expect(block).toContain("Valentine's Day");
    expect(block).toContain('14');
  });

  it('builds correct context for prompt_missing with queries', () => {
    const trigger = makeTrigger({
      triggerType: 'prompt_missing',
      context: {
        zeroCitationQueries: ['best pasta austin', 'italian food near me'],
      },
    });
    const block = buildContextBlock(trigger, location);
    expect(block).toContain('Zero Citation');
    expect(block).toContain('best pasta austin');
    expect(block).toContain('italian food near me');
  });

  it('builds correct context for first_mover', () => {
    const trigger = makeTrigger({
      triggerType: 'first_mover',
      context: { targetQuery: 'best neapolitan pizza austin' },
    });
    const block = buildContextBlock(trigger, location);
    expect(block).toContain('First Mover Opportunity');
    expect(block).toContain('best neapolitan pizza austin');
    expect(block).toContain('No business is currently');
  });

  it('builds correct context for manual', () => {
    const trigger = makeTrigger({
      triggerType: 'manual',
      context: { additionalContext: 'Focus on our new weekend brunch menu' },
    });
    const block = buildContextBlock(trigger, location);
    expect(block).toContain('Manual Draft Request');
    expect(block).toContain('weekend brunch menu');
  });
});

// ---------------------------------------------------------------------------
// Tests for generateDraftBrief (mock mode)
// ---------------------------------------------------------------------------

import { generateDraftBrief } from '@/lib/autopilot/generate-brief';

describe('generateDraftBrief', () => {
  it('returns mock brief when OPENAI_API_KEY absent', async () => {
    const trigger = makeTrigger();
    const location = makeLocation();
    const brief = await generateDraftBrief(trigger, location, 'faq_page');

    expect(brief.title).toContain('[MOCK]');
    expect(brief.content).toBeTruthy();
    expect(brief.content.length).toBeGreaterThan(0);
    expect(brief.targetKeywords).toBeInstanceOf(Array);
    expect(brief.targetKeywords.length).toBeGreaterThan(0);
    expect(brief.estimatedAeoScore).toBeGreaterThanOrEqual(0);
    expect(brief.estimatedAeoScore).toBeLessThanOrEqual(100);
  });

  it('generates FAQ-style content for faq_page type', async () => {
    const trigger = makeTrigger();
    const location = makeLocation();
    const brief = await generateDraftBrief(trigger, location, 'faq_page');

    // Mock FAQ content should contain Q&A pairs
    expect(brief.content).toContain('Q:');
    expect(brief.content).toContain('A:');
  });

  it('includes business name and city in mock content', async () => {
    const trigger = makeTrigger();
    const location = makeLocation();
    const brief = await generateDraftBrief(trigger, location, 'blog_post');

    expect(brief.content).toContain('Bella Napoli');
    expect(brief.content).toContain('Austin');
  });
});

// ---------------------------------------------------------------------------
// Tests for archiveExpiredOccasionDrafts
// ---------------------------------------------------------------------------

import { archiveExpiredOccasionDrafts } from '@/lib/autopilot/create-draft';

describe('archiveExpiredOccasionDrafts', () => {
  it('returns 0 when no occasion drafts exist', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'content_drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    const count = await archiveExpiredOccasionDrafts(supabase);
    expect(count).toBe(0);
  });

  it('returns 0 when occasion drafts have no trigger_ids', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'content_drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ id: 'draft-1', trigger_id: null }],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    const count = await archiveExpiredOccasionDrafts(supabase);
    expect(count).toBe(0);
  });
});
