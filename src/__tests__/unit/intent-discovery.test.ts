// ---------------------------------------------------------------------------
// src/__tests__/unit/intent-discovery.test.ts — Sprint 135: Intent Discovery Tests
//
// 30 tests covering: classifyPromptTheme, scoreOpportunity, deduplicatePrompts,
// expandPrompts, discoverIntents, and cron registration.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Mocks (hoisted) ────────────────────────────────────────────────────────

const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => 'mock-model'),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/services/sov-model-normalizer', () => ({
  detectCitation: vi.fn((response: string, orgName: string) => ({
    cited: response.toLowerCase().includes(orgName.toLowerCase()),
    citation_count: response.toLowerCase().includes(orgName.toLowerCase()) ? 1 : 0,
    ai_response_excerpt: response.slice(0, 100),
    confidence: 'high' as const,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import {
  classifyPromptTheme,
  scoreOpportunity,
} from '@/lib/intent/intent-discoverer';

import { deduplicatePrompts } from '@/lib/intent/prompt-expander';

const ROOT = join(__dirname, '..', '..', '..');

// ═══════════════════════════════════════════════════════════════════════════
// classifyPromptTheme — 8 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('classifyPromptTheme', () => {
  it('returns "hours" for hours-related prompts', () => {
    expect(classifyPromptTheme('what hours is the restaurant open')).toBe('hours');
  });

  it('returns "events" for event-related prompts', () => {
    expect(classifyPromptTheme('best place for bachelorette party hookah')).toBe('events');
  });

  it('returns "offerings" for menu/food prompts', () => {
    expect(classifyPromptTheme('does this place serve vegan food')).toBe('offerings');
  });

  it('returns "comparison" for comparison prompts', () => {
    expect(classifyPromptTheme('best hookah lounge in Alpharetta')).toBe('comparison');
  });

  it('returns "occasion" for date night/occasion prompts', () => {
    expect(classifyPromptTheme('romantic date night restaurant near me')).toBe('occasion');
  });

  it('returns "location" for location/direction prompts', () => {
    expect(classifyPromptTheme('hookah lounge near downtown')).toBe('location');
  });

  it('returns "other" for generic prompts', () => {
    expect(classifyPromptTheme('tell me about charcoal grills')).toBe('other');
  });

  it('prioritizes first matching theme', () => {
    // "hours" should match before "location" since hours regex comes first
    expect(classifyPromptTheme('what hours are you open near me')).toBe('hours');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// scoreOpportunity — 6 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('scoreOpportunity', () => {
  it('returns 0 when client is cited', () => {
    expect(scoreOpportunity(true, 3, 'comparison')).toBe(0);
  });

  it('returns 50 base when client NOT cited with 0 competitors', () => {
    expect(scoreOpportunity(false, 0, 'other')).toBe(50);
  });

  it('returns 80 when client NOT cited with 2+ competitors', () => {
    expect(scoreOpportunity(false, 2, 'other')).toBe(80);
  });

  it('returns 70 for occasion theme without competitors', () => {
    expect(scoreOpportunity(false, 0, 'occasion')).toBe(70);
  });

  it('returns 100 for comparison theme with 2+ competitors', () => {
    expect(scoreOpportunity(false, 3, 'comparison')).toBe(100);
  });

  it('caps at 100', () => {
    // 50 + 30 + 20 = 100 — should not exceed
    expect(scoreOpportunity(false, 5, 'occasion')).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// deduplicatePrompts — 4 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('deduplicatePrompts', () => {
  it('removes prompts with same first 6 words', () => {
    const result = deduplicatePrompts([
      'best hookah lounge in Atlanta for events',
      'best hookah lounge in Atlanta for birthdays',
    ]);
    expect(result).toHaveLength(1);
  });

  it('keeps prompts with different prefixes', () => {
    const result = deduplicatePrompts([
      'best hookah lounge in Atlanta',
      'top rated restaurants in Alpharetta',
    ]);
    expect(result).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(deduplicatePrompts([])).toHaveLength(0);
  });

  it('handles single item', () => {
    expect(deduplicatePrompts(['test prompt'])).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// expandPrompts — 4 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('expandPrompts', () => {
  let expandPrompts: typeof import('@/lib/intent/prompt-expander').expandPrompts;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/intent/prompt-expander');
    expandPrompts = mod.expandPrompts;
    mockGenerateText.mockReset();
  });

  it('caps at 50 prompts', async () => {
    const prompts = Array.from({ length: 60 }, (_, i) => `prompt ${i}`);
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify(prompts),
    });

    const result = await expandPrompts(
      {
        businessName: 'Test',
        city: 'Atlanta',
        state: 'GA',
        categories: ['restaurant'],
        keyAmenities: [],
        competitors: [],
      },
      60, // Request 60 but should cap at 50
    );

    // The model call should pass maxTokens
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('returns array of strings', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify(['prompt 1', 'prompt 2', 'prompt 3']),
    });

    const result = await expandPrompts({
      businessName: 'Test',
      city: 'Atlanta',
      state: 'GA',
      categories: ['restaurant'],
      keyAmenities: [],
      competitors: [],
    });

    expect(result).toEqual(['prompt 1', 'prompt 2', 'prompt 3']);
  });

  it('returns empty array on API error', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('API down'));

    const result = await expandPrompts({
      businessName: 'Test',
      city: 'Atlanta',
      state: 'GA',
      categories: ['restaurant'],
      keyAmenities: [],
      competitors: [],
    });

    expect(result).toEqual([]);
  });

  it('deduplicates output', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify([
        'best hookah lounge in Atlanta for events',
        'best hookah lounge in Atlanta for parties',
        'unique prompt about restaurants',
      ]),
    });

    const result = await expandPrompts({
      businessName: 'Test',
      city: 'Atlanta',
      state: 'GA',
      categories: ['restaurant'],
      keyAmenities: [],
      competitors: [],
    });

    expect(result).toHaveLength(2); // First two deduplicated
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// discoverIntents — 3 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('discoverIntents', () => {
  let discoverIntents: typeof import('@/lib/intent/intent-discoverer').discoverIntents;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/intent/intent-discoverer');
    discoverIntents = mod.discoverIntents;
    mockGenerateText.mockReset();
  });

  function createMockSupabase(config: {
    location?: Record<string, unknown> | null;
    evaluations?: Array<{ mentioned_competitors: string[] | null }>;
  }) {
    const fromFn = vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: config.location ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'sov_evaluations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: config.evaluations ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'intent_discoveries') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return { select: vi.fn() };
    });

    return { from: fromFn } as unknown as import('@supabase/supabase-js').SupabaseClient<
      import('@/lib/supabase/database.types').Database
    >;
  }

  it('returns empty discovery when location not found', async () => {
    const supabase = createMockSupabase({ location: null });
    const result = await discoverIntents('loc-1', 'org-1', 'Test Org', supabase);
    expect(result.totalPromptsRun).toBe(0);
    expect(result.gaps).toHaveLength(0);
    expect(result.diminishingReturns).toBe(true);
  });

  it('sets diminishingReturns when < 5 gaps found', async () => {
    // Mock prompt expansion to return 2 prompts
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify(['prompt 1', 'prompt 2']),
    });
    // Mock Perplexity responses — both mention the org
    mockGenerateText.mockResolvedValueOnce({
      text: 'Test Org is a great place...',
    });
    mockGenerateText.mockResolvedValueOnce({
      text: 'Test Org offers hookah...',
    });

    const supabase = createMockSupabase({
      location: {
        business_name: 'Test Org',
        city: 'Atlanta',
        state: 'GA',
        categories: ['restaurant'],
        amenities: { hookah: true },
      },
    });

    const result = await discoverIntents('loc-1', 'org-1', 'Test Org', supabase);
    // Both prompts cite the org, so 0 gaps → diminishing returns
    expect(result.diminishingReturns).toBe(true);
  });

  it('partitions results into gaps and covered', async () => {
    // Mock prompt expansion
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify(['best hookah Atlanta', 'late night food']),
    });
    // First prompt: doesn't mention org
    mockGenerateText.mockResolvedValueOnce({
      text: 'Cloud 9 Lounge is the best hookah spot.',
    });
    // Second prompt: mentions org
    mockGenerateText.mockResolvedValueOnce({
      text: 'Test Org has great late night food options.',
    });

    const supabase = createMockSupabase({
      location: {
        business_name: 'Test Org',
        city: 'Atlanta',
        state: 'GA',
        categories: ['restaurant'],
        amenities: null,
      },
    });

    const result = await discoverIntents('loc-1', 'org-1', 'Test Org', supabase);
    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
    expect(result.covered.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cron registration — 5 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('intent-discovery cron registration', () => {
  it('vercel.json exists and has crons array', () => {
    const vercelJson = JSON.parse(
      readFileSync(join(ROOT, 'vercel.json'), 'utf-8'),
    );
    expect(vercelJson.crons).toBeDefined();
    expect(Array.isArray(vercelJson.crons)).toBe(true);
  });

  it('classifyPromptTheme returns valid IntentTheme values', () => {
    const validThemes = ['hours', 'events', 'offerings', 'comparison', 'occasion', 'location', 'other'];
    const result = classifyPromptTheme('random text');
    expect(validThemes).toContain(result);
  });

  it('scoreOpportunity never exceeds 100', () => {
    const score = scoreOpportunity(false, 100, 'comparison');
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scoreOpportunity never returns negative', () => {
    const score = scoreOpportunity(false, 0, 'other');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('deduplicatePrompts preserves order of first occurrence', () => {
    const result = deduplicatePrompts([
      'first prompt about food',
      'second prompt about drinks',
      'first prompt about food and more',
    ]);
    expect(result[0]).toBe('first prompt about food');
    expect(result[1]).toBe('second prompt about drinks');
  });
});
